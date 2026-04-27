# NutriOn

App Android de **biohacking, nutrição e treino** com assistente de IA que enxerga o seu perfil, seus logs e te devolve feedback empático — sem virar mais uma planilha fria.

> **Versão 1.0** — pronta pra Play Store (Android).
> Uso informativo: orientações **não substituem** profissional de saúde.

---

## ✨ O que o app faz

### Onboarding com IA em 60 segundos
Na primeira sessão, a IA (Llama 3.3 70B via Groq) recebe seu perfil, objetivo, limitações físicas e alergias, e devolve **metas + treinos prontos**:
- Calorias (Mifflin-St Jeor + ajuste pelo objetivo)
- Proteína (1.6–2.2 g/kg)
- Água (35 ml/kg + ajuste por frequência de treino)
- 3 a 5 rotinas semanais com exercícios prescritos (séries, reps, carga) respeitando suas limitações

Pulável: quem prefere configurar na mão segue direto pra Home e completa depois.

### Dashboard (Home)
- Saudação contextual por horário do dia
- **Ring de calorias** com progressão visual (SVG gradient)
- Totais de proteína / água com barras tonais
- **Streak semanal** — 7 círculos dos últimos 7 dias com dots coloridos (comida/treino/água)
- "Último treino" (ou "Treinos de hoje" se já marcou algum)
- Atalho rápido pro Sanity Check
- FAB pra log rápido

### Log rápido (3 abas)
- **Refeição**: 6 presets (Café/Almoço/Lanche/Jantar/Pré-Pós-treino) + 4 macros (kcal/prot/carb/gord)
- **Água**: total do dia com quick-add (+200/300/500/750 ml)
- **Treino**: escolhe uma rotina salva, opcionalmente duração + notas

### Chat IA
- UI tipo WhatsApp: bubbles, typing indicator animado, sugestões na tela vazia
- **Persona de nutricionista empático** (Llama 3.3 70B) que enxerga seu perfil + últimos 10 refeições + últimos 5 treinos
- Responde sempre em PT-BR, celebra acertos, aponta desvios sem culpa

### Sanity Check (validação de prato com IA)
- Tira foto (câmera ou galeria) → descreve o prato → opcionalmente peso da balança
- **Llama 4 Scout 17B multimodal** identifica itens, verifica consistência descrição×visual, estima macros
- Salva direto como refeição no dia

### Treinos (não "rotinas")
- Biblioteca de **90 exercícios catalogados** em 9 grupos musculares (Peito, Costas, Pernas, Ombros, Bíceps, Tríceps, Core, Full Body, Cardio)
- Editor de treino com picker em 2 passos (grupo → exercício com busca)
- Prescrição em faixa: séries × (reps mín–máx) × (peso mín–máx kg) ou duração em minutos
- **Imagens de demonstração** nos ~83 exercícios principais via Free Exercise DB (CC0) — botão 👁 abre modal com 2 fotos (posição inicial + final), prev/next, dots indicator
- Ao adicionar exercício no treino, o foco vai direto pro input de **Séries** do recém-adicionado (não precisa rolar)

### Perfil
- Avatar com inicial + glow violet
- IMC calculado com classificação colorida
- Medidas (peso, altura, meta) + metas diárias (kcal, proteína, água)
- Botão **"Gerar plano com IA de novo"** pra refazer o onboarding sem deslogar
- Edição de perfil em modal (nome, peso, altura, metas manuais)

### Auth
- **Google Sign-in nativo** (via development build / release)
- **E-mail e senha** (fallback universal; funciona no Expo Go pra testes)
- Sessão persistida via AsyncStorage

---

## 🧱 Stack

| Camada | Tecnologia |
|--------|------------|
| App | Expo SDK 54, React 19, React Native 0.81, New Architecture ligada |
| Navegação | Expo Router v6 (file-based, typed routes) |
| Estilo | NativeWind v4 (Tailwind em RN), dark mode nativo |
| Estado server | TanStack Query v5 |
| Estado local | Zustand |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions) |
| IA | Groq (Llama 3.3 70B texto, Llama 4 Scout 17B visão) |
| Auth Google | `@react-native-google-signin/google-signin` |
| Haptics | `expo-haptics` |
| Charts | SVG caseiro (sparklines + StatRing) — sem libs |

