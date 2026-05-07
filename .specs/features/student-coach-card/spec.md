# Feature: Card do professor no perfil do aluno

## Visão geral

No perfil do aluno (`(tabs)/perfil.tsx`), no final da tela, exibe um Card
"Seu Professor" com nome do professor, avatar (se existir) e — quando o
professor permitir — número de WhatsApp clicável. O Card só aparece para
usuários `role = 'aluno'` com `coach_id` definido.

O professor controla a visibilidade do telefone via toggle global no seu
perfil (não granular por aluno no MVP).

## User stories

**US-1.** Como aluno vinculado a um professor, quero ver no meu perfil quem
é meu professor (nome + foto), para saber a quem estou vinculado.

**US-2.** Como aluno, quero clicar no número de contato do professor (se
exibido) e abrir conversa no WhatsApp, para tirar dúvidas rápido.

**US-3.** Como professor, quero controlar se meu telefone é exibido aos
alunos via toggle no meu perfil — alguns coaches preferem manter contato
fora do app, outros não.

**US-4.** Como aluno sem professor (`role = 'comum'` ou `'aluno'` sem coach_id),
não quero ver esse card — ele só faz sentido pra quem está vinculado.

## Critérios de aceite

| ID | Critério |
|----|----------|
| AC-1 | Card só renderiza quando `profile.role = 'aluno' AND profile.coach_id IS NOT NULL` |
| AC-2 | Card sempre mostra nome do professor; mostra foto se `coach.profile.avatar_url` existir |
| AC-3 | Linha "WhatsApp" só aparece se `coaches.show_contact_to_students = true AND coaches.contact_phone IS NOT NULL` |
| AC-4 | Tap no telefone abre `wa.me/<numero>` via `Linking.openURL` (fallback alert se não tiver WhatsApp instalado) |
| AC-5 | Professor consegue ligar/desligar o toggle e editar o telefone na tela de perfil dele |
| AC-6 | Aluno consegue LER `coaches.show_contact_to_students` e `coaches.contact_phone` do seu coach (RLS atual de `coaches` precisa permitir isso) |
| AC-7 | Telefone é validado: aceita apenas dígitos (mínimo 10, máximo 13). Salvo sem máscara. Exibido formatado (`+55 (11) 99999-9999`) |

## Esquema de dados

### `coaches` — colunas adicionais

```sql
alter table public.coaches
  add column if not exists show_contact_to_students boolean not null default false,
  add column if not exists contact_phone text
    check (contact_phone is null or contact_phone ~ '^[0-9]{10,13}$');

comment on column public.coaches.show_contact_to_students is
  'Se true, alunos vinculados podem ler contact_phone via RLS.';
comment on column public.coaches.contact_phone is
  'Telefone com DDI+DDD+número, só dígitos. Ex: 5511999999999 (BR).';
```

### RLS — leitura pelo aluno

A migration `20260504000000_coach_role_and_table.sql` define
`coaches_select_own` permitindo `auth.uid() = id`. Aluno não consegue ler
seu coach hoje. Precisa estender:

```sql
drop policy if exists "coaches_select_own_or_coach" on public.coaches;
create policy "coaches_select_own_or_coach" on public.coaches
  for select using (
    auth.uid() = id                              -- próprio coach
    or id = public._auth_coach_id()              -- aluno lendo seu coach
  );
```

Onde `_auth_coach_id()` é a SECURITY DEFINER helper já criada na migration
`20260513000000_fix_profiles_rls_recursion.sql`.

**Cuidado:** isso expõe TODAS as colunas de `coaches` para o aluno do coach
(bio, cref, max_students, show_contact, contact_phone). Discutível?

→ **Decisão:** ainda assim OK porque:
- `bio` e `cref` são profissionalmente públicos (CREF é registro público)
- `max_students` não é sensível
- `show_contact_to_students` o aluno só vai usar pra renderizar o card (irrelevante se ele souber)
- `contact_phone` é o único sensível, e a UI só renderiza se `show_contact` for true

Se quiser fechar mais ainda, alternativa: criar view `coach_card_view` que
expõe só `(id, full_name, avatar_url, contact_phone_if_visible)` e dar SELECT
público autenticado. Mais cerimônia, sem ganho real. Adiar.

→ **Final:** RLS estendido conforme acima.

## UI / UX

### No `app/(tabs)/perfil.tsx`

Adicionar Card no FINAL da tela (após "Sair da conta" não — antes do
`Disclaimer`, no fluxo natural). Render condicional:

```tsx
{isStudent && profile?.coach_id && (
  <CoachCard coachId={profile.coach_id} />
)}
```

Componente novo `src/components/CoachCard.tsx`:

```
┌────────────────────────────────────┐
│ [foto] João Silva                  │
│        Seu professor               │
│                                    │
│ 📱 +55 (11) 99999-9999       [→]   │ ← só se show_contact && phone
└────────────────────────────────────┘
```

