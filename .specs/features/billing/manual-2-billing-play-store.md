# Manual 2 — Configuração do billing na Play Store + RevenueCat

> Objetivo: ter os **produtos de assinatura** criados na Play Console, a **Service
> Account** ligando RevenueCat ↔ Google, as **notificações em tempo real (RTDN)**
> e os **testers** prontos — de forma que uma compra de teste no app caia como
> evento no RevenueCat e vire linha em `subscriptions` no Supabase.
>
> Pré-requisitos: **Manual 1 concluído** + um **AAB já subido em teste interno**
> contendo o SDK de billing (o RevenueCat precisa de um build com a Billing Library
> publicado em alguma trilha — ver Manual 3, passo de build).

---

## Visão do encadeamento

```
Play Console (produtos + Service Account + RTDN)
        │
        ▼
RevenueCat (lê produtos via Google Play Developer API, recebe RTDN)
        │ webhook
        ▼
Supabase edge `revenuecat-webhook` → upsert subscriptions
```

---

## Parte A — Produtos de assinatura na Play Console

### A1. Onde

**Monetizar → Produtos → Assinaturas** (*Monetize → Subscriptions*).
São **assinaturas** (subscriptions), **não** "produtos in-app" (one-time).

### A2. Criar as 3 assinaturas

Sugestão de IDs (imutáveis depois de criados — escolha com cuidado). Seguem o
**namespace técnico `nutrion`** (mesmo do package `br.com.nutrion`), mesmo a marca
exibida sendo **Persona Fit**:

| Subscription ID | Quem | Preço base |
|---|---|---|
| `nutrion_comum_pro` | Usuário comum Pro | R$ 15,90 |
| `nutrion_prof_pro` | Professor Pro | R$ 15,90 |
| `nutrion_prof_premium` | Professor Premium | R$ 29,90 |

Para **cada** assinatura:

1. **Base plan** (plano base):
   - ID: ex. `mensal`.
   - Tipo: **Auto-renovável** (*auto-renewing*).
   - Período de cobrança: **Mensal (P1M)**.
   - Preço: defina em **BRL**; o Google calcula os demais países (pode desativar
     outros países por ora e deixar só Brasil).
2. **Oferta de trial (opcional na loja)**:
   - Você **pode** criar uma *offer* de **7 dias grátis** (free trial) no base plan.
   - ⚠️ Mas lembre da decisão: o **trial de 7 dias automático do comum/ex-aluno é
     de servidor** (sem cartão, sem loja). A oferta de trial da loja é um
     *bônus opcional* pra quem vai de fato assinar. Não é obrigatória pro MVP.
3. **Ativar** o base plan.

> 💡 Não crie planos anuais agora (YAGNI). Tudo mensal, como definido.

### A4. Cupons / códigos promocionais (opcional)

A Play Store oferece dois mecanismos de "cupom", ambos **sem mudança no app/backend**
(o resgate vira uma compra normal → webhook → `subscriptions`):

- **Promo codes**: **Monetizar → Códigos promocionais**. Códigos avulsos de resgate
  (quantidade limitada por trimestre). Bom pra cortesias/influencers.
- **Offer codes / ofertas promocionais**: ofertas vinculadas ao base plan (ex: 1º
  mês grátis, X% por N meses), resgatáveis por código. Integráveis via RevenueCat
  (Offerings/Promotional Offers).

> Confirmar limites e disponibilidade na conta no momento da spec #5. Cupom
> **server-side** (grant sem loja) não é coberto aqui — exigiria `source='promo'`
> em `subscriptions` (fora do escopo atual).

### A3. Ficha da loja mínima

O Google às vezes exige a ficha do app preenchida (descrição, ícone, screenshots,
política de privacidade) pra **ativar** produtos. Tenha o link da **Política de
Privacidade** à mão (vocês já tratam LGPD — reaproveite/adapte).

---

## Parte B — Service Account (RevenueCat ↔ Google Play Developer API)

O RevenueCat precisa **validar compras** e **ler o status** das assinaturas. Isso
é feito por uma **conta de serviço** do Google Cloud com permissão na Play Console.

### B1. Habilitar a API

1. Acesse **https://console.cloud.google.com** (mesma conta Google).
2. Crie/selecione um projeto (ex: `nutrion-billing`).
3. **APIs e Serviços → Biblioteca** → habilite **"Google Play Android Developer API"**.

### B2. Criar a Service Account

1. **IAM e Admin → Contas de serviço → Criar conta de serviço**.
2. Nome: `revenuecat-play`. Não precisa conceder papéis do Cloud aqui (a permissão
   real é dada na Play Console).
3. Abra a conta criada → **Chaves → Adicionar chave → Criar nova chave → JSON**.
4. Baixe o **arquivo JSON** (guarde com segurança — é credencial).

### B3. Dar acesso à Service Account na Play Console