---

## 📁 Estrutura

```
app/                       # Rotas (Expo Router v6)
├── _layout.tsx            # Providers (Query + SafeArea + auth bootstrap)
├── index.tsx              # Splash gate
├── (auth)/login.tsx       # Login / signup (email + Google)
├── (tabs)/
│   ├── _layout.tsx        # Tab bar + gate de onboarding
│   ├── index.tsx          # Dashboard (Home)
│   ├── chat.tsx           # Chat IA
│   ├── treino.tsx         # Meus Treinos (lista)
│   └── perfil.tsx         # Perfil + IMC + metas
├── onboarding/
│   ├── _layout.tsx
│   ├── index.tsx          # Valor (intro)
│   ├── dados.tsx          # Dados pessoais
│   ├── objetivo.tsx       # Objetivo + meta
│   ├── esporte.tsx        # Esportes + frequência
│   ├── habitos.tsx        # Água + alergias + limitações
│   ├── bio.tsx            # Bio (255 chars)
│   ├── loading.tsx        # Loading da geração (Groq)
│   └── resultado.tsx      # Preview do plano antes de salvar
├── rotina/
│   ├── nova.tsx           # Modal: novo treino
│   └── [id].tsx           # Detalhe/edição de treino
├── editar-perfil.tsx      # Modal de edição
├── log.tsx                # Log rápido (refeição/água/treino)
└── sanity-check.tsx       # Validação de prato

src/
├── components/
│   ├── ui/                # Design system (Screen, Button, Card, Input, ...)
│   ├── onboarding/        # OnboardingLayout, ProgressBar, OptionCard, ...
│   ├── routine/           # RoutineEditor, ExerciseImagesModal, PreviewEyeButton
│   ├── log/               # MealForm, WaterForm, WorkoutForm
│   ├── ChatBubble, TypingIndicator, WeekStreak, Disclaimer
├── hooks/                 # useAuth, useProfile, useRoutines, useOnboarding, ...
├── services/              # supabase, auth, chat, foodLogs, workoutLogs,
│                          # routines, onboarding, exercises, waterLogs, sanityCheck
├── stores/                # useSessionStore, useOnboardingStore, useOnboardingResultStore
├── lib/                   # theme, biometrics, queryKeys, platform
└── types/                 # database types

supabase/
├── migrations/            # SQL idempotente (5 migrations)
│   ├── 20260419220000_init.sql                      # profiles, workout_logs, food_logs + RLS
│   ├── 20260420120000_exercises_and_water.sql       # catálogo + water_logs + seed 90 exercícios
│   ├── 20260422120000_workout_routines.sql          # rotinas + sessões
│   ├── 20260423120000_onboarding_fields.sql         # campos do onboarding em profiles
│   └── 20260423140000_exercise_images.sql           # image_urls + mapping ~83 exercícios
└── functions/
    ├── chat-ai/           # Chat + Sanity Check (Groq)
    └── onboarding-plan/   # Geração do plano de onboarding (Groq + JSON mode)
```

---

## 🚀 Setup (desenvolvimento)

