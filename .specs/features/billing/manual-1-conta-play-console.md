# Manual 1 — Configuração da conta de desenvolvedor Play Console

> Objetivo: ter uma conta de desenvolvedor Google Play **verificada e habilitada
> a receber pagamentos**, com o app `br.com.nutrion` registrado. Sem isso, nada
> de billing roda — nem em teste.
>
> ⚠️ A interface do Play Console muda com frequência. Os **nomes de menu** podem
> variar; o **conceito de cada passo** permanece. Tempo total realista: a parte
> de cliques é ~1h, mas a **verificação de identidade do Google pode levar de 2
> a 7 dias** — comece por isso.

---

## Pré-decisão: tipo de conta (pessoal vs organização)

| | Pessoal | Organização |
|---|---|---|
| Exige | CPF | **D-U-N-S number** (≈ CNPJ) |
| Nome público de dev | Pode ser marca ("Persona Fit") no Google | Nome da empresa |
| Recebimento | Cai no seu CPF | Cai na conta PJ |

**Decisão do projeto (ver README):** começar **pessoal**. No Google dá pra exibir
"Persona Fit" como nome público mesmo em conta pessoal. CNPJ só vira necessário pra
App Store sem expor nome pessoal. ✅

> **Namespace técnico.** A marca exibida é **Persona Fit**, mas o **package é o
> imutável `br.com.nutrion`** e os identificadores técnicos (slug, IDs de produto,
> projeto GCP) seguem o namespace `nutrion`. Não renomeie o package.

---

## Passo 1 — Conta Google dedicada (recomendado)

1. Crie (ou escolha) uma **conta Google só pro projeto** — ex:
   `nutrion.app@gmail.com`. Evite misturar com e-mail pessoal: a conta de dev
   não é transferível com facilidade depois.
2. Ative **verificação em 2 etapas** nessa conta (o Google exige pra dev).

> 💡 Guarde as credenciais num gerenciador. Essa conta vira a dona do app.

## Passo 2 — Criar a conta de desenvolvedor

1. Acesse **https://play.google.com/console** logado na conta do Passo 1.
2. Aceite o **Contrato de Distribuição do Desenvolvedor**.
3. Pague a **taxa única de US$25** (cartão internacional).
4. Escolha **tipo de conta: Pessoal**.

## Passo 3 — Verificação de identidade (o gargalo de tempo)

O Google pede, para contas novas:

1. **Nome legal** + **endereço** (precisa bater com documento).
2. **Documento de identidade** (RG/CNH) — upload de foto.
3. **Número de telefone** (verificação por SMS).
4. **E-mail de contato** verificado.

> ⏳ Após enviar, o status fica "em análise". Pode levar **dias**. Você consegue
> criar o app e mexer em quase tudo enquanto isso, mas **não consegue publicar
> nem finalizar pagamentos** até verificar. Faça isso no dia 1.

## Passo 4 — Perfil de pagamentos (receber dinheiro)

Pra vender assinatura você precisa de um **payments profile / conta de comerciante**:

1. No Play Console: **Configuração → Detalhes de pagamentos** (*Payments settings*).
2. Crie o **perfil de pagamentos do Google** (Google Payments Merchant).
3. Informe:
   - **Conta bancária** pra recebimento (titularidade = a mesma do CPF da conta).
   - **Dados fiscais** (CPF, endereço).
4. O Google pode fazer um **micro-depósito de verificação** na conta bancária —
   confira o valor depois e confirme. Mais alguns dias.

> 🇧🇷 Nota fiscal: o Google é o *merchant of record* (vende em nome próprio e
> repassa pra você). Mesmo assim, o **repasse que cai no seu CPF é renda
> tributável**. Quando o volume crescer, alinhe com contador (IR / MEI / CNPJ).

## Passo 5 — Criar o app

1. **Todos os apps → Criar app**.
2. Preencha:
   - **Nome**: `Persona Fit` (pode trocar depois, mas o
     **package `br.com.nutrion` é imutável**).
   - **Idioma padrão**: Português (Brasil).
   - **App ou jogo**: App. **Gratuito ou pago**: **Gratuito** (a monetização é por
     assinatura in-app, não app pago).
3. Aceite as declarações (políticas, leis de exportação dos EUA).

## Passo 6 — Nome público de desenvolvedor (a marca)

1. **Configuração → Conta de desenvolvedor → Detalhes do desenvolvedor**.
2. Defina o **nome público** que aparece em "Vendido por" → `Persona Fit`.
   (No Google, conta pessoal pode usar nome de marca; a identidade verificada
   fica nos bastidores.)

## Passo 7 — Heads-up sobre publicação (não bloqueia billing, bloqueia lançar)

Contas **pessoais novas** no Google hoje exigem, **antes de liberar produção**:

- **Closed testing** com **no mínimo 12 testers** que ficam **opt-in por 14 dias**.
- Só depois aparece o botão de "solicitar acesso à produção".

> Isso atrasa o **lançamento público**, **não** o desenvolvimento/teste de billing.
> Billing roda em **teste interno** (Manual 2) sem essas 14 dias. Planeje:
> recrute os 12 testers cedo (amigos, alunos beta) pra esse relógio rodar em
> paralelo.

---

## Checklist de saída deste manual

- [ ] Conta Google dedicada com 2FA.
- [ ] Conta de desenvolvedor paga (US$25) e tipo **Pessoal**.
- [ ] Verificação de identidade **enviada** (aguardando ou aprovada).
- [ ] Perfil de pagamentos criado + conta bancária verificada.
- [ ] App `br.com.nutrion` criado, gratuito, PT-BR.
- [ ] Nome público de dev = `Persona Fit`.
- [ ] (Opcional, em paralelo) 12 testers recrutados pro closed testing.

➡️ Com isso pronto, siga pro **[Manual 2 — billing Play Store](./manual-2-billing-play-store.md)**.
