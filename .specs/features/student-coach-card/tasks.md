# Tasks: Card do professor no perfil do aluno

Branch: `feature/student-coach-card` (a partir de `develop`)

Ordem: T-1 → T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → T-8 (commit). T-3 e T-4
podem rodar em paralelo.

---

## T-1. Migration: campos de contato em `coaches` + RLS

**What:** Adicionar `show_contact_to_students` + `contact_phone`. Estender
RLS de `coaches` pra aluno ler do seu coach.

**Where:** `supabase/migrations/2026MMDD000000_coach_contact_fields.sql` (novo)

**Depends:** —

**Done-when:**
- `alter table coaches add column show_contact_to_students bool default false`
- `alter table coaches add column contact_phone text check (regex 10-13 dígitos)`
- Drop `coaches_select_own`
- Create `coaches_select_own_or_student` usando `_auth_coach_id()`
- Migration idempotente

**Verify:**
```sh
npm run db:push
# SQL: como aluno do coach X, SELECT * FROM coaches WHERE id = X → 1 row
# SQL: como aluno, SELECT * FROM coaches WHERE id = OUTRO → 0 rows
```

---

## T-2. Tipos TypeScript

**What:** Atualizar tipo de `coaches` em `database.ts`.

**Where:** `src/types/database.ts`

**Depends:** T-1

**Done-when:**
- Tipo `Coach` ou similar inclui os 2 novos campos
- `npm run typecheck` verde

**Verify:** typecheck

---

## T-3. Helper `lib/phone.ts`

**What:** Formatação, parse, validação, URL do WhatsApp.

**Where:** `src/lib/phone.ts` (novo)

**Depends:** —

**Done-when:**
- `parsePhoneInput(masked)` — só dígitos
- `formatPhoneBR(digits)` — formatado pra exibição
- `whatsappUrl(input)` — `https://wa.me/<digits>`
- `isValidPhone(digits)` — regex 10-13 dígitos
- Cobertura inline ou tests rápidos

**Verify:** lint + sanidade manual

---

## T-4. Service: contato do coach

**What:** Adicionar `getCoachContact(coachId)` e `updateCoachContactSettings`
em `src/services/coach.ts`.

**Where:** `src/services/coach.ts`

**Depends:** T-1, T-2

**Done-when:**
- `getCoachContact(coachId)` retorna `{ id, full_name, avatar_url, show_contact_to_students, contact_phone, bio, cref }` (join com profiles)
- `updateCoachContactSettings({ show_contact, phone, bio?, cref? })` UPDATE em coaches
- Erros de RLS / validação propagados

**Verify:** smoke direto via service

---

## T-5. Hook `useCoachContact`

**What:** Query hook.

**Where:** `src/hooks/useCoachContact.ts` (novo, ou em `useCoach.ts` existente)

**Depends:** T-4

**Done-when:**
- `useCoachContact(coachId)` com `staleTime: 5min`
- `enabled: !!coachId`
- Invalidação após `updateCoachContactSettings`

**Verify:** uso na T-6 e T-7

---

## T-6. Componente `CoachCard`

**What:** Card visual com nome+foto+WhatsApp.

**Where:** `src/components/CoachCard.tsx` (novo)

**Depends:** T-3, T-5

**Done-when:**
- Recebe prop `coachId`
- Mostra avatar (Image ou fallback inicial)
- Nome + "Professor responsável"
- Linha clicável WhatsApp condicional (`show_contact_to_students && contact_phone`)
- Tap chama `Linking.openURL(whatsappUrl(...))` com try/catch
- Loading state (skeleton ou null)
- Estilizado com componentes ui existentes (Card)

**Verify:** smoke isolado (chamar em alguma tela de teste)

---

## T-7. Render no perfil do aluno

**What:** Adicionar `<CoachCard />` em `(tabs)/perfil.tsx`, render condicional.

**Where:** `app/(tabs)/perfil.tsx`

**Depends:** T-6

**Done-when:**
- Render só quando `profile.role === 'aluno' && profile.coach_id`
- Posicionamento: antes do `<Disclaimer />` (final da tela)
- Não quebra layout pra usuário comum / professor

**Verify:**
- Login como aluno: card aparece
- Login como comum: card some
- Login como professor: card some

---

## T-8. Tela `(coach)/perfil.tsx` com toggle

**What:** Tela de perfil/configurações do professor com toggle e input de
telefone, bio, CREF.

**Where:** `app/(coach)/perfil.tsx` (novo)

**Depends:** T-3, T-4, T-5

**Done-when:**
- Avatar + nome + email (read-only)
- Inputs editáveis: bio (textarea, 500 chars), cref (text)
- Switch "Permitir alunos verem meu telefone" (`show_contact_to_students`)
- Input "Telefone" (visível só se switch ON; usa máscara via formatPhoneBR)
- Validação: se switch ON e phone preenchido, validar com `isValidPhone`
- Botão "Salvar" → `updateCoachContactSettings`
- Toast de sucesso

**Verify:**
- Salvar com toggle ON e phone válido → DB atualizado
- Login como aluno → card mostra phone formatado
- Desligar toggle → próxima view do aluno: linha do WhatsApp some

---

## T-9. Acesso à tela do coach

**What:** Adicionar entry-point pra `(coach)/perfil.tsx` no layout do coach.

**Where:** `app/(coach)/_layout.tsx` ou `app/(coach)/index.tsx`

**Depends:** T-8

**Done-when:** botão/link "Meu perfil" leva pra `(coach)/perfil`

**Verify:** smoke

---

## T-10. /simplify + testes + docs + commit

**What:** Roda /simplify, suite, atualiza docs, commit.

**Depends:** T-1 a T-9

**Done-when:**
- `npm run typecheck` verde
- `npm run lint` verde
- /simplify aplicado
- `.specs/codebase/STRUCTURE.md` atualizado (novas rotas, helpers, hooks)
- Commit criado (perguntar ao dev)

**Verify:** suite limpa
