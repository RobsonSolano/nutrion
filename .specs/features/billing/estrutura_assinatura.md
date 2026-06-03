# Estrutura de Assinatura — NutriOn

> **Documento mestre.** Consolida o planejamento de monetização do NutriOn:
> o que será implementado, planos, como funciona, o que usaremos, passos de
> implementação (com apontamentos pros manuais), documentações/URLs de apoio e
> os pontos jurídicos a salientar (contrato, uso, estorno).
>
> Status: **planejamento aprovado** (2026-06-02). Implementação não iniciada.
> Idioma e convenções seguem o `PROJECT.md`. Fonte detalhada: demais arquivos
> desta pasta (`.specs/features/billing/`).

---

## 1. O que será implementado

Monetização do NutriOn via **assinatura recorrente mensal**, para **usuário comum**
e **professor**, desbloqueando recursos de IA e capacidade de gestão de alunos.

- Cobrança pelo **billing das lojas** (Google Play agora; Apple App Store depois).
- **RevenueCat** como camada unificadora entre lojas (e Stripe-web no futuro).
- **Supabase** como **fonte de verdade** do *entitlement* — quem pode o quê.
- Gating de IA com **dupla camada**: servidor (autoritativo) + UI (upsell "seja Pro").
- Fluxos de **trial de 7 dias**, **migração de ex-aluno** e **downgrade de professor**.
- Infra de **aceite de documentos legais** (termos/contrato/estorno) no cadastro.

> O `PROJECT.md` listava `premium/pagamento` como fora de escopo — esta iniciativa
> abre esse escopo. A migration `20260425120000_ai_quotas.sql` já deixou a
> fundação (`profiles.user_number`, `is_early_adopter`, `ai_usage_log`).

---

## 2. Planos e preços

| Quem | Plano | Preço/mês | Libera |
|------|-------|-----------|--------|
| Comum | Free | R$ 0 | Tudo, **exceto** Chat IA e Sanity Check (mostra "seja Pro") |
| Comum | Pro | R$ 19,90 | Chat IA + Sanity Check |
| Professor | Free | R$ 0 | Até **5** alunos · **sem** IA de coach · alunos **sem** IA |
| Professor | Pro | R$ 19,90 | Até **20** alunos · IA de coach · alunos com Chat+Sanity |
| Professor | Premium | R$ 39,90 | Alunos **ilimitados** + tudo do Pro |

**Regras transversais:**

- **Trial de 7 dias**: todo **comum novo**, todo **ex-aluno desvinculado** e
  **professor** nos planos pagos. **1 trial de servidor por vida** (anti-abuso).
- **Aluno não paga.** A IA do aluno é **herdada do plano do professor**
  (coach Pro/Premium → aluno tem Chat+Sanity; coach Free → aluno sem IA).
- **Early adopters**: os 100 primeiros usuários (`is_early_adopter`) ficam com IA
  **grátis pra sempre** (goodwill já registrado no schema).
- **Gating de IA pro comum free**: somente **Chat IA** e **Sanity Check**.
  Onboarding com IA e push contextual continuam **grátis** (preserva ativação 60s).
- **"IA do professor"** = `coach-generate-plan` e `coach-import-workout-ai`
  (gerar/importar treino com IA ao cadastrar/editar aluno).

---

## 3. Como funciona (arquitetura)

### 3.1 Fonte de verdade — `subscriptions` + `resolve_entitlement`

O app **nunca** pergunta "comprou na loja?". Ele pergunta a uma RPC do Supabase:
*"o que esse usuário pode fazer agora?"*.

```
subscriptions (user_id PK → profiles.id)
  tier            free | pro | premium          -- premium só pra professor
  source          store_play | store_apple | stripe | server_trial | grandfather
  status          active | in_trial | canceled | expired
  trial_end       timestamptz   -- só pra source = server_trial
  period_end      timestamptz   -- vem da loja via RevenueCat
  rc_app_user_id  text          -- id no RevenueCat (= profiles.id)
  trial_consumed  boolean       -- 1 trial de servidor por vida
```

`resolve_entitlement(user)` decide:

| Role | IA pessoal (chat+sanity) | IA de coach | Limite de alunos |
|------|--------------------------|-------------|------------------|
| `comum` | `pro` OU trial ativo OU grandfather | — | — |
| `aluno` | **herdado do coach** | — | — |
| `professor` | tier (pro/premium) OU grandfather | `pro`/`premium` | free=5 · pro=20 · premium=∞ |

### 3.2 Caminho do dado

```
App (RevenueCat SDK) → compra na Play/Apple
RevenueCat ─webhook→ edge `revenuecat-webhook` → upsert subscriptions
Trial de servidor (comum novo / ex-aluno) → edge grava source=server_trial (sem loja)
App lê resolve_entitlement → libera/bloqueia IA
```

### 3.3 Dois tipos de trial (não confundir)

- **Trial de servidor** (comum novo, ex-aluno): grant no Supabase, **sem cartão,
  sem loja**. `source=server_trial`, `trial_end=now+7d`, `trial_consumed=true`.
