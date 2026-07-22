# Manual 0 — Roteiro mestre (comece por aqui)

> Para quem **nunca publicou um app na Play**. Costura os manuais 1–4 numa **linha do
> tempo**: o que fazer hoje, o que roda em paralelo, e o que depende de quê. Os passos
> detalhados (com nomes de menu) ficam em cada manual; aqui é o **mapa**.
>
> **Divisão de trabalho:**
> - 🧑‍💼 **Você** (operacional): contas, cliques no Play Console/RevenueCat, conta
>   bancária, cartão, recrutar testers, advogado.
> - 🤖 **Claude** (código): SDK no app, edge functions, deploy, testes. Já está tudo
>   pronto e em `develop`, menos o #5b (compra real no app) que executo quando você
>   terminar a Fase 2.

---

## Visão de uma tela só

```
FASE 0 (HOJE — coisas LENTAS, começam o relógio)
  └─ conta Google, conta de dev (US$25), verificação de identidade (2–7 dias),
     conta bancária, recrutar 12 testers, encomendar textos jurídicos

FASE 1 (criar o app + produtos de assinatura)          ── Manual 1 + 2A
FASE 2 (ligar RevenueCat ↔ Google ↔ Supabase)          ── Manual 2 B/C/D
FASE 3 (deploy do backend — VOCÊ roda 3 comandos)      ── eu te guio
FASE 4 (#5b: compra real no app — EU codo)             ── depende da Fase 2
FASE 5 (teste de ponta a ponta, custo zero)            ── Manual 4
FASE 6 (liberar pro público — 12 testers / 14 dias)    ── Manual 1 §7
```

Só a **Fase 5** precisa de tudo pronto. As Fases 0→2 são quase todas **você sozinho**;
a Fase 3 a gente faz junto (você roda, eu fico do lado); a Fase 4 sou eu.

---

## FASE 0 — Hoje (porque é lento, não porque é difícil)

Estas coisas têm **espera externa** (Google analisando, banco confirmando, relógio de
14 dias correndo). Comece **todas hoje** pra esperarem em paralelo enquanto você faz o resto.

1. **Conta Google só do projeto** + 2FA. Ex: `nutrion.app@gmail.com`. Não use seu e-mail
   pessoal — a conta vira dona do app e não troca fácil depois. → *Manual 1, Passo 1*.
2. **Conta de desenvolvedor Play** — pague os **US$25** (taxa única, cartão internacional),
   tipo **Pessoal** (CPF). → *Manual 1, Passos 2–3*.
3. **Verificação de identidade** (RG/CNH, endereço, SMS). **É o gargalo: 2–7 dias.** Envie
   hoje. Você mexe em quase tudo enquanto analisa, mas não publica até aprovar. → *Manual 1, Passo 3*.
4. **Perfil de pagamentos** + **conta bancária** (a que vai receber o dinheiro). O Google
   faz um micro-depósito de confirmação — leva mais alguns dias. → *Manual 1, Passo 4*.
5. **Recrutar 12 testers** (amigos/alunos com conta Google). Conta pessoal nova precisa de
   **12 pessoas no teste fechado por 14 dias** antes de liberar pro público. O relógio só
   começa quando eles entram — quanto antes, melhor. *(Não bloqueia testar billing, só o
   lançamento público.)* → *Manual 1, Passo 7*.
6. **Encomendar os textos jurídicos** (Privacidade, Termos de Uso, Contrato) com um
   advogado, e decidir onde hospedar (um hotsite simples). O app já tem a estrutura de
   aceite pronta — só falta o **texto real** e as **URLs**. → ver "Pendências externas" no fim.

