# 🎨 Ficha Visual — NutriOn

App Android de **biohacking · nutrição · treino** com IA empática. Visual *dark-first*, elétrico, com acentos neon e bordas generosas.

---

## 1. Cores

### Fundos (dark stack)
| Token | HEX | Uso |
|---|---|---|
| `bg` | `#07080B` | Fundo base |
| `bg-deep` | `#040507` | Modal/overlay |
| `bg-elevated` | `#0F1115` | Superfícies elevadas |
| `surface` | `#12141A` | Cards, containers |
| `surface-raised` | `#1A1D25` | Card ativo, segmented ativo |
| `surface-muted` | `#0B0D12` | Campos inativos |

### Bordas
| Token | HEX |
|---|---|
| `border` | `#1F232B` |
| `border-strong` | `#2B313C` |
| `border-subtle` | `#151921` |

### Texto
| Token | HEX | Uso |
|---|---|---|
| `text` | `#F4F5F7` | Principal |
| `text-dim` | `#A1A6B2` | Labels secundárias |
| `text-muted` | `#6B7180` | Hints |
| `text-inverse` | `#0A0B0E` | Sobre accent |

### Brand — Accent (verde neon)
| Token | Valor | Uso |
|---|---|---|
| `accent` | `#39FF14` | Botão primário, highlights |
| `accent-soft` | `#7BFF5C` | Hover, highlight de texto |
| `accent-deep` | `#1DB954` | Variação escura |
| `accent-glow` | `rgba(57,255,20,0.25)` | Halos / sombras |

### Secundário — Violet
| Token | HEX |
|---|---|
| `violet` | `#8B5CF6` |
| `violet-soft` | `#A78BFA` |
| `violet-deep` | `#6D28D9` |

### Estados
| Token | HEX | Uso |
|---|---|---|
| `danger` | `#F43F5E` | Erro, delete |
| `warn` | `#F59E0B` | Atenção |
| `info` | `#38BDF8` | Informação, hidratação |

### Gradientes
- **heroRadial**: `rgba(57,255,20,0.18)` → `rgba(29,185,84,0.05)` → transparente
- **violet**: `rgba(139,92,246,0.18)` → `rgba(139,92,246,0.02)`
- **cardGlow**: `rgba(57,255,20,0.10)` → transparente
- **screen**: `#07080B` → `#0B0D12` → `#07080B`

📁 `src/lib/theme.ts:1-32`, `tailwind.config.js:10-57`

---

## 2. Tipografia

**Família:** `System` (San Francisco no iOS, Roboto/Segoe no Android) + `monospace` em conteúdo markdown.
**Sem fontes customizadas carregadas.** Escala = Tailwind padrão.

| Classe | Tamanho | Uso típico |
|---|---|---|
| `text-xs` | 12px | Labels uppercase, hints |
| `text-sm` | 14px | Subtítulos |
| `text-base` | 16px | Body, botões |
| `text-2xl` | 24px | Subtítulos principais |
| `text-3xl` | 30px | Nome do usuário (Home) |
| `text-4xl` → `6xl` | 36–60px | Logo |

**Detalhes assinatura:**
- Labels: `uppercase tracking-widest` (3–4px)
- Logo "**Nutri**On" → "Nutri" branco + "On" verde neon, com `text-shadow` verde 0.35 / blur 20px (efeito glow)
- Pesos usados: `regular`, `semibold`, `bold` (sem extra-light/black)

📁 `tailwind.config.js:59`, `src/components/ui/Logo.tsx`

---

## 3. Espaçamento, Raios e Sombras

**Spacing:** Tailwind padrão. Telas usam `padding: 20`, `gap: 16`, `paddingBottom: 140` (folga pra tab bar + FAB).

**Border radius:**
| Classe | px | Aplicação |
|---|---|---|
| `rounded-xl` | 16 | Inputs secundários, segmentado |
| `rounded-2xl` | 24 | Botões, inputs primários, avatar |
| `rounded-3xl` | 32 | Cards principais, WeekStreak |
| `rounded-full` | ∞ | Day circles, badges, FAB |

**Sombras (sempre coloridas, nunca cinza):**
| Componente | shadowColor | offset | opacity | radius | elevation |
|---|---|---|---|---|---|
| Botão primário | `#39FF14` | (0, 6) | 0.45 | 16 | 8 |
| Card glow verde | `#39FF14` | (0, 0) | 0.22 | 22 | 4 |
| Card glow violet | `#8B5CF6` | (0, 0) | 0.22 | 22 | 4 |
| Segmented ativo | `#39FF14` | (0, 0) | 0.18 | 10 | 2 |

📁 `src/components/ui/Button.tsx:86-95`, `Card.tsx:34-43`

---

## 4. Identidade do Produto

- **Nome:** NutriOn
- **Tagline:** *Biohacking · Nutrição · Treino*
- **One-liner:** Assistente de nutrição e treino com IA empática que vê seu perfil, seus últimos logs e celebra acertos sem soar como planilha fria.
- **Público:** 18+, interessados em otimização de saúde (biohacking, fitness, dieta data-driven)
- **Stack visual:** NativeWind (Tailwind RN) + Expo + RN 0.81 + `expo-linear-gradient` + ícones Lucide
- **Diferenciais visuais:** onboarding 60s, ring de calorias SVG custom, Week Streak com 3 dots (comida/treino/água), foto de prato → macros via IA

---

## 5. Componentes-chave (design system)

| Componente | Assinatura visual |
|---|---|
| **Button** | `rounded-2xl`, primary com glow verde, haptic ao press, ícone+label |
| **Card** | `rounded-3xl`, surface + border, opcional `glow` verde/violet |
| **Screen** | Variantes `hero` / `flat` / `violet`, gradient no topo até 70% |
| **Input** | `rounded-2xl`, border vira `danger` no erro, `selectionColor: accent` |
| **Logo** | "Nutri**On**" + glow verde, tagline uppercase tracking-[3px] |
| **WeekStreak** | 7 círculos `h-9 w-9`, badge accent 10% opacity, dots coloridos |
| **StatRing** | SVG custom, gradient verde → verde deep, número grande no centro |
| **ChatBubble** | Estilo iMessage, typing indicator com 3 dots bounce |

**Vibe geral:** dark profundo, acentos elétricos, cantos bem arredondados, sombras *coloridas* (nunca cinza), padding generoso, alto contraste, ícones Lucide com `strokeWidth` condicional (2 / 2.5 quando focado).

---

## 6. Assets & Modo

- `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`, `favicon.png` — sem logo SVG (logo é programático).
- **Dark mode forçado:** `userInterfaceStyle: 'dark'` (`app.config.ts:42`), StatusBar `light`. Não existe paleta light.

---

## TL;DR

> Preto-quase-puro **#07080B** + verde neon **#39FF14** + violet **#8B5CF6**, com bordas 24–32px, sombras coloridas com glow, system fonts em uppercase tracking-widest. Premium, elétrico, contraste alto.