- **Free-trial offer da loja**: oferta opcional configurada na Play Console pra
  quem vai de fato assinar. Não é obrigatória pro MVP.

### 3.4 Gating em dupla camada

1. **Servidor (autoritativo)**: edge functions de IA chamam `resolve_entitlement`
   antes de gastar token → sem direito retorna `402 { error: 'needs_upgrade' }`.
2. **UI (experiência)**: troca o botão de IA pelo upsell "✨ seja Pro".

### 3.5 Fluxos especiais

- **Ex-aluno desvinculado**: `coach-unlink-student` (já existe) passa a conceder o
  trial e disparar o comunicado "sua conta virou individual + ganhou 7 dias".
- **Downgrade do professor com excedente**: tela "escolha quem fica" até o novo
  limite; não-escolhidos passam pelo `coach-unlink-student` → cada um vira comum
  com trial.

---

## 4. O que vamos utilizar (stack de billing)

| Camada | Ferramenta | Papel |
|--------|-----------|-------|
| Loja Android | **Google Play Billing** | Cobrança/renovação/merchant of record |
| Loja iOS (futuro) | **Apple StoreKit / IAP** | Idem, quando lançar na App Store |
| Unificador | **RevenueCat** (`react-native-purchases`) | SDK único, entitlements, webhook |
| Backend | **Supabase** (Postgres + Edge Functions) | Fonte de verdade, gating, webhook |
| App | **Expo SDK 54 + dev-client + EAS** | Build nativo (RevenueCat exige dev build) |
| Futuro web | **Stripe** (via RevenueCat) | Assinatura web, mesmo webhook, zero refator |

**Por que não Stripe direto agora:** desbloquear funcionalidade digital (IA)
dentro do app obriga billing da loja (Google e Apple). Stripe in-app → risco de
remoção. Stripe entra só pra venda **web** no futuro, pelo mesmo `subscriptions`.

---

## 5. Passos para implementação

A iniciativa é decomposta em **5 specs** (cada uma com seu ciclo: spec → seed →
commits divididos → db:push → fn:deploy → eas update preview → merge → docs).
**Só a #5 depende da Play Console.**

| # | Spec | Entrega | Play Console? |
|---|------|---------|---------------|
| 1 | `billing-core` | Tabela `subscriptions`, RPC `resolve_entitlement`, gating server-side nas edge de IA, honra grandfather | ❌ |
| 2 | `paywall-ui` | Leitura de entitlement no app, telas "seja Pro", matriz de planos | ❌ |
| 3 | `trial-e-migracao` | Trial de servidor, fluxo ex-aluno (`coach-unlink-student`), downgrade "escolhe quem fica" | ❌ |
| 4 | `legal-docs` | `legal_documents` + `legal_acceptances`, aceite no cadastro, telas dos docs | ❌ |
| 5 | `revenuecat-integration` | SDK no app, edge `revenuecat-webhook`, produtos, compra real | ✅ (teste interno basta) |

### Manuais operacionais (passo a passo de configuração)

| Manual | Cobre |
|--------|-------|
| [`manual-1-conta-play-console.md`](./manual-1-conta-play-console.md) | Criar/verificar conta de dev, perfil de pagamentos, criar app `br.com.nutrion` |
| [`manual-2-billing-play-store.md`](./manual-2-billing-play-store.md) | Produtos de assinatura, Service Account, RTDN/Pub-Sub, RevenueCat, testers |
| [`manual-3-implementacao-assinatura-app.md`](./manual-3-implementacao-assinatura-app.md) | SDK no app, hooks, gating UI, edge `revenuecat-webhook`, roteiro de teste |

### Ordem recomendada

1. Construir **`billing-core`** (destrava todo o gating, sem depender de loja).
2. **`paywall-ui`** + **`trial-e-migracao`** + **`legal-docs`** (testáveis sem loja).
3. Em paralelo: **Manual 1** (verificação do Google leva dias — começar cedo) e
   recrutar **12 testers** (relógio dos 14 dias do closed testing).
4. **Manual 2** quando houver um AAB em teste interno.
5. **`revenuecat-integration`** (Manual 3) por último, fechando o ciclo real.

---

## 6. Documentações e URLs de apoio

| Tema | URL |
|------|-----|
| RevenueCat — docs | https://www.revenuecat.com/docs |
| RevenueCat — Expo / React Native | https://www.revenuecat.com/docs/getting-started/installation/reactnative |
| `react-native-purchases` (SDK) | https://github.com/RevenueCat/react-native-purchases |
| RevenueCat — webhooks | https://www.revenuecat.com/docs/integrations/webhooks |
| RevenueCat — Google Play Service Account | https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials |
| Google Play Billing — overview | https://developer.android.com/google/play/billing |
| Play Console — assinaturas | https://support.google.com/googleplay/android-developer/answer/140504 |
| Google Play — política de pagamentos | https://support.google.com/googleplay/android-developer/answer/10281818 |
| Google — RTDN (Real-time Developer Notifications) | https://developer.android.com/google/play/billing/rtdn-reference |
| Apple — App Store Review Guidelines (3.1 pagamentos) | https://developer.apple.com/app-store/review/guidelines/#in-app-purchase |
| Apple — D-U-N-S (conta Organization) | https://developer.apple.com/support/D-U-N-S/ |
| Expo — dev builds (EAS) | https://docs.expo.dev/develop/development-builds/introduction/ |
| CDC art. 49 — direito de arrependimento | http://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm |

