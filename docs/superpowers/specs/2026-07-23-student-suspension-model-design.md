# Suspensão de alunos excedentes (downgrade não-destrutivo)

**Data:** 2026-07-23
**Autor:** Robson Solano (com Claude)
**Status:** Design aprovado — pendente review do spec

---

## Problema

Hoje, quando um professor cai de plano (ex.: Pro/Premium → Free) e fica com mais
alunos do que o novo limite permite, o enforcement é **advisory** (só um banner
dispensável na home). Consequências:

- O professor pode **ignorar** o aviso e continuar gerenciando os 4 alunos
  indefinidamente (ver, editar; IA só se `ai_coach`). O limite só bloqueia
  **adicionar** aluno novo (`coach-create-student` → `402 needs_upgrade`).
- A única forma "oficial" de resolver é **desvincular/deletar** alunos —
  destrutivo e irreversível: o aluno vira `comum` free.

**Objetivo:** substituir o modelo destrutivo por **suspensão reversível**. Os
alunos excedentes ficam **suspensos** (acesso bloqueado, dado preservado), o
professor escolhe quais ficam **ativos**, e **upgrade reativa todos na hora**.

## Decisões de produto (travadas)

1. **Quem fica ativo:** auto-mantém os **N mais antigos** ativos (N = limite do
   tier); o excedente entra suspenso. O professor pode **trocar livremente** quais
   ficam ativos (reativar um em capacidade cheia suspende outro). Upgrade reativa
   todos.
2. **Aluno suspenso = bloqueio total:** ao abrir o app, só vê a tela "Acesso
   suspenso — fale com seu professor" + Sair. Sem treino, histórico ou qualquer
   função. (Dado NÃO é deletado, só o acesso é bloqueado.)
3. **Grandfather é isento:** professor com `source = 'grandfather'` mantém todos os
   alunos ativos, sem suspensão (consistente com `src/lib/downgrade.ts` hoje).
4. **Desvínculo (unlink) permanece como está:** ação voluntária e separada; o aluno
   é notificado (push "Plano agora é seu") e vira `comum` free. Suspensão ≠
   desvínculo.

## Restrição dura

**OTA-only (`eas update`), zero dependência nativa.** Todo o trabalho no app é
JS + expo-router (rota nova + gate no bootstrap + telas). Nenhum módulo nativo
novo. `version`/runtime permanece **1.3.0** para o OTA alcançar os builds
instalados. Backend (migration + edge functions) é deploy independente no
Supabase. Prova de viabilidade: o gate `/consent` (v1.9.0) usou exatamente este
padrão via OTA.

---

## Arquitetura

### Fonte da verdade: estado persistido + reconciliação no servidor

Suspensão precisa valer no servidor (não pode ser derivada só no cliente). O gate
do aluno vira uma leitura simples de estado persistido; a "troca livre" exige um
estado editável (não dá pra derivar puramente de `created_at`).

#### 1. Coluna de estado

`profiles.suspended_at timestamptz null` — no aluno. `null` = ativo; preenchido =
suspenso (guarda o quando, útil pra auditoria/ordenação). Índice parcial em
`(coach_id) where suspended_at is not null` pra consultas do painel do professor.

#### 2. RPC reconciliadora (determinística, idempotente, auto-curável)

`sync_coach_student_access(p_coach_id uuid)` — `SECURITY DEFINER`. Regra:

1. Resolve o entitlement do professor (`student_limit`, `source`, `role`).
2. Se `role != 'professor'` → no-op.
3. Se `source = 'grandfather'` **ou** `student_limit is null` (premium) → limpa
   `suspended_at` de todos os alunos do professor (todos ativos). Retorna.
4. Senão, seja `L = student_limit`:
   - Ordena os alunos do professor por antiguidade (`created_at asc`, desempate
     por `id`).
   - Os `L` primeiros que já estão ativos permanecem ativos.
   - **Preserva a escolha manual:** ativos são mantidos até `L`; se ativos > L,
     suspende os ativos **mais recentes** além de L. Se ativos < L e há suspensos,
     reativa os suspensos **mais antigos** até atingir L.
   - Idempotente: rodar de novo sem mudanças externas não altera nada.

> Nota de convergência: a reconciliação opera sobre "ativos atuais" primeiro
> (preserva troca manual do professor), e só usa `created_at` como critério de
> desempate/preenchimento. Assim, um professor que trocou #1↔#4 mantém a escolha
> após um re-sync que não muda o limite.

#### 3. Gatilhos da RPC

| Gatilho | Quando | Por quê |
|---|---|---|
| `revenuecat-webhook` | Após aplicar qualquer mudança de assinatura do professor | Downgrade suspende; **upgrade reativa todos** |
| `coach-unlink-student` | No fim do unlink | Libera vaga → reativa o próximo suspenso mais antigo |
| `coach-set-active-students` | Ao salvar o conjunto de ativos (escolher-alunos) | Aplica a escolha respeitando `L` |
| Bootstrap do professor | Ao resolver entitlement (abre o app) | Rede de segurança (webhook perdido) |
| Bootstrap do aluno | Ao logar (via RPC do coach dele) | Auto-cura: corrige antes de bloquear |

### Exposição do estado ao cliente

- **Aluno:** bootstrap/entitlement passa a expor `suspended: boolean`
  (`suspended_at is not null`). O gate usa isso.
- **Professor:** a lista de alunos (`useStudents`) passa a trazer `suspended_at`
  por aluno pra renderizar ⊘/ativo.

