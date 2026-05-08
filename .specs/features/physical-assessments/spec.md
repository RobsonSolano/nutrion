# Feature: Avaliação Física Estruturada

## 1. Visão e justificativa

O NutriOn já tem a aba **Evolução** (`(coach)/aluno/[id]/evolucao.tsx`) e a
tabela `progress_entries`, mas hoje o registro é texto livre — bom pra marcos
("bateu PR no agachamento", "perdeu 2 kg"), ruim pra acompanhar **dado
quantitativo estruturado** ao longo do tempo. Apps consolidados como o MFIT
oferecem ficha de avaliação física com antropometria + perimetria + dobras
cutâneas + cálculo automático de % de gordura, e isso é hoje o principal gap
funcional pro professor que avalia o aluno presencialmente.

A feature entrega ao coach uma ficha de avaliação reutilizável: ele cadastra
medidas a cada N semanas, o app calcula automaticamente composição corporal
(% gordura via Jackson-Pollock 1978), guarda histórico imutável de cada
avaliação (auditoria), permite comparar duas datas lado a lado e plota
gráficos de evolução das métricas-chave. O aluno enxerga uma versão resumida
e read-only da última avaliação no próprio perfil — transparência sem dar
edição. A tabela existente `progress_entries` continua sendo o **diário em
texto** e não é substituída; as duas convivem na aba Evolução.

## 2. User stories

| ID | Como… | Quero… | Para… |
|----|-------|--------|-------|
| **PA-01** | Coach | Cadastrar uma nova avaliação física do aluno informando peso, altura, perímetros, dobras cutâneas (opcional), foto postural (opcional) e observações | Ter um snapshot quantitativo de composição corporal numa data |
| **PA-02** | Coach | Ver % de gordura, massa magra e IMC calculados automaticamente a partir das dobras e do peso | Não precisar fazer conta na mão / planilha externa |
| **PA-03** | Coach | Editar uma avaliação que cadastrei (corrigir digitação, completar dobras que esqueci) | Manter a ficha íntegra sem precisar deletar/recriar |
| **PA-04** | Coach | Excluir uma avaliação que cadastrei errado | Não poluir histórico com lixo |
| **PA-05** | Coach | Ver lista cronológica (mais recente primeiro) de todas as avaliações do aluno, com cards mostrando peso, % gordura e cintura como destaque | Bater olho na evolução geral |
| **PA-06** | Coach | Comparar duas avaliações lado a lado, vendo a diferença (delta) numérica e percentual de cada campo | Mostrar progresso pro aluno na consulta |
| **PA-07** | Coach | Ver gráfico de linha da evolução de peso, % gordura e perímetros-chave (cintura, quadril, braço) ao longo do tempo | Identificar tendências (platô, regressão) |
| **PA-08** | Coach | Tirar/anexar até N fotos posturais (frente, costas, lateral) na avaliação, salvas em bucket privado | Documentar postura visualmente |
| **PA-09** | Aluno | Ver na minha aba **Evolução** um card resumo da última avaliação física feita pelo meu professor (peso, % gordura, IMC, data) — read-only | Saber em que pé estou sem precisar perguntar |
| **PA-10** | Aluno | **NÃO** poder criar, editar ou excluir avaliações | A ficha é instrumento clínico do coach (`[CONFIRMAR]` se queremos abrir auto-cadastro pro `comum`/sem coach no futuro) |

## 3. Schema Postgres

### 3.1. Tabela `physical_assessments`

Migration nova: `supabase/migrations/202605XX000000_physical_assessments.sql`
(timestamp a definir na hora de implementar).

