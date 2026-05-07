# Feature: Aba de contrato no detalhe do aluno

## Visão geral

Adiciona uma aba "Contrato" no detalhe do aluno (`(coach)/aluno/[id]/`) onde
o professor registra o tipo de contratação (mensal, treino-a-treino, semanal,
parceria), data de início, data fim opcional, valor (exceto parceria) e dia
combinado de pagamento (opcional, exceto parceria). Mantém histórico de
contratos por aluno (renovações, mudanças de plano).

Hoje essa informação fica perdida em conversas de WhatsApp ou em "combinado
de boca". A feature é registro/consulta — sem cobrança, lembrete, ou
integração com gateway.

## User stories

**US-1.** Como professor, quero abrir o detalhe de um aluno e clicar em
"Contrato" para ver o contrato ativo + histórico de contratos passados.

**US-2.** Como professor, quero criar um contrato informando tipo
(mensal/treino/semanal/parceria), data inicial, data final opcional, valor
(se não for parceria) e dia de pagamento (se não for parceria), para
registrar o que foi combinado.

**US-3.** Como professor, quero editar um contrato ativo (mudou o valor,
trocou o tipo) ou encerrar antes do prazo (status `cancelled`), sem perder
o registro do que valia antes.

**US-4.** Como professor, quero criar um novo contrato substituindo o
anterior (renovação, mudança de plano) — o sistema encerra o atual e ativa
o novo automaticamente.

**US-5.** Como professor, quero filtrar lista geral por aluno com contrato
expirando (end_date próxima) ou com pagamento próximo (payment_day) para
poder cobrar a tempo. *[stretch — opcional, marcado como pode-ficar-fora]*

## Critérios de aceite

| ID | Critério |
|----|----------|
| AC-1 | Aluno tem 0..N contratos. No máximo 1 com `status = 'active'` por par (student_id, coach_id) — constraint via partial unique index |
| AC-2 | Tipo `parceria` força `value_cents IS NULL` e `payment_day IS NULL` (CHECK constraint) |
| AC-3 | Tipos `mensal`, `treino`, `semanal` exigem `value_cents NOT NULL` (CHECK constraint) |
| AC-4 | Status `'ended'` é derivado quando `end_date < now()` (computed ou job); `'cancelled'` é manual antes de end_date |
| AC-5 | Criar novo contrato com (student_id, coach_id) tendo um `active` automaticamente encerra o anterior (`status = 'ended'`, `end_date = now()`) |
| AC-6 | RLS permite só o coach do aluno ler/escrever. Aluno NÃO vê contratos no MVP (info financeira privada do coach) |
| AC-7 | UI mostra contrato ativo em destaque + accordion com histórico |
| AC-8 | Valor exibido formatado em R$ (`pt-BR`); dia de pagamento exibido como "Todo dia 5" |
| AC-9 | Ao deletar professor, contratos cascatam (cascade) — ao deletar aluno, idem |

## Esquema de dados

### `student_contracts` — tabela nova

```sql
create table public.student_contracts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.coaches(id) on delete cascade,
  type text not null check (type in ('mensal','treino','semanal','parceria')),
  start_date date not null,
  end_date date,
  value_cents int check (value_cents is null or value_cents >= 0),
  payment_day int check (payment_day is null or (payment_day between 1 and 31)),
  status text not null default 'active'
    check (status in ('active','ended','cancelled')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Parceria não tem valor nem dia de pagamento
  constraint contracts_parceria_no_value check (
    (type = 'parceria' and value_cents is null and payment_day is null)
    or (type <> 'parceria' and value_cents is not null)
  ),

  -- end_date >= start_date quando preenchido
  constraint contracts_dates_consistent check (
    end_date is null or end_date >= start_date
  )
);

-- Apenas 1 contrato 'active' por (student, coach)
create unique index student_contracts_one_active_per_pair_idx
  on public.student_contracts (student_id, coach_id)
  where status = 'active';

create index student_contracts_coach_idx
  on public.student_contracts (coach_id, status, start_date desc);
create index student_contracts_student_idx
  on public.student_contracts (student_id, status);

create trigger student_contracts_set_updated_at
  before update on public.student_contracts
  for each row execute function public.set_updated_at();
```

