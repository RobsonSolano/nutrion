# NutriOn

App Android de **biohacking, nutrição e treino** com assistente de IA empático.

## Visão

Um app pessoal-primeiro (PWA-Android) que entende perfil, hábitos e logs do usuário e devolve metas, treinos e feedback de IA — sem virar mais uma planilha fria. Foco em uso informativo: orientações **não substituem** profissional de saúde.

## Goals

- Onboarding com IA em ~60s (perfil → metas + treinos prontos).
- Dashboard com ring de calorias, streak semanal e log rápido (refeição, água, treino).
- Chat com IA que enxerga perfil + últimos logs, sempre em PT-BR.
- Sanity Check de pratos via foto (IA multimodal).
- Biblioteca de ~90 exercícios catalogados em 9 grupos com imagens demo.

## Stack

| Camada | Tecnologia |
|--------|------------|
| App | Expo SDK 54, React 19, RN 0.81, New Architecture |
| Navegação | Expo Router v6 (file-based, typed routes) |
| Estilo | NativeWind v4 (Tailwind em RN), dark mode nativo |
| Estado server | TanStack Query v5 |
| Estado local | Zustand |
| Backend | Supabase (Auth + Postgres + Storage + Edge Functions) |
| IA | Groq (Llama 3.3 70B texto, Llama 4 Scout 17B visão) |
| Observabilidade | Sentry |

## Scope

**Dentro:** app pessoal Android (Play Store), Supabase remoto único (sem staging), edge functions em Deno.

**Fora (por enquanto):** iOS, web, modo offline, premium/pagamento, multi-perfil.

## Convenções

- Idioma: **PT-BR** em código, docs, mensagens, commits. Acentuação obrigatória.
- Branching: gitflow clássico (`develop` ← `feature/*` / `hotfix/*`; release pra `main`).
- Commits: Conventional Commits com scope (ex: `feat(onboarding):`, `fix(chat):`).
- Banco: migrations idempotentes em `supabase/migrations/`, RLS sempre por `auth.uid() = user_id`.

## Roadmap próximo

1. Hotfix: onboarding idempotente + reset de user órfão.
2. Hotfix: foto pesada com alerta amigável + qualidade de câmera reduzida.
3. Feature: referências bibliográficas para a IA (chat, onboarding, treinos, sanity-check).
4. Feature grande: **Área do Professor** (login separado, CRUD de alunos, treinos com lock, fila de solicitações, dashboard).