1. No **Play Console → Usuários e permissões → Convidar usuário**.
2. Convide o **e-mail da service account** (algo como
   `revenuecat-play@nutrion-billing.iam.gserviceaccount.com`).
3. Permissões de conta — conceda **acesso financeiro / ver dados financeiros** e
   **gerenciar pedidos e assinaturas** (o RevenueCat documenta o conjunto mínimo;
   conceder "Ver app financeiro" + "Gerenciar pedidos" cobre).
4. Salve. A propagação da permissão pode levar **até ~24–36h** (é normal o
   RevenueCat reclamar de permissão logo após — espere e re-teste).

### B4. Subir o JSON no RevenueCat

(Detalhado na Parte D — é onde o arquivo JSON é colado.)

---

## Parte C — Notificações em tempo real (RTDN via Pub/Sub)

Sem RTDN, o RevenueCat só sabe de mudanças quando o app abre. Com RTDN, renovações,
cancelamentos e expirações chegam **na hora** — essencial pra `subscriptions`
ficar correta.

1. No **RevenueCat**, ao configurar o app Android (Parte D), ele te dá um
   **nome de tópico do Pub/Sub** (algo como
   `projects/revenuecat/topics/...` ou um tópico que você cria e compartilha).
2. No **Play Console → Monetizar → Configuração de monetização** (*Monetization
   setup*) → campo **"Tópico do Cloud Pub/Sub para notificações em tempo real"**.
3. Cole o nome do tópico fornecido pelo RevenueCat e salve.
4. Use o botão **"Enviar mensagem de teste"** (se disponível) pra validar.

---

## Parte D — Configurar o app Android no RevenueCat

1. Crie conta em **https://app.revenuecat.com** (free tier cobre o início).
2. **Create new project** → `Persona Fit`.
3. **Add app → Play Store**:
   - **Package name**: `br.com.nutrion`.
   - **Service Account credentials JSON**: cole o conteúdo do JSON do passo B2.
4. **Pegue a API key pública do Android** (*Public app-specific API key* — começa
   com `goog_...`). Vai no app (Manual 3).
5. **Importar produtos**: RevenueCat → **Products** → importe/declare
   `nutrion_comum_pro:mensal`, `nutrion_prof_pro:mensal`,
   `nutrion_prof_premium:mensal`.
6. **Entitlements** (o "direito" abstrato que o app consulta):
   - `pro` → vinculado a `nutrion_comum_pro` **e** `nutrion_prof_pro`.
   - `premium` → vinculado a `nutrion_prof_premium`.
   > O app pergunta "tem entitlement X?", não "comprou produto Y" — facilita trocar
   > preço/produto depois.
7. **Offerings** (o que o paywall mostra):
   - Offering `comum` → package mensal de `nutrion_comum_pro`.
   - Offering `professor` → packages de `nutrion_prof_pro` e `nutrion_prof_premium`.
8. **Webhook** (RevenueCat → Supabase):
   - **Project settings → Integrations → Webhooks → Add**.
   - URL: `https://<seu-ref>.supabase.co/functions/v1/revenuecat-webhook`.
   - **Authorization header**: defina um segredo (ex: `Bearer <RC_WEBHOOK_SECRET>`)
     que a edge function vai conferir.
   - (A edge function em si é criada no Manual 3 / spec `revenuecat-integration`.)

---

## Parte E — Testers (compra sem cobrança real)

1. **License testers** (não cobram de verdade):
   - **Play Console → Configuração → Teste de licença** (*License testing*).
   - Adicione os **e-mails Google** dos testers (inclua o seu).
2. **Trilha de teste interno**:
   - **Teste → Teste interno → Criar versão** → suba o AAB (Manual 3) → adicione
     os testers à lista → compartilhe o **link de opt-in**.
3. No dispositivo do tester: instalar pelo link de teste interno, logado com o
   e-mail cadastrado. Compras aparecem como **"Test card, always approves"** —
   sem dinheiro real.

> 🔁 Renovação acelerada em teste: assinaturas de teste renovam em **minutos** (não
> 1 mês) e expiram rápido — ótimo pra testar o ciclo renovação/cancelamento/RTDN.

---

## Checklist de saída deste manual

- [ ] 3 assinaturas criadas e **ativas** (`comum_pro`, `prof_pro`, `prof_premium`),
      base plan mensal em BRL.
- [ ] Service Account criada, JSON baixado, convidada na Play Console com acesso
      financeiro (propagação concluída).
- [ ] Google Play Developer API habilitada.
- [ ] RTDN (tópico Pub/Sub do RevenueCat) configurado na monetização.
- [ ] App Android no RevenueCat com o JSON, produtos importados, entitlements
      `pro`/`premium` e offerings `comum`/`professor`.
- [ ] Webhook do RevenueCat apontando pra `…/functions/v1/revenuecat-webhook` com
      header secreto.
- [ ] License testers + trilha de teste interno com AAB subido.

➡️ Implementação no app: **[Manual 3](./manual-3-implementacao-assinatura-app.md)**.