```sql
create table if not exists public.physical_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_id   uuid not null references public.profiles(id) on delete cascade,

  -- ---- Metadata ----
  assessed_at  date        not null default current_date,
  protocol     text        not null default 'pollock_3'
                check (protocol in ('pollock_3','pollock_7','none')),
  notes        text        check (notes is null or char_length(notes) <= 2000),

  -- ---- Antropometria ----
  weight_kg    numeric(5,2) check (weight_kg is null or (weight_kg between 20 and 400)),
  height_cm    numeric(5,1) check (height_cm is null or (height_cm between 80 and 250)),

  -- ---- Perimetria (cm) ----
  -- Lado único (não tem D/E)
  perim_neck_cm        numeric(5,1),
  perim_chest_cm       numeric(5,1),
  perim_waist_cm       numeric(5,1),
  perim_abdomen_cm     numeric(5,1),
  perim_hip_cm         numeric(5,1),

  -- Lados D/E (right/left)
  perim_arm_relaxed_r_cm    numeric(5,1),
  perim_arm_relaxed_l_cm    numeric(5,1),
  perim_arm_contracted_r_cm numeric(5,1),
  perim_arm_contracted_l_cm numeric(5,1),
  perim_forearm_r_cm        numeric(5,1),
  perim_forearm_l_cm        numeric(5,1),
  perim_thigh_r_cm          numeric(5,1),
  perim_thigh_l_cm          numeric(5,1),
  perim_calf_r_cm           numeric(5,1),
  perim_calf_l_cm           numeric(5,1),

  -- ---- Dobras cutâneas (mm) — Jackson-Pollock 1978 ----
  -- 3 dobras homem: peitoral, abdominal, coxa
  -- 3 dobras mulher: tríceps, suprailíaca, coxa
  -- 7 dobras (ambos): + subescapular, axilar média, supra-ilíaca/peitoral, abdominal
  -- Aceitamos os 7 campos sempre; UI mostra só os relevantes ao protocolo escolhido
  skin_chest_mm          numeric(4,1),
  skin_midaxillary_mm    numeric(4,1),
  skin_triceps_mm        numeric(4,1),
  skin_subscapular_mm    numeric(4,1),
  skin_abdominal_mm      numeric(4,1),
  skin_suprailiac_mm     numeric(4,1),
  skin_thigh_mm          numeric(4,1),

  -- ---- Composição calculada (preenchidos pelo trigger) ----
  -- Densidade corporal e % gordura via Jackson-Pollock 1978.
  -- 3 dobras (homem): D = 1.10938 - 0.0008267*Σ + 0.0000016*Σ² - 0.0002574*idade
  --                   onde Σ = peitoral + abdominal + coxa
  -- 3 dobras (mulher): D = 1.0994921 - 0.0009929*Σ + 0.0000023*Σ² - 0.0001392*idade
  --                   onde Σ = tríceps + suprailíaca + coxa
  -- 7 dobras (homem): D = 1.112 - 0.00043499*Σ + 0.00000055*Σ² - 0.00028826*idade
  -- 7 dobras (mulher): D = 1.097 - 0.00046971*Σ + 0.00000056*Σ² - 0.00012828*idade
  --                   onde Σ = peitoral + axilar média + tríceps + subescapular
  --                            + abdominal + suprailíaca + coxa
  -- % gordura = (495 / D) - 450  (Siri 1961)
  -- Massa gorda  = peso * (%gordura / 100)
  -- Massa magra  = peso - massa gorda
  -- IMC = peso / (altura_m)²
  body_density        numeric(7,5),
  body_fat_pct        numeric(5,2) check (body_fat_pct is null or (body_fat_pct between 1 and 70)),
  fat_mass_kg         numeric(6,2),
  lean_mass_kg        numeric(6,2),
  bmi                 numeric(5,2),

  -- ---- Postural ----
  posture_notes  text check (posture_notes is null or char_length(posture_notes) <= 2000),
  posture_photos text[] not null default '{}',  -- array de paths no bucket posture-photos

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_assessments_student_idx
  on public.physical_assessments (student_id, assessed_at desc);

create index if not exists physical_assessments_coach_idx
  on public.physical_assessments (coach_id, assessed_at desc);

drop trigger if exists physical_assessments_set_updated_at
  on public.physical_assessments;
create trigger physical_assessments_set_updated_at
  before update on public.physical_assessments
  for each row execute function public.set_updated_at();

comment on table public.physical_assessments is
  'Avaliação física estruturada feita pelo coach. Antropometria + perimetria '
  '+ dobras + composição calculada (Jackson-Pollock 1978 / Siri 1961). '
  'RLS: coach lê/escreve dos seus alunos; aluno lê as próprias.';
```

### 3.2. Trigger de cálculo automático

