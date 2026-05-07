# Design: Aba de contrato no detalhe do aluno

## Arquitetura

```
┌──────────────────────────────────────┐
│ (coach)/aluno/[id]/contrato.tsx      │
│  - Lista contratos (active + ended)  │
│  - Form criar/editar/encerrar        │
└─────────────┬────────────────────────┘
              │
              │  RLS: auth.uid() = coach_id
              ▼
   ┌──────────────────────────────┐
   │ student_contracts            │
   │  + trigger contracts_auto_   │
   │    end_previous (BEFORE      │
   │    INSERT em status='active')│
   │                              │
   │  + view student_contracts_   │
   │    view (effective_status)   │
   └──────────────────────────────┘

   Aluno → SEM acesso (RLS bloqueia)
```

## Arquivos afetados

### Novos

| Arquivo | Propósito |
|---------|-----------|
| `supabase/migrations/2026MMDD000000_student_contracts.sql` | Tabela + indexes + trigger + view + RLS |
| `src/services/contracts.ts` | listStudentContracts, getActiveContract, createContract, updateContract, cancelContract |
| `src/hooks/useContracts.ts` | TanStack Query hooks |
| `app/(coach)/aluno/[id]/contrato.tsx` | Tela com lista + form |
| `src/components/coach/ContractCard.tsx` | Card de contrato (ativo destacado, ended em accordion) |
| `src/components/coach/ContractForm.tsx` | Form reutilizável (criar + editar) |
| `src/lib/money.ts` | `formatBRL(cents) → 'R$ 250,00'` (se ainda não existe) |

### Modificados

| Arquivo | Mudança |
|---------|---------|
| `app/(coach)/aluno/[id]/_layout.tsx` ou index.tsx | Adicionar aba "Contrato" nas tabs/sections do detalhe |
| `src/types/database.ts` | Tipos `StudentContract`, `ContractType`, `ContractStatus` |

## Decisões técnicas

### 1. Status derivado via view

O DB tem `status` (active/ended/cancelled). Mas `active` precisa virar `ended`
quando `end_date < current_date`. Como evitar job/cron:

```sql
create or replace view public.student_contracts_view as
select
  c.*,
  case
    when c.status = 'active' and c.end_date is not null and c.end_date < current_date
      then 'ended'
    else c.status
  end as effective_status
from public.student_contracts c;
```

UI consome `effective_status` para badge. `status` real fica `'active'` no
DB até alguém atualizar (na criação de novo contrato, o trigger encerra).

Trade-off: leitura via view (todos sempre OK). Escritas mantêm `status`
literal. Sem cron necessário.

### 2. Trigger de auto-encerramento

```sql
create or replace function public.contracts_auto_end_previous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    update public.student_contracts
       set status = 'ended',
           end_date = least(coalesce(end_date, current_date), current_date)
     where student_id = new.student_id
       and coach_id   = new.coach_id
       and id <> new.id
       and status = 'active';
  end if;
  return new;
end;
$$;

create trigger student_contracts_auto_end_previous
  before insert on public.student_contracts
  for each row execute function public.contracts_auto_end_previous();
```

- Roda BEFORE INSERT. Atualiza outro contrato `active` (se existir) pra `ended`.
- O partial unique index `student_contracts_one_active_per_pair_idx` garante
  consistência mesmo em insert concorrente (race condition cobre).
- Importante: `end_date = least(end_date, current_date)` para casos onde
  o contrato anterior tinha `end_date` no futuro mas foi substituído antes.

### 3. Constraints CHECK

```sql
constraint contracts_parceria_no_value check (
  (type = 'parceria' and value_cents is null and payment_day is null)
  or (type <> 'parceria' and value_cents is not null)
)
```

`payment_day` pode ser NULL para tipos pagos (é opcional). `value_cents`
NUNCA é NULL para pagos. `parceria` força ambos NULL.

### 4. RLS — privacidade financeira

Aluno NÃO acessa `student_contracts`. Não há policy de SELECT pra `auth.uid()
= student_id`. Só o coach lê.

```sql
create policy "contracts_select_coach" on public.student_contracts
  for select using (auth.uid() = coach_id);
```