### Pré-requisitos
- **Node 20.19.4** (`.nvmrc`)
- Conta **Expo** (<https://expo.dev>)
- Conta **Supabase** com projeto criado
- Conta **Groq** (<https://console.groq.com>) pra API key
- **Android Studio** se for gerar APK (opcional)

### Passo a passo

```bash
nvm use                                          # 20.19.4
npm install

cp .env.example .env.local
# edite .env.local com:
#   EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
#   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com

npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:push                                  # aplica todas as migrations
npx supabase secrets set GROQ_API_KEY=gsk_xxx
npm run fn:deploy                                # publica chat-ai + onboarding-plan
```

No dashboard Supabase:
- **Authentication → Providers → Google**: habilitar, colar Web Client ID + Secret, ativar "Skip nonce checks"
- **Authentication → Sign In / Up**: desligar "Confirm email" (MVP sem SMTP)

### Rodar

```bash
npm run start:go   # Expo Go (login email/senha apenas)
# ou
npm start          # dev-client (com Google Sign-in, precisa do APK dev instalado)
```

---

## 🔧 Scripts

| Comando | O que faz |
|---------|-----------|
| `npm start` | Expo dev server (modo dev-client) |
| `npm run start:go` | Expo dev server (Expo Go) |
| `npm run typecheck` | `tsc --noEmit` — zero erros no 1.0 |
| `npm run db:push` | Aplica migrations Supabase |
| `npm run fn:deploy` | Publica `chat-ai` + `onboarding-plan` |

Trocar modelo da IA sem redeploy:
```bash
npx supabase secrets set GROQ_MODEL=llama-3.1-8b-instant
# ou GROQ_VISION_MODEL=<outro multimodal>
```

---

## 📱 Publicação na Play Store (versão 1.0)

### 1. Build de produção

```bash
npx eas-cli login
npx eas-cli build -p android --profile production     # gera AAB pra Play Console
# profile "preview" gera APK pra distribuição interna
```

> Configurado em `eas.json` — `production` usa `buildType: "app-bundle"`.

### 2. Checklist Play Console

- **Package name**: `br.com.nutrion`
- **Versão**: `1.0.0` (`versionCode: 1`) — bump a cada release
- **Categoria**: Saúde e Fitness
- **Classificação etária**: 12+ (app de estilo de vida, sem conteúdo sensível)
- **Público-alvo**: 18+ (recomendações nutricionais)
- **Assinatura do app**: Play App Signing (padrão)

### 3. Assets necessários
- [x] Ícone 512×512 (`assets/icon.png`)
- [x] Ícone adaptativo 1024×1024 (`assets/adaptive-icon.png`)
- [x] Splash (`assets/splash-icon.png`)
- [ ] Feature graphic 1024×500 (criar)
- [ ] Screenshots do celular (mín. 2, máx. 8 — recomendo: Home, Chat IA, Treino com imagens, Onboarding, Sanity Check)

### 4. Política de privacidade (obrigatória)
Precisa hospedar uma URL. Tópicos a cobrir:
- Dados coletados: e-mail, nome, peso, altura, sexo, ano de nascimento, objetivos, fotos de refeições, logs de treino/água/comida, bio livre
- Para quê: personalização da IA, cálculo de metas, histórico
- Processadores terceiros: **Supabase** (armazenamento), **Groq** (inferência de IA — as mensagens e fotos enviadas ao chat/sanity-check/onboarding passam pelos servidores do Groq)
- Como deletar conta: por enquanto, contato por e-mail (próxima versão: botão no app)

### 5. Data Safety form (Play Console → Política do app → Segurança de dados)
- Coleta: Email, Nome, Info de saúde e fitness (peso, altura, metas), Fotos (sanity check), Mensagens do chat
- Compartilhamento com terceiros: **Sim** (Supabase pra armazenamento, Groq pra inferência)
- Dados criptografados em trânsito: **Sim**
- Usuário pode pedir exclusão: **Sim** (por e-mail, por enquanto)

### 6. Google OAuth em produção
Se ainda usando dev build: no Google Cloud Console → **OAuth consent screen** → publicar em "Produção" (estado "In testing" só serve até 100 usuários). Adicionar o SHA-1 do keystore de release (obtido via `eas credentials`).

---

## 🤖 Custos / limites

- **Groq free tier**: 6k TPM, 14.4k RPD no Llama 3.3 70B. Suficiente pra MVP com poucos usuários simultâneos.
- **Supabase free tier**: 500 MB DB, 1 GB storage, 50k MAU, 500k requests/mês em edge functions. Suficiente pra escalar até algumas centenas de usuários ativos.
- **jsDelivr (imagens de exercícios)**: CDN público sem rate limit prático. Zero custo.

---

## 🙏 Créditos

- **Free Exercise DB** (<https://github.com/yuhonas/free-exercise-db>) — catálogo de exercícios com imagens, licença **CC0** (domínio público). Servido via **jsDelivr**.
- **Groq** — inferência da IA (Llama models).
- **Supabase** — backend completo.

---

## 📜 Disclaimer

App de **uso informativo**. Cálculos calóricos, recomendações de treino e feedback da IA são **pontos de partida**, não prescrição. Decisões relativas a saúde, alimentação e atividade física devem ser validadas com **médico, nutricionista e educador físico**.

Se estiver grávida, em tratamento médico ou com condição crônica, consulte um profissional antes de seguir qualquer sugestão do app.
