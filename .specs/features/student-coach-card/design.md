# Design: Card do professor no perfil do aluno

## Arquitetura

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│ (coach)/perfil.tsx (NOVA)    │         │ (tabs)/perfil.tsx (aluno)    │
│  - Toggle show_contact       │         │  - Render condicional        │
│  - Input contact_phone       │         │    <CoachCard coachId=... /> │
└──────────────┬───────────────┘         └──────────────┬───────────────┘
               │ UPDATE                                  │ SELECT
               ▼                                         ▼
   ┌──────────────────────────────────────────────────────────┐
   │ coaches                                                   │
   │  + show_contact_to_students bool (default false)          │
   │  + contact_phone text (regex check)                       │
   │                                                           │
   │ RLS estendida: select se id=auth.uid() OR id=             │
   │                _auth_coach_id() (helper SECURITY DEFINER) │
   └──────────────────────────────────────────────────────────┘
                            ▲
                            │ Linking.openURL(wa.me/...)
   ┌────────────────────────┴──────────────────┐
   │ src/components/CoachCard.tsx              │
   │  - foto + nome + "Seu professor"          │
   │  - linha clicável WhatsApp se permitido   │
   └───────────────────────────────────────────┘
```

## Arquivos afetados

### Novos

| Arquivo | Propósito |
|---------|-----------|
| `supabase/migrations/2026MMDD000000_coach_contact_fields.sql` | Adiciona colunas + ajusta RLS |
| `src/components/CoachCard.tsx` | Componente do card |
| `src/lib/phone.ts` | formatPhoneBR, parsePhoneInput, whatsappUrl |
| `src/hooks/useCoachContact.ts` | TanStack Query hook |
| `app/(coach)/perfil.tsx` | Tela de perfil/configurações do professor |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `app/(tabs)/perfil.tsx` | Adicionar `<CoachCard />` quando aluno + coach_id |
| `src/services/coach.ts` | getCoachContact, updateCoachContactSettings |
| `src/types/database.ts` | Atualizar tipo de `coaches` |
| `app/(coach)/_layout.tsx` ou `index.tsx` | Acesso à tela de perfil do coach |

## Decisões técnicas

### 1. RLS estendida em `coaches`

Hoje (migration `20260504...`):

```sql
create policy "coaches_select_own" on public.coaches
  for select using (auth.uid() = id);
```

Estender:

```sql
drop policy if exists "coaches_select_own" on public.coaches;
create policy "coaches_select_own_or_student" on public.coaches
  for select using (
    auth.uid() = id
    or id = public._auth_coach_id()
  );
```

`_auth_coach_id()` já existe (`20260513000000_fix_profiles_rls_recursion.sql`)
e é SECURITY DEFINER, evita recursão de RLS.

**Reflexão:** isso expõe `bio`, `cref`, `max_students`, `created_at` do coach
para o aluno. `bio` e `cref` são informações profissionais (CREF é registro
público). `max_students` é interno mas inofensivo. Aceitável.

### 2. Componente `CoachCard`

```tsx
// src/components/CoachCard.tsx
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { Card } from './ui';
import { useCoachContact } from '@/hooks/useCoachContact';
import { formatPhoneBR, whatsappUrl } from '@/lib/phone';
import { colors } from '@/lib/theme';

