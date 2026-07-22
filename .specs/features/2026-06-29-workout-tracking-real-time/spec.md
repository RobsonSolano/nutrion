# Spec — Cronômetro de treino em tempo real

> IDs `[WT]-NN`. Critérios em QUANDO/ENTÃO (cada um vira teste nomeado quando há
> lógica pura). Decisões em `context.md`. Entrega **OTA** (sem migration, sem nativo).

## User story

Como usuário, quero iniciar um cronômetro ao começar um treino, pausar/parar, e
salvar o treino do dia com o tempo gasto — sem perder o tempo se eu bloquear a tela,
e sendo avisado se eu esquecer o cronômetro rodando.

## Requisitos

### Iniciar e cronometrar

- **[WT]-01 — Iniciar a partir da rotina.** Na aba Treinos (e no detalhe da rotina),
  cada rotina tem ação "Iniciar treino".
  - QUANDO toco "Iniciar treino" numa rotina ENTÃO abre a tela de cronômetro ativo com
    o nome daquela rotina e o tempo em `00:00:00`, já contando.
  - QUANDO já existe um treino ativo ENTÃO "Iniciar treino" em qualquer rotina leva à
    tela do treino em andamento (não inicia um segundo) — **um treino ativo por vez**.

- **[WT]-02 — Controles do cronômetro.** A tela mostra `HH:MM:SS` e botões.
  - QUANDO está rodando ENTÃO vejo "Pausar" e "Parar".
  - QUANDO toco "Pausar" ENTÃO o tempo congela e vejo "Retomar" e "Parar".
  - QUANDO toco "Retomar" ENTÃO o tempo volta a contar de onde parou.

- **[WT]-03 — Tempo por timestamps.** O decorrido = `accumulatedMs + (rodando ? now -
  runningSince : 0)`.
  - QUANDO bloqueio a tela / mando o app pro background por X tempo e volto ENTÃO o
    cronômetro reflete o tempo real decorrido (continuou "rolando"), sem pausar.

- **[WT]-04 — Parar e resumo.**
  - QUANDO toco "Parar" ENTÃO vejo o resumo "Treino {nome} — {HH:MM:SS}" com os botões
    "Salvar treino de hoje" e "Descartar".

- **[WT]-05 — Salvar treino do dia.**
  - QUANDO toco "Salvar treino de hoje" ENTÃO cria uma `workout_session` com
    `routine_id`, `routine_name`, `day = hoje`, `duration_min = round(elapsedSec/60)`,
    e o estado ativo é limpo (AsyncStorage + notificações canceladas).
  - ENTÃO a sessão aparece em "Feitos hoje" (invalida `todaySessions` e `weeklyActivity`).
  - QUANDO `elapsedSec < 60` (treino < 1 min) ENTÃO `duration_min = 1` (não salva 0).

### Tela bloqueada / notificação contínua

- **[WT]-06 — Notificação contínua (OTA).**
  - QUANDO inicio um treino ENTÃO aparece uma notificação fixa (sticky/ongoing)
    "Treino em andamento — desde HH:MM".
  - QUANDO toco a notificação ENTÃO o app abre na tela do cronômetro ativo.
  - QUANDO paro / salvo / descarto ENTÃO a notificação some.
  - NOTA: a notificação **não** mostra segundos rolando (limite OTA); o HH:MM:SS ao
    vivo é dentro do app. Widget nativo rolando = incremento futuro (build).

### Sessão pendente (app fechado)

- **[WT]-07 — Persistência do treino ativo.** O estado (`routineId`, `routineName`,
  `startedAt`, `accumulatedMs`, `runningSince`, `status`, `day`, `lastSeenAt`) é
  persistido em AsyncStorage a cada mudança e via heartbeat enquanto roda.

- **[WT]-08 — Fechar o app pausa e deixa pendente.**
  - QUANDO o app é **morto** com um treino ativo ENTÃO na próxima abertura a frio o
    treino é tratado como **pendente** (não some).

- **[WT]-09 — Modal de recuperação.**
  - QUANDO abro o app e existe um treino pendente ENTÃO vejo um modal "Último treino
    não foi finalizado — verifique o registro" mostrando: **nome do treino**, **dia do
    treino**, **tempo total `HH:MM:SS`** (congelado no último `lastSeenAt`), e os botões
    **Salvar**, **Ajustar**, **Remover**.

- **[WT]-10 — Ajustar.**
  - QUANDO toco "Ajustar" ENTÃO habilita campos editáveis de **duração (horas +
    minutos)** e de **dia do treino**, pra salvar no dia correto.
  - QUANDO confirmo o ajuste ENTÃO salva a `workout_session` com a duração e o `day`
    informados.

- **[WT]-11 — Salvar / Remover (modal).**
  - QUANDO toco "Salvar" ENTÃO cria a `workout_session` com o tempo congelado e `day` do
    pendente, limpa o estado e fecha o modal.
  - QUANDO toco "Remover" ENTÃO descarta o pendente sem salvar (limpa estado +
    notificações), e fecha o modal.

### Push de tempo excedido

- **[WT]-12 — Aviso local de 2h.**
  - QUANDO inicio um treino ENTÃO agenda uma notificação local pra `startedAt + 2h`:
    "Seu treino ainda está cronometrando ⏱️ — esqueceu de finalizar?".
  - QUANDO paro / salvo / descarto antes de 2h ENTÃO a notificação agendada é cancelada.

## Lógica pura testável (TDD)

- `elapsedMs(state, now)` → ms decorridos a partir do estado (running/paused).
- `formatHMS(ms)` → `"HH:MM:SS"`.
- `msToMinutes(ms)` → minutos arredondados, mínimo 1.
- Transições: `start()`, `pause(state,now)`, `resume(state,now)`, `freezeForPending(state)`.
- `isPending(state)` → há treino ativo persistido na abertura a frio.

## Critérios de aceite globais

- Nenhuma migration; nenhuma dependência nativa nova. Tudo OTA.
- Não introduz erro/warn novo de lint; `typecheck` verde.
- `workout_sessions` continua sendo a fonte de verdade do "treino feito no dia".