> ✅ Resposta à sua dúvida de dinheiro: o **Google é quem cobra o cliente** (aparece "Google
> Play" na fatura, nunca seu nome). Ele retém a taxa (~10–15%) e **deposita o resto
> automático na sua conta bancária todo mês (~dia 15)**. Sim, sai pra conta normal. É renda
> tributável no seu CPF — quando crescer, alinhe com contador (MEI/CNPJ).

---

## FASE 1 — Criar o app e os produtos de assinatura

Pode fazer já (não espera a verificação terminar).

7. **Criar o app** no Play Console: nome **Persona Fit**, package **`br.com.nutrion`**
   (imutável — não mude), gratuito, PT-BR. → *Manual 1, Passo 5*.
8. **Nome público de dev** = `Persona Fit` (aparece em "Vendido por"). → *Manual 1, Passo 6*.
9. **Criar 3 assinaturas** em Monetizar → Assinaturas, cada uma com base plan **mensal
   auto-renovável** em BRL: → *Manual 2, Parte A*.
   - `nutrion_comum_pro` (comum) · `nutrion_prof_pro` (professor) · `nutrion_prof_premium` (professor)
   - 💡 **Pro teste:** ponha um preço baixo (**~R$ 1,90**) primeiro; ajusta pro preço real
     (R$ 15,90 / R$ 29,90) antes de lançar ao público.
10. **Ficha mínima da loja** + **URL da Política de Privacidade** (o Google exige pra ativar
    produtos). Use a URL do hotsite da Fase 0. → *Manual 2, Parte A3*.

---

## FASE 2 — Ligar RevenueCat ↔ Google ↔ Supabase

Aqui você conecta os três sistemas. É a parte com mais cliques, mas é receita de bolo.

11. **Google Cloud:** criar projeto, habilitar **"Google Play Android Developer API"**,
    criar **Service Account**, baixar o **JSON**, e **convidar o e-mail dela no Play Console**
    com acesso financeiro. ⚠️ A permissão demora **até ~24–36h** pra propagar — é normal o
    RevenueCat reclamar logo após; espere e re-teste. → *Manual 2, Parte B*.
12. **RevenueCat** (app.revenuecat.com, plano free serve): criar projeto **Persona Fit** →
    add app **Play Store** (`br.com.nutrion`) → colar o **JSON** → copiar a **API key pública**
    (começa com `goog_...`, vai no app). → *Manual 2, Parte D*.
13. **Importar os produtos** no RevenueCat e criar os **entitlements**:
    - ⚠️ **CRÍTICO — nomeie os entitlements EXATAMENTE `pro` e `premium`.** O código do
      webhook decide o plano por esse nome; se errar, a compra não libera nada.
      - `pro` ← `nutrion_comum_pro` + `nutrion_prof_pro`
      - `premium` ← `nutrion_prof_premium`
    - **Offerings** (o que o paywall mostra): `comum` e `professor`. → *Manual 2, Parte D 6–7*.
14. **RTDN (notificações em tempo real):** pegar o tópico Pub/Sub que o RevenueCat te dá e
    colar no Play Console (Monetizar → Configuração de monetização). Sem isso, cancelamento/
    renovação demoram a chegar. → *Manual 2, Parte C*.
15. **Webhook RevenueCat → Supabase:** em RevenueCat → Integrations → Webhooks:
    - URL: `https://<PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook`
    - Header de autorização: `Bearer <um segredo que você inventa>` — guarde esse segredo,
      ele vai no Supabase na Fase 3 (`RC_WEBHOOK_SECRET`). → *Manual 2, Parte D8*.

> 💡 **Use seu projeto Supabase de TESTE aqui primeiro** (ref `eqbteqwhovyfwlyvxqrd`). Assim
> você valida a compra inteira sem encostar na produção. Quando estiver tudo verde, troca a
> URL do webhook (e o env do app) pro Supabase de produção e lança. Os segredos do projeto
> de teste **nunca** entram no git — só via `supabase secrets`/`.env`.

---

## FASE 3 — Deploy do backend (você roda, eu acompanho)

Quando a Fase 2 estiver de pé (mesmo que no Supabase de teste), o backend de billing precisa
ir pro ar. São **3 comandos** — me chama que eu fico do lado:

16. `npm run db:push` — sobe as tabelas (`subscriptions`, `legal_*`, trial). Aditivo, não
    apaga nada.
17. `npm run fn:deploy` — sobe as edge functions, incluindo o `revenuecat-webhook`.
18. `supabase secrets set RC_WEBHOOK_SECRET=<o segredo do passo 15>` — pra o webhook conferir
    a autorização.
19. ⚠️ **Smoke-test obrigatório do webhook** logo após o 1º deploy: simular 1 evento e
    conferir que a tabela `subscriptions` atualizou. *(Motivo: o webhook responde "200 OK"
    mesmo se a gravação falhar — pra não irritar o RevenueCat com retries — então uma falha de
    permissão passaria SILENCIOSA. O smoke-test é a rede de segurança. Eu te passo o comando.)*

---

## FASE 4 — Compra real no app (#5b — EU codo)

Depende da Fase 2 pronta (API key `goog_...` + dev build). Eu instalo o SDK
`react-native-purchases`, ligo o botão "Quero assinar" do paywall (hoje é placeholder "em
breve") à compra de verdade, e faço o app atualizar o acesso depois da compra. Plano completo
em `2026-06-22-revenuecat-integration/plan-5b-sdk.md`. **Só me dar o sinal** quando a Fase 2
estiver fechada e eu executo. Vou precisar de um **dev build EAS** (eu gero, você instala no
celular).

---

## FASE 5 — Teste de ponta a ponta (custo ZERO)

→ *Manual 4, §5*. Resumo:

20. Adicionar seu e-mail em **Play Console → Configuração → Teste de licença** (compra de
    teste **não cobra**).
21. Instalar o dev build pela faixa de **teste interno**, logado com esse e-mail.
22. Abrir o app → tocar no upsell → **Assinar** → cartão "**Test card, always approves**".
23. Conferir a cadeia: RevenueCat recebe → webhook grava em `subscriptions` →
    `resolve_entitlement` libera → **IA destrava (sem mais o aviso "seja Pro")**.
24. **Cancelar** pela Play → acesso fica até o fim do ciclo → expira → volta a free (o aviso
    "seja Pro" reaparece). *(Assinaturas de teste renovam/expiram em minutos, não 1 mês.)*

> Quer ver **dinheiro entrando de verdade**? Manual 4, Opção B: base plan de R$ 1,90 + compra
> com **conta real** (não tester), sem cupom. Cupom dá trial grátis/desconto, **não** "pagar
> um valor mínimo". Depois cancela pela loja.

---

## FASE 6 — Liberar pro público

25. Já com os **12 testers / 14 dias** cumpridos (Fase 0), aparece o botão de solicitar
    **acesso à produção**. Aí você troca os preços de teste pelos reais (R$ 15,90 / R$ 29,90),
    aponta o webhook/env pro Supabase de produção, e publica. → *Manual 1, Passo 7*.

---

## O que está 100% pronto (não precisa fazer nada)

Specs #1–#5a estão implementadas, testadas e em `develop`: tabela `subscriptions` +
`resolve_entitlement` (fonte de verdade), gating server-side (402 → "seja Pro"), paywall,
trial de 7 dias automático, aceite de termos no cadastro, downgrade "escolhe quem fica", e o
**webhook** que recebe a compra. Falta só o #5b (Fase 4) e o operacional (este manual).

## Pendências externas (não são código)

- **Textos jurídicos** com advogado + **hotsite** com 3 URLs estáveis. Hoje o app usa
  placeholders (`personafit.app/legal/*`). Trocar pelas URLs reais em `legal_documents` (no
  banco, sem release) e no `app.config.ts` (release).
- **Fiscal**: recebimento cai no CPF agora; MEI/CNPJ quando escalar ou for pra Apple.

---

## Ordem curtíssima (se quiser só a sequência)

`Fase 0 hoje (lentas)` → `criar app + 3 assinaturas` → `GCP+ServiceAccount → RevenueCat
(entitlements pro/premium!) → RTDN → webhook` → `me chamar: db:push + fn:deploy + secret +
smoke-test` → `eu codo o #5b + dev build` → `license tester + comprar com cartão de teste +
ver IA liberar` → `12 testers/14 dias → produção`.