Caso futuro queiramos expor pra aluno (ex: ver histórico básico), basta
adicionar policy adicional. Não fazemos no MVP.

### 5. UI: aba "Contrato" no detalhe do aluno

Hoje `(coach)/aluno/[id]/` tem `index.tsx`, `editar.tsx`, `historico.tsx`,
`notas.tsx`, `rotina/`. Não há um layout de tabs visível — provável que a
navegação atual seja botões/cards no `index.tsx`. Inspeção a fazer no Execute.

→ **Approach:** seguir o padrão atual. Se hoje é botão "Histórico"/"Notas"
no index.tsx que rota pra outras telas, adicionar botão "Contrato" que rota
pra `(coach)/aluno/[id]/contrato.tsx`. Se for tabs no `_layout.tsx`,
adicionar nova tab.

### 6. Formato monetário

`value_cents: int`. Salvar em centavos evita float drift. Helper:

```ts
// src/lib/money.ts
export function formatBRL(cents: number | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function parseBRL(input: string): number {
  // "R$ 1.250,50" → 125050
  const digits = input.replace(/\D/g, '');
  return parseInt(digits || '0', 10);
}
```

Input no form usa máscara live (`react-native-mask-input` ou manual).

### 7. Service layer

```ts
// src/services/contracts.ts
import { supabase } from './supabase';
import type { StudentContract, ContractType } from '@/types/database';

export type ContractInput = {
  student_id: string;
  type: ContractType;
  start_date: string;
  end_date?: string | null;
  value_cents?: number | null;
  payment_day?: number | null;
  notes?: string | null;
};

export async function listStudentContracts(studentId: string) {
  const { data, error } = await supabase
    .from('student_contracts_view')
    .select('*')
    .eq('student_id', studentId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data as StudentContract[];
}

export async function getActiveContract(studentId: string) {
  const { data, error } = await supabase
    .from('student_contracts_view')
    .select('*')
    .eq('student_id', studentId)
    .eq('effective_status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data as StudentContract | null;
}

export async function createContract(input: ContractInput) {
  const { data: user } = await supabase.auth.getUser();
  const coach_id = user.user!.id;
  const { data, error } = await supabase
    .from('student_contracts')
    .insert({ ...input, coach_id, status: 'active' })
    .select('*').single();
  if (error) throw error;
  return data as StudentContract;
}

// ...updateContract, cancelContract
```

## Edge cases

| Caso | Comportamento |
|------|---------------|
| Coach cria 2º contrato `active` enquanto outro está active | Trigger encerra o anterior automaticamente |
| Race: 2 inserts simultâneos com `active` | Partial unique index garante 1 dos 2 falha (postgres atomicidade) |
| Editar contrato encerrado | Bloqueado em UI; RLS permite mas guard em service |
| Apagar professor | CASCADE → contratos somem |
| Apagar aluno | CASCADE → contratos somem |
| Editar value de contrato active | Permitido — UPDATE direto |
| Definir end_date no passado | CHECK falha (`end_date >= start_date`) |
| Tipo `parceria` com value | CHECK falha |
| Tipo `mensal` sem value | CHECK falha |

## Test plan

| Cenário | Como testar |
|---------|------------|
| Criar contrato mensal | UI → preenche form → ver na lista, badge "Ativo" |
| Criar contrato parceria | Campos value/payment somem; insert sem erro |
| Renovar (criar 2º active) | Trigger encerra o 1º; lista mostra 1 active + 1 ended |
| Encerrar manual | UPDATE status='cancelled', end_date=hoje |
| Tentar criar 2 active simultâneos | Constraint impede |
| Aluno tenta SELECT direto via cliente | RLS retorna 0 rows |
| Outro coach tenta ler/escrever | RLS bloqueia |
| Edit contrato encerrado | UI desabilita botão; só notes editáveis |
| `effective_status` automático | Inserir contrato com end_date passada → view mostra ended |
| Validação parceria | Form impede submit se inconsistente |

Comandos:
```sh
npm run typecheck
npm run lint
npm run db:push
```

Smoke manual: aplicar migration, criar contrato mensal pra um aluno, renovar,
encerrar, ver no Supabase Studio se trigger e view funcionam.
