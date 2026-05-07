# Investigação: MFIT Personal

> Relatório de inteligência competitiva sobre o **MFIT Personal** — principal
> app brasileiro para personal trainers — com ênfase em lições aplicáveis ao
> NutriOn (especialmente Área do Professor).
>
> Data da pesquisa: 2026-05-07. Fontes citadas inline. Tudo fora de citação
> direta foi inferido a partir das fontes; itens não-confirmados estão
> marcados `[não confirmado]` ou `[especulação]`.

---

## 1. Visão geral e posicionamento

| Item | Valor |
|------|-------|
| Nome do produto | MFIT Personal (app); MFIT Pay / Carteira MFIT (financeiro) |
| Empresa | MFIT PERSONAL APP LTDA |
| CNPJ | 32.597.365/0001-31 |
| Sede | Rua Dr. Pedro Ferreira, 333, 25º andar, Centro — Itajaí/SC |
| Fundador / CEO | Marcel Caferati |
| Ano de fundação (ideação) | 2014 (TCC do Marcel) |
| Constituição da empresa | 24/01/2019 |
| Lançamento como startup | 2018 |
| Crescimento documentado | +252 % nos primeiros 2 anos (Noticenter) |
| Personal trainers (autodeclarado) | "mais de 200 mil" |
| Alunos (autodeclarado) | "cerca de 5 milhões" |
| Países atendidos | "mais de 30" |
| Posicionamento | "O melhor aplicativo para personal trainer" — gestão completa da carreira |

Fontes:
- https://www.mfitpersonal.com.br/pages/mfit.html
- https://www.econodata.com.br/consulta-empresa/32597365000131-MFIT-PERSONAL-APP-LTDA
- https://www.situacaocadastral.info/cnpj/mfit-personal-app-ltda-32597365000131
- https://www.noticenter.com.br/n.php?ID=26950&T=mfit-personal-completa-dois-anos-com-crescimento-de-252

**Síntese:** Empresa nascida de TCC, de Itajaí/SC, foco PT autônomo (não
academia). Cresceu rápido (252 % em 2 anos), virou referência. Os números
de "200 k personals + 5 M alunos + 30 países" são autodeclarados — o blog
e o material de imprensa repetem o mesmo. `[não confirmado por fonte
independente]`

---

## 2. Modelo de negócio

### 2.1 Pricing (assinatura paga pelo personal)

| Plano | Preço | Pagamento aceito |
|-------|-------|------------------|
| Até 3 alunos | **R$ 10,90/mês** | Cartão, Carteira MFIT |
| Ilimitado (mensal) | **R$ 39,90/mês** | Cartão, Pix, Carteira MFIT |
| Ilimitado (trimestral) | R$ 119,00 | Cartão, Pix, boleto, Carteira MFIT |
| Ilimitado (semestral) | R$ 215,90 | Cartão, Pix, boleto, Carteira MFIT |
| Ilimitado (anual) | R$ 406,90 | Cartão, Pix, boleto, Carteira MFIT |

**Preço por mês no anual:** R$ 33,90 (≈15 % off vs mensal).

**Trial:** 10 dias grátis, sem cartão.

> O App Store mostra um plano "R$ 12,90/mês" como compra dentro do app — `[não
> confirmado]` se é o mesmo plano de 3 alunos com markup do iOS, ou plano
> diferente. Provavelmente é o plano de 3 alunos com a taxa da Apple.

Fontes:
- https://blog.mfitpersonal.com.br/duvidas-frequentes-sobre-o-app-mfit-personal/
- https://apps.apple.com/br/app/mfit-personal/id1283273690

### 2.2 Carteira MFIT (segundo revenue stream)

Sistema de cobrança embutido no app. Personal habilita, aluno paga as mensalidades dele direto na MFIT, MFIT repassa pro personal.

**Taxas (cobradas do personal sobre o valor recebido):**

| Método | Prazo de recebimento | Taxa |
|--------|---------------------|------|
| Pix | 1 dia útil | **2,59 %** |
| Boleto | até 3 dias úteis | **R$ 3,90 fixo** |
| Cartão (D+15) | até 15 dias corridos | **4,99 % + R$ 1,00** |
| Cartão (D+30) | até 30 dias corridos | **3,99 % + R$ 0,50** |