```sql
-- Calcula body_density, body_fat_pct, fat_mass_kg, lean_mass_kg e bmi
-- a partir das dobras + peso + altura + idade do aluno + sexo do aluno.
-- Roda em BEFORE INSERT/UPDATE pra que os valores fiquem materializados
-- (simplifica leitura/gráfico/comparação no client).
create or replace function public.physical_assessments_compute()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_age int;
  v_sex text;            -- 'male' | 'female' (vindo de profiles.sex / [CONFIRMAR campo])
  v_sum numeric;
  v_density numeric;
begin
  -- IMC sempre que tiver peso e altura
  if new.weight_kg is not null and new.height_cm is not null and new.height_cm > 0 then
    new.bmi := round((new.weight_kg / power(new.height_cm/100.0, 2))::numeric, 2);
  else
    new.bmi := null;
  end if;

  -- Pra dobras precisamos de idade + sexo do aluno
  select extract(year from age(p.birth_date))::int, p.sex
    into v_age, v_sex
    from public.profiles p
   where p.id = new.student_id;

  -- Sem idade ou sexo definidos, não calcula composição
  if v_age is null or v_sex is null or new.protocol = 'none' then
    new.body_density := null;
    new.body_fat_pct := null;
    new.fat_mass_kg  := null;
    new.lean_mass_kg := null;
    return new;
  end if;

  if new.protocol = 'pollock_3' then
    if v_sex = 'male' then
      v_sum := coalesce(new.skin_chest_mm,0)
             + coalesce(new.skin_abdominal_mm,0)
             + coalesce(new.skin_thigh_mm,0);
      if new.skin_chest_mm is null
         or new.skin_abdominal_mm is null
         or new.skin_thigh_mm is null then
        v_sum := null;
      end if;
      if v_sum is not null then
        v_density := 1.10938 - 0.0008267*v_sum + 0.0000016*power(v_sum,2)
                     - 0.0002574*v_age;
      end if;
    elsif v_sex = 'female' then
      v_sum := coalesce(new.skin_triceps_mm,0)
             + coalesce(new.skin_suprailiac_mm,0)
             + coalesce(new.skin_thigh_mm,0);
      if new.skin_triceps_mm is null
         or new.skin_suprailiac_mm is null
         or new.skin_thigh_mm is null then
        v_sum := null;
      end if;
      if v_sum is not null then
        v_density := 1.0994921 - 0.0009929*v_sum + 0.0000023*power(v_sum,2)
                     - 0.0001392*v_age;
      end if;
    end if;
  elsif new.protocol = 'pollock_7' then
    -- 7 dobras: peitoral, axilar média, tríceps, subescapular, abdominal,
    -- supra-ilíaca, coxa
    if new.skin_chest_mm is null or new.skin_midaxillary_mm is null
       or new.skin_triceps_mm is null or new.skin_subscapular_mm is null
       or new.skin_abdominal_mm is null or new.skin_suprailiac_mm is null
       or new.skin_thigh_mm is null then
      v_sum := null;
    else
      v_sum := new.skin_chest_mm + new.skin_midaxillary_mm
             + new.skin_triceps_mm + new.skin_subscapular_mm
             + new.skin_abdominal_mm + new.skin_suprailiac_mm
             + new.skin_thigh_mm;
    end if;
    if v_sum is not null then
      if v_sex = 'male' then
        v_density := 1.112 - 0.00043499*v_sum + 0.00000055*power(v_sum,2)
                     - 0.00028826*v_age;
      elsif v_sex = 'female' then
        v_density := 1.097 - 0.00046971*v_sum + 0.00000056*power(v_sum,2)
                     - 0.00012828*v_age;
      end if;
    end if;
  end if;

  if v_density is not null and v_density > 0 then
    new.body_density := round(v_density::numeric, 5);
    new.body_fat_pct := round(((495 / v_density) - 450)::numeric, 2);
    if new.weight_kg is not null then
      new.fat_mass_kg  := round((new.weight_kg * new.body_fat_pct / 100)::numeric, 2);
      new.lean_mass_kg := round((new.weight_kg - new.fat_mass_kg)::numeric, 2);
    end if;
  else
    new.body_density := null;
    new.body_fat_pct := null;
    new.fat_mass_kg  := null;
    new.lean_mass_kg := null;
  end if;

  return new;
end;
$$;

drop trigger if exists physical_assessments_compute_trg
  on public.physical_assessments;
create trigger physical_assessments_compute_trg
  before insert or update on public.physical_assessments
  for each row execute function public.physical_assessments_compute();
```

