# Email Templates do Supabase Auth — NutriOn

HTMLs em PT-BR com branding NutriOn (dark, accent verde) prontos pra
colar no painel do Supabase. Eles sobrescrevem os templates default em
inglês.

## Como aplicar

1. Supabase Dashboard → **Authentication → Email Templates**
2. Pra cada template abaixo:
   - Cola o **Subject** no campo "Subject heading"
   - Cola o conteúdo do `.html` no campo "Message body"
   - **Save changes**

## Templates disponíveis

| Arquivo | Quando dispara | Subject |
|---|---|---|
| `reset-password.html` | User clica em "Esqueci a senha" | `Redefinir sua senha do NutriOn` |
| `confirm-signup.html` | Signup com "Confirm email" ON | `Confirme seu email no NutriOn` |
| `magic-link.html` | Login por link mágico | `Seu link de acesso ao NutriOn` |
| `invite-user.html` | `auth.admin.inviteUserByEmail()` | `Você foi convidado para o NutriOn` |
| `change-email.html` | User troca o email | `Confirme seu novo email` |

## Variáveis usadas

Os templates usam Go templates (formato do Supabase):

- `{{ .ConfirmationURL }}` — link de ação (todos exceto change-email)
- `{{ .Email }}` — email atual
- `{{ .NewEmail }}` — só em change-email
- `{{ .SiteURL }}` — URL do site (não usado por enquanto)

## Branding

Cores:
- Background: `#0a0b0f` (preto)
- Card: `#15161c` (cinza escuro)
- Border: `#2a2c36`
- Accent: `#39ff14` (verde NutriOn)
- Texto principal: `#e4e4e7`
- Texto secundário: `#a1a1aa`
- Texto muted: `#71717a`

Fonte: stack do sistema (sem download de fontes externas — emails têm
suporte limitado a custom fonts).

## Manutenção

Quando atualizar um template:
1. Edita o `.html` aqui no repo
2. Cola a nova versão no painel do Supabase
3. Commit do arquivo atualizado pra manter histórico

Se algum template novo for relevante (ex: `reauthentication.html`,
`email-change-current.html`), adiciona aqui seguindo o mesmo padrão
visual.
