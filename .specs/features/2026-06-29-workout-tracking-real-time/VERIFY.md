# VERIFY — Cronômetro de treino (UAT no device)

> Feature 100% OTA (sem migration, sem nativo). Rodar num **dev build / preview**
> (push local não funciona no Expo Go). Marcar cada item.

## Automático (já verde)
- [x] `npm test` — 10/10 (lógica pura do timer).
- [x] `npx tsc --noEmit` — sem erros.
- [x] lint dos arquivos tocados — 0 novo (1 warning pré-existente em treino.tsx).

## Manual (device)

### Fluxo feliz
- [ ] **[WT]-01** Aba Treinos → botão ▶ numa rotina (ou detalhe → "Iniciar treino") abre o cronômetro contando.
- [ ] **[WT]-02** Pausar congela; Retomar volta a contar; o tempo soma certo.
- [ ] **[WT]-04/05** Parar → resumo "Treino X — HH:MM:SS" → "Salvar treino de hoje" cria a sessão e ela aparece em "Feitos hoje" (com a duração).
- [ ] **[WT]-01** Com um treino ativo, tocar ▶ noutra rotina **leva ao mesmo** cronômetro (não inicia outro).

### Tela bloqueada / tempo rolando
- [ ] **[WT]-03** Inicia, bloqueia a tela ~1min, volta → o tempo reflete o real (continuou "rolando").
- [ ] **[WT]-06** Com treino ativo, aparece a notificação fixa "Treino em andamento desde HH:MM"; tocar abre o cronômetro; some ao parar/salvar/descartar.

### Sessão pendente (app morto)
- [ ] **[WT]-08/09** Inicia treino → **mata o app** (swipe) → reabre → modal "Último treino não foi finalizado" com nome, dia e tempo total (congelado).
- [ ] **[WT]-11** "Salvar" cria a sessão; some o modal.
- [ ] **[WT]-10** "Ajustar" habilita horas/minutos + dia; salvar grava no dia/duração informados.
- [ ] **[WT]-11** "Remover" descarta sem salvar.

### Push de 2h (opcional — espera longa)
- [ ] **[WT]-12** Treino rodando por 2h sem finalizar → chega a notificação local "ainda está cronometrando". (Para testar rápido, dá pra baixar o limite temporariamente no código.)

## Notas
- Sem permissão de notificação: ongoing/2h não aparecem, mas o cronômetro in-app funciona igual (graceful).
- Widget nativo rolando na lock screen = **não** está nesta entrega (precisa build) — aqui é notificação estática.