> **Dependência:** trigger lê `profiles.birth_date` e `profiles.sex`. `[CONFIRMAR]`
> se ambos os campos já existem hoje no `profiles` (o onboarding pergunta os
> dois) — se sim, ok; senão, migration adiciona.

### 3.3. RLS — modelo igual a `coach_notes` + leitura pelo aluno

```sql
alter table public.physical_assessments enable row level security;

-- Coach vê as fichas dos seus alunos; aluno vê as próprias
drop policy if exists "pa_select_own_or_coach" on public.physical_assessments;
create policy "pa_select_own_or_coach" on public.physical_assessments
  for select using (
    (select auth.uid()) = student_id
    or (select auth.uid()) = coach_id
  );

-- Só o coach do aluno pode inserir; valida vínculo
drop policy if exists "pa_insert_coach" on public.physical_assessments;
create policy "pa_insert_coach" on public.physical_assessments
  for insert with check (
    auth.uid() = coach_id
    and student_id in (
      select id from public.profiles
       where coach_id = auth.uid() and role = 'aluno'
    )
  );

drop policy if exists "pa_update_coach" on public.physical_assessments;
create policy "pa_update_coach" on public.physical_assessments
  for update using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

drop policy if exists "pa_delete_coach" on public.physical_assessments;
create policy "pa_delete_coach" on public.physical_assessments
  for delete using (auth.uid() = coach_id);
```

> O aluno **só lê**, nunca escreve — equivale ao espelho do que o coach
> registrou. `[CONFIRMAR]` se queremos esse SELECT pro aluno no MVP ou se
> bloqueamos completamente (igual a `coach_notes`) e mostramos só na tela do
> coach.

## 4. Storage — bucket `posture-photos`

Novo bucket privado, criado via migration:

| Atributo | Valor |
|----------|-------|
| Nome | `posture-photos` |
| Público | Não (privado) |
| Prefixo | `<student_id>/<assessment_id>/<n>.jpg` |
| Mime types aceitos | `image/jpeg`, `image/png`, `image/webp` |
| Tamanho máximo | 5 MB por arquivo |
| Limite por avaliação | 6 fotos (frente, costas, lateral D, lateral E, livre x2) `[CONFIRMAR]` |
| Acesso | Signed URL gerada sob demanda; expira em 1h |

Política do bucket (igual a `meal-photos`):
- INSERT: `auth.uid() = coach_id do aluno dono do prefixo` (validado via RPC ou
  policy SQL em `storage.objects` checando `profiles.coach_id`).
- SELECT: aluno dono **ou** coach do aluno.
- DELETE: só coach do aluno.

> `[CONFIRMAR]` se vamos exigir a foto ou deixar 100% opcional. Recomendação:
> opcional no MVP. Coach pode anexar depois editando a avaliação.

## 5. UX / Telas

### 5.1. Onde fica

A aba **Evolução** atual (`(coach)/aluno/[id]/evolucao.tsx`) hoje só mostra a
timeline de `progress_entries`. Vamos mantê-la, mas reorganizar a tela em
**dois sub-segmentos** com `SegmentedControl`:

```
[ Avaliações ]   [ Marcos ]
```

- **Avaliações** (default) — feature nova: lista de fichas + ações.
- **Marcos** — `<ProgressTimeline>` existente.

Não criamos rota nova top-level pra evitar inflar tabs. O coach já vai pro
contexto certo (`evolucao.tsx`).

### 5.2. Lista de avaliações (aba Evolução → Avaliações)

```
┌──────────────────────────────────────┐
│ ← Evolução de Maria Silva            │
├──────────────────────────────────────┤
│ [ Avaliações ]   [ Marcos ]          │
├──────────────────────────────────────┤
│ + Nova avaliação                     │
│ [ Comparar ]   (habilita ao marcar 2)│
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ☐ 12 mai 2026                    │ │
│ │ Peso 78,4 kg · %G 18,2 · IMC 25  │ │
│ │ Cintura 84 cm                    │ │
│ │ [ Ver ] [ Editar ] [ Excluir ]   │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ☐ 14 abr 2026                    │ │
│ │ Peso 80,1 kg · %G 19,7 · IMC 25,5│ │
│ │ Cintura 86 cm                    │ │
│ └──────────────────────────────────┘ │
│ ...                                  │
│                                      │
│ ─── Gráfico de evolução ───          │
│ [Peso ▾] linha temporal              │
└──────────────────────────────────────┘
```