### Trigger de auto-encerramento na criação de novo `active`

```sql
create or replace function public.contracts_auto_end_previous()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    update public.student_contracts
       set status = 'ended', end_date = least(coalesce(end_date, current_date), current_date)
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

### RLS

Só o coach dono lê/escreve. **Aluno não enxerga** contratos no MVP.

```sql
alter table public.student_contracts enable row level security;

-- Coach lê os contratos dos seus alunos
create policy "contracts_select_coach" on public.student_contracts
  for select using (
    auth.uid() = coach_id
  );

-- Coach insere contrato para aluno seu
create policy "contracts_insert_coach" on public.student_contracts
  for insert with check (
    auth.uid() = coach_id
    and exists (
      select 1 from public.profiles p
      where p.id = student_contracts.student_id
        and p.coach_id = auth.uid()
        and p.role = 'aluno'
    )
  );

create policy "contracts_update_coach" on public.student_contracts
  for update using (auth.uid() = coach_id);

create policy "contracts_delete_coach" on public.student_contracts
  for delete using (auth.uid() = coach_id);
```

### Status derivado (auto-end por data)

Opcionalmente, view ou job que muda `active → ended` quando `end_date < current_date`.

**Opção 1 (preferida):** view `student_contracts_view` que retorna status
ajustado on-the-fly. UI consome a view; tabela mantém status original.

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

UI usa `effective_status`. Migrations futuras podem ter um cron que sincroniza
`status` real, mas não é necessário pra MVP.

**Opção 2:** Cron job no Supabase (pg_cron) que roda diário.

→ Decisão: **Opção 1** (view), simples e sem dependência de pg_cron.

## UI / UX

### Rota nova

```
app/(coach)/aluno/[id]/contrato.tsx     # tela com lista + form
```

### Acesso

No `(coach)/aluno/[id]/index.tsx` (detalhe do aluno), nas tabs/sections já
existentes, adicionar **aba "Contrato"** ao lado de "Histórico", "Notas",
"Rotinas". Visualmente similar.

### Layout

```
┌──────────────────────────────────────┐
│ ← Aluno: Maria Silva                 │
├──────────────────────────────────────┤
│ [Detalhes][Rotinas][Histórico]       │
│ [Notas][Contrato]              ←     │
├──────────────────────────────────────┤
│ ◉ ATIVO                              │
│ ┌──────────────────────────────────┐ │
│ │ Mensal · R$ 250,00               │ │
│ │ Pagamento: todo dia 5            │ │
│ │ Início: 03/05/2026               │ │
│ │ Fim: indefinido                  │ │
│ │ [Editar] [Encerrar]              │ │
│ └──────────────────────────────────┘ │
│                                      │
│ + Novo contrato                      │
│                                      │
│ ─── Histórico ───                    │
│ • Semanal · R$ 80,00 (encerrado)    │
│   01/03 → 30/04/2026                 │
└──────────────────────────────────────┘
```

### Form (criar/editar)

Campos:
- **Tipo** (SegmentedControl): Mensal / Treino / Semanal / Parceria
- **Data de início** (DatePicker, default = hoje)
- **Data de fim** (DatePicker, opcional — toggle "Sem prazo definido")
- **Valor** (Input numérico, R$, oculto se parceria)
- **Dia de pagamento** (Input 1-31, oculto se parceria, opcional)
- **Notas** (textarea, opcional, 1000 chars max)

Validação:
- Tipo obrigatório
- start_date obrigatório
- value obrigatório se type ≠ 'parceria'
- end_date >= start_date

### Ações

- **Encerrar contrato ativo**: confirma → UPDATE status = 'cancelled', end_date = today
- **Criar novo contrato**: trigger encerra o anterior automaticamente (manda `status='active'`)
- **Editar contrato ativo**: form pré-preenchido; UPDATE direto
- **Editar histórico**: bloqueado (read-only), só pra evitar reescrita de história. *Decisão: permitir editar `notes` mas não tipo/valor.*

## Integração com features existentes

| Feature | Impacto |
|---------|---------|
| `(coach)/aluno/[id]/_layout.tsx` | Adicionar nova rota nas tabs |
| `src/services/students.ts` | Sem mudança — contratos têm service próprio |
| Lista de alunos `(coach)/index.tsx` | Stretch: badge "contrato vencendo" se end_date está nos próximos 7 dias |
| Notificações | Stretch fora do MVP — push/email pra cobrança |

### Service novo

`src/services/contracts.ts`:

```ts
export type ContractType = 'mensal' | 'treino' | 'semanal' | 'parceria';
export type ContractStatus = 'active' | 'ended' | 'cancelled';