**Ponto-chave:** "mesmo se o aluno parcelar, o personal recebe o valor total
de uma vez". Trade-off é a taxa de antecipação embutida.

Cadastro na carteira passa por aprovação do operador externo (até 3 dias úteis).

Fonte: https://blog.mfitpersonal.com.br/carteira-mfit/

### 2.3 Estrutura de receita

A receita do MFIT vem de duas fontes:
1. **Assinatura SaaS** (R$ 10,90 a R$ 406,90 — paga pelo personal)
2. **Spread financeiro** sobre as transações da Carteira MFIT (∼2,6 %–5 %)

Fonte 2 é proporcional ao GMV de cada personal e provavelmente é mais
relevante na economia da MFIT que a SaaS — `[especulação]`, mas explica o
preço de entrada baixíssimo (R$ 10,90 não cobre custo de aquisição em
muitos casos; a Carteira sim).

---

## 3. Funcionalidades (lado professor)

### 3.1 Cadastro de alunos

- Personal preenche **nome + email** do aluno.
- Aluno recebe credenciais por email, baixa o app e seleciona "sou aluno".
- Alternativa: link compartilhável por treino.
- **Sem onboarding pelo aluno** (igual ao NutriOn — o personal preenche).
- Limite por plano: 3 (entry) ou ilimitado (R$ 39,90+).

Fonte: https://blog.mfitpersonal.com.br/duvidas-frequentes-sobre-o-app-mfit-personal/

### 3.2 Biblioteca de exercícios

| Origem do número | Quantidade |
|------------------|-----------|
| Site oficial home | 1.800+ vídeos |
| App Store | 1.800+ |
| `prescricaodetreinos.mfit.app` | "mais de 1.000" |
| `aplicativo.mfit.app` | "mais de 600" |

Discrepância entre páginas. **Provável**: 1.800 é o número atualizado;
páginas de produto mais antigas mostram 600/1000.

Recursos:
- Vídeos demonstrativos por exercício.
- Personal pode subir vídeos próprios, GIFs ou imagens.
- "Combinação" de exercícios (multi-select + função "Combinar").

**Comparação com NutriOn:** NutriOn tem ~90 exercícios catalogados em 9 grupos
com imagens demo (`.specs/codebase/STRUCTURE.md`). A biblioteca do MFIT é
~20x maior em quantidade — mas tem vídeo (NutriOn é estático). Vídeo é
investimento alto (filmagem, edição, hospedagem); NutriOn não compete por
volume hoje.

Fontes:
- https://www.mfitpersonal.com.br/
- https://blog.mfitpersonal.com.br/duvidas-frequentes-sobre-o-app-mfit-personal/
- https://prescricaodetreinos.mfit.app/
- https://aplicativo.mfit.app/

### 3.3 Templates de treino — clonagem

> **Crítico para esta investigação.**