---

## Componentes

### Banco (migration `20260723000000_student_suspension.sql`)

- `ALTER TABLE profiles ADD COLUMN suspended_at timestamptz` + índice parcial.
- `CREATE FUNCTION sync_coach_student_access(uuid)` conforme regra acima.
- Ajuste no read de perfil/bootstrap do aluno para incluir `suspended`.
- (Se aplicável) grant/execute da RPC ao role autenticado.

### Edge functions

- **`revenuecat-webhook`:** após persistir a mudança em `subscriptions`, chamar
  `sync_coach_student_access(coach_id)` se o `rc_app_user_id` for de um professor.
- **`coach-unlink-student`:** chamar a RPC no fim (após o unlink já existente).
- **`coach-set-active-students`** (novo): body `{ active_ids: uuid[] }` — o
  **conjunto de alunos que devem ficar ativos**. Valida ownership (todos os ids
  são alunos do caller) e que `|active_ids| <= student_limit` (senão
  `402 needs_upgrade` / `409 over_limit`). Marca os de fora do conjunto como
  suspensos e os de dentro como ativos, depois chama a RPC pra reconciliar.
  Caminho único — não há toggle 1-a-1 com regras de capacidade; a UI sempre envia
  o conjunto final desejado.

### App — lado aluno

- **Rota `/suspended`** (molde do `/consent`): tela de bloqueio total com a
  mensagem e botão **Sair** (logout). Sem navegação pra dentro.
- **Gate no `app/index.tsx` (SplashGate):** autenticado + `role='aluno'` +
  `suspended` → `Redirect /suspended`. Ordem vs. o gate de `/consent`: consent
  primeiro (aceite legal), depois suspensão. Bootstrap dispara a RPC de auto-cura
  antes de decidir.
- **Hook** `useStudentSuspension()` (espelha `useLegalAcceptance`): resolve
  `suspended`/`isChecking`.

### App — lado professor

- **Banner na home** (`(coach)/index.tsx`): reescrever o card de downgrade para
  **"⚠️ {n} de {total} alunos suspensos — mantenha {limite} ativos ou faça
  upgrade"**. Toque → `escolher-alunos`.
- **`escolher-alunos.tsx`:** deixa de ser "escolher quem fica (deleta o resto)" e
  vira **seletor de ativos**. Marca até `limite`; salvar envia o conjunto de
  ativos → backend suspende o restante. Sem deleção. Copy e ícones atualizados.
- **Lista de alunos:** aluno suspenso renderiza com **⊘ + "suspenso" +
  [tornar ativo]**; ativo, normal. "tornar ativo" em capacidade cheia →
  leva ao seletor.

### App — polish da lista (frente paralela, independente do backend)

- **Altura máxima ~6 linhas** no bloco de alunos; acima disso, **scroll interno**
  (evita bloco gigante com 30 alunos de um professor premium).
- **Busca por nome** quando **> 10 alunos**.

---

## Fluxo de dados (downgrade típico)

1. Assinatura do professor expira/cancela → RevenueCat dispara `EXPIRATION` →
   `revenuecat-webhook` grava `subscriptions` (tier=free) → chama
   `sync_coach_student_access(coach_id)`.
2. RPC: limite passou a 2, professor tem 4 ativos → suspende os 2 mais recentes
   (`suspended_at = now()`), mantém os 2 mais antigos.
3. Professor abre o app → banner "2 de 4 suspensos". Aluno suspenso abre o app →
   bootstrap auto-cura (sem mudança) → `/suspended`.
4. Professor faz upgrade → webhook → RPC limpa `suspended_at` de todos → alunos
   reativados no próximo bootstrap.

## Tratamento de erros

- RPC é idempotente: re-execução é segura (rede de segurança nos bootstraps).
- Webhook falho não trava nada: o bootstrap do professor e do aluno re-sincroniza.
- `coach-set-active-students` valida ownership (403) e `role='aluno'` dos alvos
  (404), espelhando `coach-unlink-student`.
- Push de suspensão: **não** é requisito (bloqueio acontece no login). Opcional
  futuro (expo-notifications já existe → OTA-safe).

## Testes

- **RPC (SQL/integração):** premium/grandfather limpam tudo; free suspende
  excedente por antiguidade; idempotência; preserva troca manual; reativa ao
  liberar vaga.
- **Gate do aluno:** suspended → `/suspended`; não-suspended → segue; ordem vs
  consent.
- **escolher-alunos:** envia conjunto de ativos; backend reflete; não deleta.
- **Polish da lista:** scroll acima de 6; filtro acima de 10.
- **E2E manual:** downgrade real (ciclo de teste da Play) → suspensão → upgrade →
  reativação.

## Fora de escopo (YAGNI)

- Aluno virar free por conta própria a partir da tela de suspensão (descartado).
- Modo só-leitura pro aluno suspenso (descartado — bloqueio total).
- Push notification de "você foi suspenso" (opcional futuro).
- Endurecer o gate de `ai_coach` (assunto separado do limite de alunos).

## Sequenciamento

Spec único. Duas frentes:
- **Frente A (suspensão):** migration/RPC → edge functions → gate do aluno →
  UI do professor (banner + escolher-alunos + lista).
- **Frente B (polish da lista):** altura/scroll + filtro. Independente do backend,
  pode ir em paralelo.

Entrega via `supabase db push` + `functions deploy` (backend) e `eas update` (app).