Botões:
- **Nova avaliação** → abre form em rota dedicada (ver 5.3)
- **Comparar** → habilita quando exatamente 2 cards estão marcados (checkbox)
- **Ver/Editar/Excluir** por card

### 5.3. Form de cadastro/edição

Rota nova:

```
app/(coach)/aluno/[id]/avaliacao/nova.tsx
app/(coach)/aluno/[id]/avaliacao/[avaliacaoId].tsx   # ver/editar
```

Layout em **blocos colapsáveis** (Accordion). Padrão: blocos antropometria +
perimetria abertos; dobras + postural fechados.

```
┌──────────────────────────────────────┐
│ Nova avaliação — Maria Silva         │
│ Data: [ 08/05/2026 ▾ ]               │
│ Protocolo: [3 dobras ▾] [7] [Nenhum] │
├──────────────────────────────────────┤
│ ▼ Antropometria                      │
│   Peso (kg) [____]                   │
│   Altura (cm) [____]                 │
├──────────────────────────────────────┤
│ ▼ Perimetria (cm)                    │
│   Pescoço [__]   Tórax [__]          │
│   Cintura [__]   Abdômen [__]        │
│   Quadril [__]                       │
│   Braço relax  D [__]  E [__]        │
│   Braço cont.  D [__]  E [__]        │
│   Antebraço    D [__]  E [__]        │
│   Coxa         D [__]  E [__]        │
│   Panturrilha  D [__]  E [__]        │
├──────────────────────────────────────┤
│ ▶ Dobras cutâneas (mm)               │
│   (mostra só os 3 ou 7 do protocolo) │
├──────────────────────────────────────┤
│ ▶ Postural                           │
│   [+ Foto] x6                        │
│   Notas posturais [textarea]         │
├──────────────────────────────────────┤
│ Observações gerais [textarea]        │
├──────────────────────────────────────┤
│ Cálculos (preview, lê do trigger)    │
│   IMC: 24,8                          │
│   % gordura: 18,2 (Pollock 3)        │
│   Massa magra: 64,1 kg               │
├──────────────────────────────────────┤
│ [ Cancelar ]            [ Salvar ]   │
└──────────────────────────────────────┘
```

Validações:
- `assessed_at` obrigatório (default = hoje)
- `weight_kg` recomendado (sem ele não calcula massa magra, mas não trava)
- Pelo menos 1 campo preenchido fora de metadata (se vier tudo vazio, bloqueia)
- Se protocolo = `pollock_3`/`pollock_7`, validar visualmente que as dobras do
  conjunto estão preenchidas pra mostrar % gordura — caso contrário, exibir
  aviso "preencha as 3/7 dobras pra calcular % gordura". Não trava o save
  (pode salvar sem dobras, só sem cálculo).

### 5.4. Tela de visualização (read-only)

Mesma estrutura do form, mas só leitura. Mostra cálculos no topo em destaque
(card grande com peso, %G, MM, IMC).

### 5.5. Tela de comparação

Rota:

```
app/(coach)/aluno/[id]/avaliacao/comparar.tsx?a=<id1>&b=<id2>
```

Layout 2 colunas com delta na 3ª coluna:

```
┌──────────────────────────────────────────────────┐
│ ← Comparar avaliações — Maria Silva              │
├──────────────────────────────────────────────────┤
│              14 abr 2026   12 mai 2026   Δ       │
├──────────────────────────────────────────────────┤
│ Peso (kg)        80,1         78,4    -1,7 (-2%) │
│ % gordura        19,7         18,2    -1,5 pp    │
│ IMC              25,5         25,0    -0,5       │
│ Cintura (cm)     86           84      -2 (-2%)   │
│ Quadril (cm)     98           97      -1 (-1%)   │
│ Braço D rel.     34           34       0         │
│ ...                                              │
└──────────────────────────────────────────────────┘
```