export function CoachCard({ coachId }: { coachId: string }) {
  const { data, isLoading } = useCoachContact(coachId);

  if (isLoading || !data) return null;

  const showPhone = data.show_contact_to_students && data.contact_phone;

  async function openWhatsApp() {
    if (!data?.contact_phone) return;
    const url = whatsappUrl(data.contact_phone);
    try {
      await Linking.openURL(url);
    } catch {
      // fallback ou alert
    }
  }

  return (
    <Card padding="md">
      <Text className="text-text-dim text-[11px] uppercase tracking-widest mb-3">
        Seu professor
      </Text>
      <View className="flex-row items-center gap-3">
        {data.avatar_url ? (
          <Image
            source={{ uri: data.avatar_url }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
          />
        ) : (
          <View className="h-12 w-12 rounded-full bg-surface-raised border border-border-strong items-center justify-center">
            <Text className="text-accent text-xl font-bold">
              {data.full_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-text font-semibold">{data.full_name}</Text>
          <Text className="text-text-dim text-xs">Professor responsável</Text>
        </View>
      </View>

      {showPhone && (
        <Pressable
          onPress={openWhatsApp}
          className="mt-3 flex-row items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 active:opacity-70"
        >
          <MessageCircle size={16} color={colors.accent} />
          <Text className="text-accent text-sm font-semibold flex-1">
            {formatPhoneBR(data.contact_phone!)}
          </Text>
          <Text className="text-accent/60 text-xs">WhatsApp →</Text>
        </Pressable>
      )}
    </Card>
  );
}
```

### 3. Helper `lib/phone.ts`

```ts
// src/lib/phone.ts

/** Limpa input pro formato armazenado (só dígitos). */
export function parsePhoneInput(masked: string): string {
  return masked.replace(/\D/g, '');
}

/** Formata `5511999999999` → `+55 (11) 99999-9999`. Tolerante a tamanhos. */
export function formatPhoneBR(digits: string): string {
  const cleaned = digits.replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    // +55 (11) 99999-9999
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 11) {
    // (11) 99999-9999
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    // (11) 9999-9999
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  // Fallback: retorna como veio
  return cleaned;
}

/** Gera URL wa.me. Aceita digits ou número formatado. */
export function whatsappUrl(input: string): string {
  const digits = parsePhoneInput(input);
  return `https://wa.me/${digits}`;
}

/** Validação. */
export function isValidPhone(digits: string): boolean {
  const cleaned = parsePhoneInput(digits);
  return /^[0-9]{10,13}$/.test(cleaned);
}
```

### 4. Tela `(coach)/perfil.tsx`

Estrutura simples:

```
┌─────────────────────────────────┐
│ ← Meu perfil                    │
├─────────────────────────────────┤
│ [Avatar]                        │
│ João Silva                      │
│ joao@email.com                  │
│                                 │
│ ─── Informações profissionais ─ │
│ Bio: ___________________        │
│ CREF: __________________        │
│                                 │
│ ─── Contato pelos alunos ────── │
│ ◯ Permitir alunos verem meu   │
│    telefone                     │
│ Telefone: +55 ___ _________     │
│                                 │
│ [Salvar]                        │
└─────────────────────────────────┘
```

Componente reaproveita `Input`, `Switch` (se existe; senão criar pequeno),
`Card`, `Button` da `src/components/ui/`.

Validação:
- Bio: opcional, max 500 chars
- CREF: opcional
- Toggle: bool
- Telefone: se toggle ON e preenchido, aplicar `isValidPhone`

### 5. Service / hook

```ts
// src/services/coach.ts (adições)
export async function getCoachContact(coachId: string) {
  const { data, error } = await supabase
    .from('coaches')
    .select(`
      id,
      show_contact_to_students,
      contact_phone,
      bio,
      cref,
      profile:profiles!inner(full_name, avatar_url)
    `)
    .eq('id', coachId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    full_name: data.profile.full_name,
    avatar_url: data.profile.avatar_url,
    show_contact_to_students: data.show_contact_to_students,
    contact_phone: data.contact_phone,
    bio: data.bio,
    cref: data.cref,
  };
}

export async function updateCoachContactSettings(input: {
  show_contact_to_students: boolean;
  contact_phone: string | null;
  bio?: string | null;
  cref?: string | null;
}) {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('coaches')
    .update(input)
    .eq('id', user.user!.id);
  if (error) throw error;
}
```

```ts
// src/hooks/useCoachContact.ts
export function useCoachContact(coachId: string) {
  return useQuery({
    queryKey: ['coach-contact', coachId],
    queryFn: () => getCoachContact(coachId),
    enabled: !!coachId,
    staleTime: 5 * 60_000,
  });
}
```

## Edge cases

| Caso | Comportamento |
|------|---------------|
| Aluno sem coach_id | Card não renderiza |
| Coach sem avatar_url | Mostra inicial do nome em fallback |
| Coach com toggle ON mas phone NULL | Não renderiza linha do WhatsApp |
| Telefone com formato inválido | Form impede salvar; UI mostra erro |
| WhatsApp não instalado | `Linking.openURL` abre no browser (wa.me já cobre) |
| Coach apaga conta | Aluno fica órfão, card some |
| Coach desliga toggle | Próxima query retorna `show_contact = false`; card recolhe linha |
| 2 alunos diferentes do mesmo coach | Mesmo card; cache compartilhado |

## Test plan

| Cenário | Como testar |
|---------|------------|
| Coach habilita toggle e salva phone | Atualiza coach (UI) → query devolve phone formatado |
| Aluno vinculado vê card | Login como aluno → aba perfil → card aparece com nome+foto |
| Aluno vê WhatsApp quando toggle ON | Card mostra linha clicável; tap abre wa.me |
| Aluno NÃO vê WhatsApp quando toggle OFF | Card existe mas sem linha do WhatsApp |
| Aluno comum (sem coach_id) | Card não aparece |
| Validação de telefone | Tentar salvar "abc" → erro; "11999" (curto) → erro; "5511999999999" → ok |
| RLS aluno → coach | SQL direto: aluno consegue SELECT do seu coach via service role test ou via app |
| RLS aluno → coach OUTRO | Aluno tenta ler coach que não é dele: 0 rows |
| Outro coach lendo coach | 0 rows (RLS) |
| Apagar coach | Aluno fica órfão (`coach_id = NULL`); card some |

Comandos:
```sh
npm run typecheck
npm run lint
npm run db:push
npm run start                       # smoke teste em device
```