O MFIT **não oferece templates pré-prontos** ("Pre-made workout templates
aren't provided"), mas oferece **clonagem de treinos já criados para outros
alunos**:

> *"trainers can clone and edit workouts that have already been created"
> for other students*  
> — FAQ MFIT

Da página de prescrição:

> *"crie e clone rotinas de treinos a qualquer momento, de acordo com a
> dificuldade e gênero de cada aluno"*

**Implicação para o NutriOn:** o que estamos planejando como `coach-templates`
(biblioteca privada de templates reutilizáveis) **é mais avançado que o
MFIT** — eles obrigam o personal a clonar treino-a-treino a partir de outro
aluno (não há entidade "template"). NutriOn ganha eficiência se manter o
modelo de cópia + biblioteca dedicada.

Fontes:
- https://blog.mfitpersonal.com.br/duvidas-frequentes-sobre-o-app-mfit-personal/
- https://prescricaodetreinos.mfit.app/

### 3.4 Inteligência artificial — MFIT IA

Existe, mas **não gera treinos**. Funções confirmadas:

1. **Chat IA**: assistente que responde dúvidas sobre o app.
2. **Resumo de anamnese**: lê o questionário do aluno e devolve sumário pro
   personal direcionar o treino.
3. **Geração de mensagens push**: personal dá um prompt, IA escreve o
   conteúdo do push.

> *"Toda a responsabilidade pela criação de treinos permanece em suas
> próprias mãos"* — blog MFIT

A página comercial de iOS menciona "criação de treinos personalizados em
segundos" mas o blog técnico contradiz isso — a frase do iOS é provavelmente
uma referência ao auto-complete da clonagem, não geração autônoma.

Modelo de IA usado: não declarado.

**Implicação para o NutriOn:** o NutriOn já tem IA gerando treino +
metas + sanity-check de prato (Groq Llama 3.3 70B + Llama 4 Scout 17B).
Esse é um **diferencial real e quantificável** — onde o MFIT auxilia, o
NutriOn produz.

Fontes:
- https://blog.mfitpersonal.com.br/mfit-ia-pra-que-serve-e-como-usar/
- https://blog.mfitpersonal.com.br/inteligencia-artificial-personal-trainer/
- https://apps.apple.com/br/app/mfit-personal/id1283273690

### 3.5 Avaliação física e anamnese

- **11 protocolos** de avaliação física e postural.
- Personal pode criar protocolos próprios.
- Anamnese: forms padrão + customizáveis. Pode ser preenchida pelo personal
  ou enviada pro aluno via app/email.

**Comparação com NutriOn:** NutriOn não tem avaliação física estruturada
(dobras, perimetria, posturas). Tem perfil + bio (peso/altura/objetivo) +
reset de plano. **Gap real**: se a Área do Professor for vender pra personal
profissional, alguma forma de anamnese estruturada vira tabela stakes. Vale
adicionar ao roadmap após as 3 features atuais.

### 3.6 Plano alimentar / nutrição

**Inexistente no MFIT.** O produto é treino + financeiro + comunicação.
Cálculo de macros, plano alimentar, sanity-check de prato — nada. Reforçado
no comparativo da TreinoAI:

> *"NextFit é a única plataforma com integração nutricional completa"*

**Implicação para o NutriOn:** **gap competitivo enorme**. NutriOn já tem
sanity-check via foto + cálculo de macros + meta calórica + hidratação. Esse
é o lado que o MFIT não cobre — deveria ser o eixo da narrativa de venda do
NutriOn pra "personal + nutricionista".

Fonte: https://www.treinoai.com.br/academy/blog/melhor-app-para-personal-trainer-2026

### 3.7 Financeiro / contratos

- Carteira MFIT (cobrança).
- "Gestão financeira e controle de pagamentos" mencionada na home.
- Página dedicada: `/pages/gestao-financeira.html`.
- **Contratos por tipo (mensal/treino/semanal/parceria) não estão
  explicitamente documentados** nas páginas que consultei. `[não confirmado]`.
- O modelo financeiro do MFIT é **mensalidade do aluno gerada
  recorrentemente** + ajustes manuais. Não vi suporte a contratos
  diferenciados (treino-a-treino, parceria) — provavelmente o personal
  registra parceria como "aluno sem mensalidade" e treino-a-treino como
  cobrança avulsa.

**Implicação para o NutriOn:** a feature `coach-contracts` que estamos
planejando (4 tipos com data de início/fim/valor/dia de pagamento) é mais
estruturada do que o MFIT mostra. **Porém**, MFIT compensa com **cobrança
automática real** (Carteira MFIT) — algo fora do escopo do NutriOn por
enquanto. O foco do `coach-contracts` é registro/consulta, não cobrança;
diferenciamos por estrutura, eles por automação.

Fontes:
- https://www.mfitpersonal.com.br/pages/gestao-financeira.html
- https://blog.mfitpersonal.com.br/carteira-mfit/

### 3.8 Comunicação

- **Push notifications** (com IA pra escrever).
- **Sem chat in-app** documentado entre personal e aluno — `[não
  confirmado]`. As FAQs falam só de push e email; suporte é WhatsApp.
- A página inicial do aluno mostra **foto do personal + CREF + Instagram
  do personal**.

**Implicação para o NutriOn:** o card que estamos planejando (foto + nome +
WhatsApp condicional) é mais simples mas mais íntimo — o aluno entra no
WhatsApp do professor diretamente. MFIT mantém a relação dentro do app
(provável estratégia: lock-in via comunicação). NutriOn aposta no canal já
estabelecido (WhatsApp) — pragmático mas perde o lock-in.

Fontes:
- https://blog.mfitpersonal.com.br/duvidas-frequentes-sobre-o-app-mfit-personal/

### 3.9 White-label

Não existe modo white-label completo (logo customizado por personal). O que
tem:
- Foto do personal + CREF + Instagram aparecem na tela do aluno.
- Sugestão (FAQ) de adicionar logo na foto de perfil para "branding".

Sem aplicativo customizado pra cada personal.

---

## 4. Funcionalidades (lado aluno)

| Feature | MFIT |
|---------|------|
| Onboarding pelo aluno | Não — personal preenche |
| Recebe credenciais | Email com login/senha |
| Vê treinos do dia | Sim, com vídeo + cronômetro |
| Registra cargas/séries | Sim |
| Solicita mudança de treino | Pelo feedback (FAQ menciona "feedback dos alunos"); não há fila explícita |
| Vê info do professor | Foto, CREF, Instagram |
| Comunicação direta | Sem chat documentado; provavelmente push de mão única + Instagram |
| Histórico próprio | Sim |
| Pagamento próprio | Via Carteira MFIT (Pix, boleto, cartão até 12x) |

Comparação com NutriOn:
- NutriOn tem chat com IA (não com professor — mas é diferencial).
- NutriOn tem `student_requests` (fila de solicitações) — MFIT só tem
  feedback solto.
- NutriOn `coach_contracts` é só registro do professor; aluno não vê (no
  MVP). MFIT mostra plano vigente pro aluno (porque ele paga).

---

## 5. Plataformas e tecnologia

| Plataforma | Status |
|-----------|--------|
| iOS | Sim — `id1283273690` na App Store BR |
| Android | Sim — `app.mfit.personal` no Google Play |
| Web | Sim — `app.mfitpersonal.com.br` (área de personal) |
| Apple Watch | **Não suportado** (reclamação visível em reviews) |

App iOS:
- Versão atual: 7.6 (03/11/2025)
- Tamanho: 24,6 MB
- iOS mínimo: 12.0+
- Idioma: PT (apesar do listing inglês usar "English")
- Vendedor: MFIT PERSONAL APP LTDA

App Android:
- Bundle: `app.mfit.personal`
- Avaliação: 4,4★ (22,2 mil reviews)
- Tamanho/downloads não capturáveis via fetch (página tem render dinâmico
  pesado).

App é provavelmente **nativo** (iOS+Android) com peso pequeno (24,6 MB no
iOS). Sem evidências de stack — `[especulação]` Flutter ou React Native
seria coerente com peso baixo e UI bem cuidada.

Fontes:
- https://apps.apple.com/br/app/mfit-personal/id1283273690
- https://play.google.com/store/apps/details?id=app.mfit.personal

---

## 6. Avaliações e reputação

### 6.1 Lojas

| Plataforma | Estrelas | Reviews |
|-----------|----------|---------|
| App Store BR | **4,9 ★** | ~146 mil |
| Google Play | **4,4 ★** | ~22,2 mil |

A diferença de 0,5 estrelas é gritante e típica de apps brasileiros — base
Android costuma ser mais crítica/diversa em devices, e a barreira de avaliar
no Google Play é menor.

### 6.2 Reclame Aqui

| Indicador | Valor |
|-----------|-------|
| Nota | **8,5/10** |
| Total de reclamações analisadas | 38 |
| Resposta da empresa | 100 % |
| Solução final | 88,2 % |
| Tempo médio de resposta | 2 dias e 11 h |
| Voltaria a fazer negócio | `[não capturado — página 403]` |
| Selo | "Reclame AQUI Verificada" |

**Categorias mais comuns de reclamação:**
- Qualidade do produto (app instável)
- Cobrança indevida / dificuldade de cancelar
- Suporte WhatsApp lento/inadequado

**Padrão dos títulos de reclamação visíveis:**
- "Aplicativo apresenta falhas"
- "Aplicativo fora do ar prejudica atendimento"
- "Aplicativo SEMPRE para de funcionar"
- "Cancelar e reembolso"
- "Treino — Pandemia" `[contexto não capturado]`

**Conclusão:** reputação **boa-mas-não-ótima**. Resolve rápido, mas a
quantidade de reclamações sobre crashes/billing sugere problemas crônicos
não resolvidos no produto base.

Fontes:
- https://www.reclameaqui.com.br/empresa/mfit-personal/
- https://www.reclameaqui.com.br/empresa/mfit-personal/lista-reclamacoes/

### 6.3 Avaliações qualitativas (App Store)

Padrão visível nos reviews (extraído do summary):
- **Elogios:** funcionalidade ampla, biblioteca de vídeos, alunos engajados
- **Reclamações:**
  - Falta de Apple Watch
  - Suporte às vezes ausente
  - Faltas de feature pontuais
- **Atualização recente (v7.6, nov/2025):** melhorias no cronômetro com
  alertas em background e compatibilidade com apps de música

---

## 7. Concorrentes diretos no Brasil

Da pesquisa comparativa da TreinoAI Academy (seu próprio competidor, então
viés moderado em favor deles, mas dados de pricing são checáveis):

| App | Preço entrada | Foco | Diferencial |
|-----|---------------|------|-------------|
| **MFIT Personal** | R$ 10,90 | Personal autônomo | Biblioteca grande, Carteira MFIT |
| **TreinoAI** | R$ 24,90 | Personal autônomo | IA real pra periodização, sistema TRI |
| **Tecnofit Personal** | grátis – R$ 189 | Academia/studio | Solução completa de espaço físico (catraca etc.) |
| **Mobitrainer** | R$ 29,90 | Personal + studios | IA inicial, agendamento de turmas |
| **NextFit** | sob consulta | Personal + nutri | Único com integração nutricional completa |
| **Wiki4Fit** | R$ 29 | Personal iniciante | Funcional e barato |
| **Vedius** | sob consulta | Personal | 12.000+ vídeos (maior biblioteca), integração WhatsApp |
| **Pacto Solutions** | sob consulta | Academias/redes | CRM, financeiro com DRE, biometria facial |

**Análise:**
- **TreinoAI** é o concorrente mais próximo por capacidades de IA. NutriOn precisa olhar com atenção.
- **NextFit** é o único que cobre **nutrição+treino** integrado — competidor direto da proposta NutriOn de "biohacking, nutrição e treino".
- **Vedius** ganha em catálogo (12 k vídeos) mas pricing fechado.
- **Mfit** tem o **menor preço de entrada** (R$ 10,90) — barreira baixíssima pra captar mercado.

Fontes:
- https://www.treinoai.com.br/academy/blog/melhor-app-para-personal-trainer-2026

---

## 8. Pontos fortes percebidos do MFIT

1. **Preço de entrada baixíssimo** (R$ 10,90/mês para 3 alunos) — captura personal iniciante / casual.
2. **Carteira MFIT** — diferencial relevante: aluno paga via Pix/boleto/cartão e personal recebe valor total mesmo se aluno parcela. Resolve dor real do personal autônomo.
3. **Biblioteca de vídeos extensa** (1.800+) — barreira de entrada que NutriOn não tem hoje.
4. **App nativo iOS+Android+Web** com 4,9★ no App Store e ~146 k avaliações — escala validada.
5. **Suporte 100 % de resposta no Reclame Aqui** com 88 % de solução.
6. **Avaliação física estruturada** (11 protocolos) — ferramenta profissional.
7. **Conteúdo de marketing/educação** pro personal (blog, news.mfitpersonal, podcast) — cria comunidade e SEO.

---

## 9. Pontos fracos / gaps do MFIT

1. **Sem geração de treino por IA** (a "MFIT IA" é só chat + resumo de
   anamnese + push notifications).
2. **Sem nutrição / plano alimentar** — gap competitivo grande.
3. **Sem templates pré-prontos** (só clonagem de aluno-pra-aluno).
4. **Sem chat in-app personal-aluno** — comunicação fica em push e
   Instagram/WhatsApp.
5. **App instável** segundo reviews ruins — crashes, falhas, "para de
   funcionar". Padrão recorrente no Reclame Aqui.
6. **Sem Apple Watch.**
7. **Sem white-label real** (logo customizado).
8. **Sem suporte específico para academias/studios** (assumido pelo próprio
   FAQ — "Currently, the app is designed for individual personal trainers").
9. **Sem periodização estruturada** segundo o comparativo da TreinoAI.

---

## 10. Lições aplicáveis ao NutriOn

> Esta seção é a parte mais valiosa. Apoiada em fatos das seções acima.

### 10.1 Diferenciais do NutriOn que valem ser amplificados

| Vantagem NutriOn | Como o MFIT trata | Recomendação |
|------------------|-------------------|--------------|
| **IA gera treino + metas (Groq)** | MFIT não gera, só auxilia | Posicionar IA como motor central, não acessório. Mostrar "30 segundos pra plano completo" como case |
| **IA gera plano com métricas nutricionais** (kcal, proteína, água) | MFIT não tem nada de nutrição | Liderar com nutrição. Treino é commodity, dieta+treino integrados é blue ocean |
| **Sanity Check via foto** (multimodal) | MFIT não tem | Vendê-lo como "anti-self-sabotagem" — diferencial pop |
| **Templates como entidade dedicada** (planejado) | MFIT só tem clonagem aluno→aluno | Implementar conforme spec — UX mais limpa |
| **Sem custo pro aluno** | MFIT cobra do personal e personal repassa pro aluno | Modelo "freemium para todos" pode capturar mercado |

### 10.2 Features do MFIT que vale considerar copiar

| Feature MFIT | Adoção sugerida no NutriOn |
|--------------|----------------------------|
| **Anamnese estruturada (com 11 protocolos)** | Roadmap pós-MVP. Avaliação física é table-stakes pra "Área do Professor" virar produto sério |
| **Carteira de pagamento integrada** | Roadmap longo (regulatório, KYC, compliance). Essencial pra monetização do personal mas não pra MVP |
| **App da web pro personal** (não só mobile) | Personal trabalha no PC. NutriOn é só mobile hoje. Considerar web admin para coach (futuro) |
| **Vídeos de exercícios** | Investimento alto. NutriOn tem imagens — escalar para vídeo (mesmo que via API ou parceria) é vantagem |
| **Conteúdo educacional (blog, podcast, news)** | Marketing de longo prazo. Vale começar cedo |
| **Trial de 10 dias sem cartão** | Padrão de mercado. NutriOn deve adotar quando virar pago |

### 10.3 Armadilhas a evitar (aprendidas do MFIT)

1. **App instável é morte lenta.** O MFIT tem 4,9★ na App Store mas 38 reclamações no Reclame Aqui dominadas por crashes — isso erode reputação na comunidade técnica de personals. NutriOn precisa investir em testes antes de escalar features.
2. **Cancelamento difícil = reclamação no RA.** Múltiplas reclamações sobre dificuldade de cancelar/reembolso. Quando NutriOn for pago, ter fluxo de cancelamento dentro do app, sem fricção.
3. **Suporte só por WhatsApp não escala.** MFIT toma reclamação por isso. NutriOn deve ter pelo menos uma central de ajuda + email.
4. **"Ficar dentro do app" é frágil sem chat.** MFIT tenta lock-in via push, mas comunicação real cai no Instagram/WhatsApp do personal. NutriOn aceita isso (card com WhatsApp) — mais pragmático, mas significa que NutriOn não tem o lock-in do canal de comunicação. Vale conscientizar a equipe disso.
5. **Negociações de contrato são informais no mercado.** A feature `coach-contracts` é uma aposta — pode ser que personals não queiram registrar contratos formalmente. Vale UX simples + onboarding leve da feature, não obrigatório. (Se obrigar, vira fricção).

### 10.4 Gaps que NutriOn pode explorar como diferencial competitivo

1. **Treino + nutrição integrados com IA** — só NextFit faz, e com pricing fechado. NutriOn pode dominar este nicho.
2. **IA real, multimodal, gerativa** — TreinoAI cobra R$ 25–999 e é o concorrente direto em IA. NutriOn está no Groq (custo ~zero pro user hoje) — pode posicionar como "TreinoAI grátis com nutrição".
3. **Onboarding em 60s** (já é meta do NutriOn) — MFIT exige personal preencher tudo, NutriOn pode oferecer auto-onboarding pelo aluno + override pelo coach. UX mais leve.
4. **Brasil-first em estética e tom** — NutriOn é PT-BR nativo, com humor (vide "tá com a mão pesada" do sanity-check). MFIT é mais corporativo. NutriOn pode ser "o app que conversa com você como amigo".
5. **Open source / single-user-first** — `[oportunidade futura]` posicionar NutriOn como "personal app que vira coach app" — usuário comum pode virar aluno (com a feature area-professor). MFIT não tem usuário comum — só ecossistema fechado de personal+aluno.

### 10.5 Sobre a Área do Professor especificamente

Reconciliando o que o MFIT mostra com a roadmap do NutriOn:

| NutriOn (planejado/feito) | MFIT (estado atual) | Análise |
|--------------------------|---------------------|---------|
| `area-professor`: signup, CRUD aluno, lock de treinos, fila de solicitações, dashboard | Tudo feito (signup, gestão, fila parcial via feedback, dashboard) | Paridade — NutriOn ainda atrás na maturidade mas roadmap cobre o essencial |
| `coach-templates` (em spec) | Clonagem aluno→aluno (sem entidade template) | NutriOn ganha — UX dedicada |
| `coach-contracts` (em spec) | Carteira MFIT (cobrança automática) | MFIT ganha em automação; NutriOn ganha em registro estruturado (4 tipos) |
| `student-coach-card` (em spec) | Foto + CREF + Instagram do personal na tela do aluno | Paridade. NutriOn aposta em WhatsApp direto, MFIT em IG |
| Sem avaliação física | 11 protocolos | **Gap real** — adicionar ao roadmap pós-MVP |
| Sem chat in-app coach↔aluno | Sem chat; só push + WhatsApp/IG externos | Empate. Ambos têm gap. NutriOn pode ganhar futuro com chat |
| Sem cobrança automatizada | Carteira MFIT (Pix/boleto/cartão, taxa 2,59 %–4,99 %) | **Gap relevante de monetização** — fora do escopo MVP |

### 10.6 Recomendações práticas curtas

1. **Não competir em volume de vídeos.** É caro e não muda o jogo. Foco em IA + nutrição.
2. **Templates dedicados (em spec) = vantagem real.** Implementar.
3. **Avaliação física estruturada pós-MVP.** Sem isso, NutriOn não vira produto vendível pra personal profissional.
4. **Documentar IA como motor de venda.** O MFIT só tem chat de suporte, NutriOn tem IA gerando treino+metas+sanity-check. Página de marketing precisa explorar isso.
5. **Adicionar trial sem cartão se for monetizar.** É padrão do mercado.
6. **Construir conteúdo educacional cedo.** MFIT tem blog/news/podcast — SEO + autoridade.
7. **Tomar cuidado com estabilidade.** Investir em Sentry desde já (o `package.json` já mostra `@sentry/react-native` — bom, manter).

---

## 11. Apêndice: fontes consolidadas

| Categoria | URL |
|-----------|-----|
| Site oficial (home) | https://www.mfitpersonal.com.br/ |
| Sobre nós | https://www.mfitpersonal.com.br/pages/mfit.html |
| Pricing / FAQ | https://blog.mfitpersonal.com.br/duvidas-frequentes-sobre-o-app-mfit-personal/ |
| Carteira MFIT (taxas) | https://blog.mfitpersonal.com.br/carteira-mfit/ |
| MFIT IA (escopo) | https://blog.mfitpersonal.com.br/mfit-ia-pra-que-serve-e-como-usar/ |
| App iOS | https://apps.apple.com/br/app/mfit-personal/id1283273690 |
| App Android | https://play.google.com/store/apps/details?id=app.mfit.personal |
| Página de prescrição | https://prescricaodetreinos.mfit.app/ |
| Página do app | https://aplicativo.mfit.app/ |
| Reclame Aqui | https://www.reclameaqui.com.br/empresa/mfit-personal/ |
| LinkedIn | https://br.linkedin.com/company/mfitpersonal |
| Instagram | https://www.instagram.com/mfitpersonal/ |
| Notícia 252 % crescimento | https://www.noticenter.com.br/n.php?ID=26950 |
| CNPJ | https://www.econodata.com.br/consulta-empresa/32597365000131-MFIT-PERSONAL-APP-LTDA |
| Comparativo TreinoAI | https://www.treinoai.com.br/academy/blog/melhor-app-para-personal-trainer-2026 |

---

## 12. Confiança das informações

- **Alta confiança** (fontes diretas + cruzadas): preços, presença em lojas,
  empresa/CNPJ, escopo da MFIT IA, taxas da Carteira MFIT, número de
  protocolos de avaliação, ausência de plano alimentar, padrão de
  reclamações no Reclame Aqui.
- **Média confiança** (fonte única ou autodeclarado): número de personals/alunos,
  presença em 30 países, crescimento de 252 %, número exato de exercícios
  (varia entre páginas).
- **Baixa confiança / não confirmado**: stack tecnológica, faturamento, time
  size, % "voltaria a fazer negócio" do RA, plano R$ 12,90 do iOS.