Delta verde se evoluiu na direção positiva (perda de % gordura, ganho de
massa magra), vermelho se piorou, cinza se neutro. **Direção positiva é
configurada por campo** numa lookup (peso/%gordura/cintura ↓ é bom; massa
magra/perímetros de braço/coxa ↑ pode ser bom — `[CONFIRMAR]` se vamos
mostrar cores ou só números puros no MVP).

### 5.6. Gráfico de evolução

Embaixo da lista, um card com:
- Picker de métrica: `Peso`, `% gordura`, `IMC`, `Cintura`, `Quadril`, `Braço D`,
  `Coxa D`, `Massa magra`
- Gráfico de linha (lib `react-native-gifted-charts` se já no projeto, senão
  `victory-native` — `[CONFIRMAR]` qual lib adotar; checar
  `package.json`) com pontos = avaliações ordenadas por `assessed_at`
- Tooltip ao tocar mostra valor + data

### 5.7. Resumo na tela do aluno

Em `app/(tabs)/perfil.tsx` (ou onde for melhor), card novo:

```
┌──────────────────────────────────────┐
│ Última avaliação física              │
│ 12 mai 2026                          │
│ Peso 78,4 kg · %G 18,2 · IMC 25,0    │
│                          [ Ver tudo ]│
└──────────────────────────────────────┘
```

`[ Ver tudo ]` abre uma rota nova read-only `app/avaliacao-fisica.tsx` (ou
similar) com lista de avaliações dele em modo aluno (sem botões de
editar/excluir/criar). `[CONFIRMAR]` se vale a pena ter essa rota no MVP ou
só o card resumo.

## 6. Cálculos — referência

A fórmula está documentada in-line no SQL (seção 3.1). Resumindo:

### 6.1. Densidade corporal (Jackson-Pollock 1978)

| Protocolo | Sexo | Soma de dobras (Σ) | Fórmula |
|-----------|------|--------------------|---------|
| 3 dobras | Homem | peitoral + abdominal + coxa | `D = 1.10938 − 0.0008267·Σ + 0.0000016·Σ² − 0.0002574·idade` |
| 3 dobras | Mulher | tríceps + suprailíaca + coxa | `D = 1.0994921 − 0.0009929·Σ + 0.0000023·Σ² − 0.0001392·idade` |
| 7 dobras | Homem | peitoral + axilar média + tríceps + subescapular + abdominal + suprailíaca + coxa | `D = 1.112 − 0.00043499·Σ + 0.00000055·Σ² − 0.00028826·idade` |
| 7 dobras | Mulher | mesmas 7 | `D = 1.097 − 0.00046971·Σ + 0.00000056·Σ² − 0.00012828·idade` |

### 6.2. Demais

- **% gordura (Siri 1961):** `BF% = (495 / D) − 450`
- **Massa gorda:** `MG = peso · BF% / 100`
- **Massa magra:** `MM = peso − MG`
- **IMC:** `peso_kg / (altura_m)²`

### 6.3. Recomendação de protocolo padrão

**Pollock 3 dobras** como default. É mais rápido na consulta e é o protocolo
mais usado em academia. **Pollock 7** fica disponível como opção avançada
(maior precisão, principalmente em atletas). Suporte aos dois — UI mostra só
os campos do protocolo escolhido.

## 7. Estimativa por sub-task

| # | Sub-task | Estimativa |
|---|----------|-----------|
| 1 | Migration: tabela `physical_assessments` + índices + trigger `set_updated_at` | 2 h |
| 2 | Migration: trigger `physical_assessments_compute` (cálculos) | 3 h |
| 3 | Migration: políticas RLS | 1 h |
| 4 | Migration: bucket `posture-photos` + policies | 2 h |
| 5 | Service `src/services/physicalAssessments.ts` (CRUD + upload de foto + signed URL) | 4 h |
| 6 | Hooks React Query (list, get, create, update, delete, compare) | 2 h |
| 7 | Refatorar `evolucao.tsx` com SegmentedControl Avaliações/Marcos | 1,5 h |
| 8 | Tela de lista de avaliações + cards | 3 h |
| 9 | Tela de form (nova/editar) — blocos colapsáveis, validação, preview de cálculos | 8 h |
| 10 | Tela de visualização read-only | 2 h |
| 11 | Tela de comparação (2 avaliações) | 4 h |
| 12 | Gráfico de evolução com seletor de métrica | 4 h |
| 13 | Card resumo no perfil do aluno + (opcional) rota read-only completa | 3 h |
| 14 | Upload/preview de fotos posturais (até 6) | 4 h |
| 15 | Testes manuais de RLS (coach vê só seus alunos, aluno só as próprias, comum nada) | 1,5 h |
| 16 | Testes manuais dos cálculos (planilha de validação com casos esperados) | 2 h |
| 17 | Polimento, copy PT-BR, vazios, loadings, erros | 3 h |
| **Total** | | **~50 h (≈ 6,5 dias úteis)** |