export type StudentContract = {
  id: string;
  student_id: string;
  coach_id: string;
  type: ContractType;
  start_date: string;       // ISO date
  end_date: string | null;
  value_cents: number | null;
  payment_day: number | null;
  status: ContractStatus;
  effective_status: ContractStatus;  // da view
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listStudentContracts(studentId: string): Promise<StudentContract[]>;
export async function getActiveContract(studentId: string): Promise<StudentContract | null>;
export async function createContract(input: ContractInput): Promise<StudentContract>;
export async function updateContract(id: string, patch: ContractPatch): Promise<StudentContract>;
export async function cancelContract(id: string): Promise<void>;
```

Hooks:
- `useStudentContracts(studentId)` — list
- `useActiveContract(studentId)` — atual
- `useCreateContract`, `useUpdateContract`, `useCancelContract` — mutations

## Decisões

| Tema | Decisão |
|------|---------|
| Histórico vs único | **Histórico** — 1 ativo por par + N encerrados |
| Tipos | `mensal`, `treino`, `semanal`, `parceria` (4 fixos) |
| Valor para tipo `treino` | Valor por treino executado (interpretação livre — campo é um número, professor anota) |
| Visibilidade pelo aluno | **Não** — info financeira privada do coach no MVP |
| Notificações de cobrança | Fora do MVP. Só registro |
| Transição automática `active → ended` por data | Via view `effective_status` (não muda tabela). Opção 2 (pg_cron) descartada |
| Edição de contratos do histórico | Bloqueada (só `notes`). Evita reescrita de combinados antigos |
| Encerrar contrato ativo | UPDATE com status `cancelled` + end_date = hoje. Reabrir = criar novo |
| Substituir por novo (renovação) | Trigger encerra o anterior automaticamente quando insere `active` |
| Valor armazenado | `int` em centavos (`value_cents`) — evita float drift |

## Riscos / cuidados

- **RLS de `coach_id`**: a verificação `auth.uid() = coach_id` exige que o coach esteja em `coaches.id = auth.uid()`. OK no fluxo atual. Aluno nunca acessa essa tabela (RLS bloqueia mesmo sem checar role explícito).
- **Trigger auto-end**: se vier sem `status='active'` (ex: insert direto de histórico), não dispara — comportamento desejado.
- **Aluno órfão**: se professor é deletado, contratos cascatam (cascade). Combina com `coach_id ON DELETE SET NULL` do `profiles` da spec area-professor.
- **Datas locais vs UTC**: `start_date` / `end_date` são `date` (sem tz). Comparar com `current_date` evita drift de fuso. UI deve mostrar no fuso do device.
- **Constraint compostiva (parceria_no_value)**: postgres aceita CHECKs com várias colunas. Testar em migration local antes de deploy.

## Fora de escopo

- Cobrança/billing (gateway de pagamento)
- Notificações de pagamento próximo (push/email/whatsapp)
- Aluno enxergar contratos
- Múltiplos professores por aluno
- Pagamentos parciais / faturas individuais (a feature é só "contrato ativo")
- Comissão / split entre coaches
- Recibo / fatura para download
- Integração com nota fiscal eletrônica