---

## 7. Pontos a salientar nos documentos legais

> ⚠️ **Não substitui validação jurídica.** A infra de aceite/versionamento entra
> na spec `legal-docs`; o **conteúdo** abaixo é um checklist de tópicos a cobrir,
> a ser redigido/validado com advogado. Tudo em PT-BR, com versionamento e registro
> de aceite (`legal_documents` + `legal_acceptances`).

### 7.1 Termos de Uso (todos os usuários, free incluso)

- **Natureza informativa**: o app e a IA **não substituem** profissional de saúde
  (já é princípio do `PROJECT.md`) — orientações são informativas.
- **Elegibilidade**: idade mínima; veracidade dos dados.
- **Conta e segurança**: responsabilidade pelas credenciais; uso individual.
- **Conduta**: vedações de uso indevido, scraping, engenharia reversa.
- **Conteúdo gerado por IA**: limitações, possibilidade de erro, sem garantia de
  resultado de saúde/estética.
- **Papel professor↔aluno**: o que o professor vê do aluno; privacidade do aluno;
  o que acontece ao desvincular (conta vira individual + comunicado + trial).
- **Propriedade intelectual**: do app, do catálogo de exercícios (créditos
  free-exercise-db CC0), e dos dados do usuário.
- **Privacidade/LGPD**: link à política; tratamento de dados; **exclusão de conta**
  (já implementada) e exportação (direito LGPD).
- **Alterações dos termos**: como são comunicadas; novo aceite por versão.
- **Limitação de responsabilidade** e **legislação/foro** (Brasil).

### 7.2 Termos de Contrato (assinatura paga)

- **Objeto**: licença de uso do plano pago (Pro/Premium) e seus recursos.
- **Preço e periodicidade**: valores mensais (R$ 19,90 / R$ 39,90), em BRL,
  **renovação automática** mensal até cancelamento.
- **Vendedor / cobrança**: deixar claro que a **cobrança é processada pela loja**
  (Google Play / Apple) como *merchant of record*; o nome na fatura é o da loja.
- **Trial de 7 dias**: condições, que **não há cobrança** durante o trial, que
  após o período sem assinatura volta ao **Free**, e que é **1 trial por usuário**.
- **Planos de professor**: limites de alunos por plano; o que ocorre no
  **downgrade** (professor escolhe quem fica; excedentes desvinculados); efeito
  sobre a IA dos alunos (herdada do plano).
- **Cancelamento**: como cancelar (**pela loja**: Play Store / App Store), e que o
  acesso **permanece até o fim do período** já pago (sem corte imediato).
- **Reajuste de preço**: como eventuais reajustes são comunicados e aceitos.
- **Suspensão/encerramento** por violação dos termos.
- **Legislação aplicável e foro** (Brasil) e relação com o CDC.

### 7.3 Política de Estorno / Reembolso

- **Compras pela loja seguem a política da loja**: reembolsos de Google Play e
  Apple são processados **por elas** — direcionar o usuário aos canais da loja.
- **Direito de arrependimento (CDC art. 49)**: compra digital online dá **7 dias**
  para desistência com devolução; descrever como exercer e a interação com o fluxo
  de reembolso da loja.
- **Trial não gera cobrança** → não há o que reembolsar no período de trial.
- **Sem reembolso proporcional** de período em andamento (padrão das lojas): ao
  cancelar, mantém-se o acesso até o fim do ciclo já pago, sem devolução pro-rata —
  **deixar isso explícito** pra evitar disputa.
- **Cobrança indevida / duplicidade**: canal de contato e prazo de resposta.
- **Como solicitar**: passo a passo (loja + contato de suporte do app) e dados
  necessários.

---

## 8. Pendências fora de código

- **Conteúdo jurídico** dos 3 documentos (seção 7) — redação + validação advogado.
- **Burocracia fiscal**: recebimento PF (CPF) agora; avaliar MEI/CNPJ ao escalar e
  obrigatoriamente para conta **Organization** da Apple (ocultar nome pessoal).
- **Verificação Google** (identidade + perfil de pagamentos) — leva dias, começar cedo.
- **12 testers / 14 dias** de closed testing antes de liberar produção (conta pessoal nova).

---

## 9. Arquivos desta pasta

- [`README.md`](./README.md) — índice/resumo do desenho aprovado.
- [`manual-1-conta-play-console.md`](./manual-1-conta-play-console.md)
- [`manual-2-billing-play-store.md`](./manual-2-billing-play-store.md)
- [`manual-3-implementacao-assinatura-app.md`](./manual-3-implementacao-assinatura-app.md)
- **`estrutura_assinatura.md`** — este documento mestre.