Sugestão de divisão em commits dentro de **uma branch única**
(`feature/physical-assessments`, conforme convenção):

1. `feat(db): tabela physical_assessments + RLS + trigger de cálculo`
2. `feat(storage): bucket posture-photos privado`
3. `feat(services): physicalAssessments service + hooks`
4. `feat(coach): aba Avaliações no detalhe do aluno (lista)`
5. `feat(coach): form de nova/editar avaliação física`
6. `feat(coach): tela de comparação entre 2 avaliações`
7. `feat(coach): gráfico de evolução das métricas-chave`
8. `feat(student): card resumo da última avaliação no perfil do aluno`
9. `chore: copy/polimento + testes manuais documentados`

## 8. Pontos a confirmar com o dev

- **`[CONFIRMAR]` campos `birth_date` e `sex` em `profiles`** — o trigger de
  cálculo depende deles. Se não existem, adicionar antes (idealmente no
  onboarding já há `birth_year` ou similar; conferir nome real).
- **`[CONFIRMAR]` valor enum de `sex`** — `'male'`/`'female'` ou
  `'masculino'`/`'feminino'`? A fórmula precisa do mapping certo.
- **`[CONFIRMAR]` protocolo único ou múltiplo** — recomendação é suportar
  `pollock_3` (default) e `pollock_7` no MVP. `pollock_3` cobre 95% dos
  casos. Decisão: aceitar ambos.
- **`[CONFIRMAR]` foto postural obrigatória ou opcional** — recomendação:
  opcional no MVP.
- **`[CONFIRMAR]` aluno enxerga avaliação** — RLS está proposta permitindo
  SELECT pro aluno. Alternativa = bloquear (igual `coach_notes`) e o aluno só
  vê via card resumo gerado por uma view ou edge function. Recomendação:
  permitir SELECT direto (mais simples, transparência boa pro aluno).
- **`[CONFIRMAR]` limite de fotos posturais** — sugerido 6 (frente, costas,
  lateral D, lateral E, livre x2).
- **`[CONFIRMAR]` direção positiva por métrica nos deltas** — coloriza verde
  baseado em "objetivo" do aluno? `profiles.objective` (perda/ganho/manutenção)
  já existe e poderia inverter cores. Ou ficar neutro no MVP (só números).
- **`[CONFIRMAR]` lib de gráfico** — se já tem `victory-native` ou
  `react-native-gifted-charts` instalado, reusar; senão escolher uma.
- **`[CONFIRMAR]` rota dedicada do aluno (`avaliacao-fisica.tsx`)** — ou só
  card resumo no perfil já basta no MVP?
- **`[CONFIRMAR]` edição/exclusão pelo coach que **não** é o autor original**
  — caso o aluno troque de coach, o novo coach pode editar avaliações antigas?
  Hoje a RLS de UPDATE checa `auth.uid() = coach_id` (autor original). Pode
  precisar afrouxar pra `coach_id do aluno hoje`.

## 9. Fora de escopo

- Bioimpedância (BIA) e DEXA — só dobras no MVP
- Outros protocolos além de Pollock (Petroski, Guedes, Faulkner) — fica como
  evolução; arquitetura aceita novos valores em `protocol`
- Ficha postural com marcação visual (tipo "ombro elevado D") — só texto e
  fotos por enquanto
- Auto-avaliação pelo aluno (paciente registrar próprias medidas)
- Exportar PDF da ficha
- Integração com balança bluetooth
- Comparar > 2 avaliações de uma vez
- Lembrete automático de "reavaliar" (vence em N semanas)
- Cálculo de TMB, GET, água corporal, densidade óssea
- Histórico audita-mudanças (quem editou o quê e quando) — fora do MVP