- Foto: `Image` com `source={{ uri: avatar_url }}` ou fallback inicial
- Nome: `text-text font-semibold`
- "Seu professor" subtitle: `text-text-dim text-xs`
- Linha do WhatsApp: `Pressable` que chama `Linking.openURL('https://wa.me/' + phone)`
  - Tenta abrir WhatsApp → fallback Alert se não conseguir
  - Ícone WhatsApp (lucide `MessageCircle` ou similar)

### No perfil do professor (`(coach)/perfil.tsx` ou similar)

**Atualmente não existe** — `(coach)/_layout.tsx` tem index.tsx,
solicitacoes.tsx, aluno-novo.tsx, aluno/. Precisa criar uma tela "Meu perfil"
para o professor.

→ **Decisão:** criar `app/(coach)/perfil.tsx` com:
- Nome (read-only, vem do profile.full_name)
- Email (read-only)
- Bio (input, salva em `coaches.bio`)
- CREF (input, salva em `coaches.cref`)
- Toggle "Permitir alunos verem meu telefone" (`show_contact_to_students`)
- Input "Telefone com DDI/DDD" (visível só se toggle on)
- Botão "Salvar"

Adicionar entry-point nessa tela a partir de `(coach)/_layout.tsx` (header
ou home card "Configurações").

### Service novo / atualização

`src/services/coach.ts` (já existe). Adicionar:

```ts
export type CoachContact = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  show_contact_to_students: boolean;
  contact_phone: string | null;
};

export async function getCoachContact(coachId: string): Promise<CoachContact | null>;
export async function updateCoachContactSettings(input: {
  show_contact_to_students: boolean;
  contact_phone: string | null;
}): Promise<void>;
```

Hook novo: `useCoachContact(coachId)` em `src/hooks/useCoach.ts`.

### Helpers

`src/lib/phone.ts` (criar):
- `formatPhoneBR(digits: string): string` — `5511999999999` → `+55 (11) 99999-9999`
- `parsePhoneInput(masked: string): string` — só dígitos
- `whatsappUrl(digits: string): string` — `https://wa.me/${digits}`

## Integração com features existentes

| Feature | Impacto |
|---------|---------|
| `(tabs)/perfil.tsx` | Adicionar render condicional do CoachCard |
| `(coach)/_layout.tsx` | Adicionar acesso a "Meu perfil" |
| Migration de coaches (`20260504...`) | Estender com 2 colunas + ajustar RLS |
| `src/services/coach.ts` | Adicionar funções de contato |
| `src/types/database.ts` | Atualizar tipos da tabela `coaches` |

## Decisões

| Tema | Decisão |
|------|---------|
| Modelo de visibilidade | **Toggle global** (1 valor por coach, vale para todos os alunos) |
| O que aparece sempre | Nome + avatar do professor (já permitido pela RLS atual de profiles) |
| O que é opt-in | Telefone — só se `show_contact_to_students = true AND contact_phone IS NOT NULL` |
| Tipo de contato | WhatsApp via `wa.me/<numero>`. Só telefone (sem email/instagram no MVP) |
| Formato armazenado | DDI+DDD+número, só dígitos (`5511999999999`) |
| Validação | Regex `^[0-9]{10,13}$` (10-13 dígitos cobre BR e fallback) |
| Granularidade por aluno | Não no MVP — overkill |
| RLS de `coaches` | Estendida para aluno ler campos do seu coach |
| Tela de perfil do coach | Criar nova `(coach)/perfil.tsx` |

## Riscos / cuidados

- **RLS de `coaches`**: estender o select policy é simples mas precisa manter o cuidado com recursão. Como já temos `_auth_coach_id()` SECURITY DEFINER, fica seguro (não causa loop).
- **Privacidade do telefone**: aluno não vê o número se toggle for off. Mas se professor já compartilhou e depois desliga o toggle, alunos antigos perdem acesso (esperado).
- **WhatsApp em country fora do BR**: `wa.me/` aceita formato internacional. Validação de 10-13 dígitos cobre. Default UI sugere "código do país + DDD + número".
- **Apagar professor**: aluno fica órfão (`coach_id = NULL`), card some. OK.
- **Fallback de WhatsApp não instalado**: `Linking.canOpenURL('whatsapp://')` retorna false → cair em `https://wa.me/...` que abre no browser/store. Cobrir com try/catch.

## Fora de escopo

- Visibilidade granular por aluno (toggle por relação)
- Outros canais (telegram, instagram, email)
- Chat in-app aluno↔professor (já tem fluxo de `student_requests`)
- Notificação por contato direto (push do professor pro aluno via app)
- Vídeo/voz call
- Histórico de contatos / "última mensagem"
- Ocultar telefone parcialmente (mascarar último dígito)
