-- =====================================================================
-- NutriOn — Referências bibliográficas para a IA
-- Cria a tabela `bibliography_references` (catálogo global, curadoria
-- manual) que é injetada nos prompts das edge functions de IA pra dar
-- credibilidade às respostas. A IA é instruída a citar no final da
-- resposta as referências que efetivamente embasaram o raciocínio
-- (formato "Referência utilizada: <short_name>, ...").
--
-- Filtragem por `tags`: cada edge function escolhe quais tags são
-- relevantes (chat geral pega 'nutricao' + 'treino' + 'geral';
-- sanity_check pega 'nutricao' + 'geral'; onboarding-plan pega tudo).
-- =====================================================================

create table if not exists public.bibliography_references (
  id uuid primary key default gen_random_uuid(),
  short_name text not null unique,
  full_citation text not null,
  url text,
  tags text[] not null check (array_length(tags, 1) > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists bibliography_references_tags_idx
  on public.bibliography_references using gin (tags);

create index if not exists bibliography_references_active_idx
  on public.bibliography_references (is_active, sort_order);

comment on table public.bibliography_references is
  'Referências bibliográficas usadas pela IA pra embasar respostas. Curadoria manual via Supabase Studio.';
comment on column public.bibliography_references.short_name is
  'Nome curto que a IA cita no final da resposta (ex: "ABESO 2024", "ACSM Guidelines").';
comment on column public.bibliography_references.tags is
  'Tags pra filtragem por contexto: nutricao | treino | geral. Pode combinar.';

-- ---------------------------------------------------------------------
-- RLS: catálogo global, mesma política de exercise_groups (leitura
-- aberta pra qualquer um — nada sensível).
-- ---------------------------------------------------------------------
alter table public.bibliography_references enable row level security;

drop policy if exists "bibliography_references_select_all"
  on public.bibliography_references;
create policy "bibliography_references_select_all"
  on public.bibliography_references
  for select using (true);

-- ---------------------------------------------------------------------
-- Seed inicial — 12 referências canônicas (nutrição, treino,
-- suplementação, cardiologia, hidratação). Editável via Supabase Studio.
--
-- Critério: posicionamentos oficiais de sociedades, diretrizes de
-- órgãos públicos (OMS, ABESO, SBC) e position stands da ISSN — fontes
-- com revisão por pares e consenso amplo, evitando opinião isolada.
-- ---------------------------------------------------------------------
insert into public.bibliography_references (short_name, full_citation, url, tags, sort_order) values
  (
    'ABESO 2024',
    'Diretrizes Brasileiras de Obesidade — Associação Brasileira para o Estudo da Obesidade e da Síndrome Metabólica (ABESO), edição 2024.',
    'https://abeso.org.br/',
    array['nutricao', 'geral'],
    10
  ),
  (
    'SBEM — Tratamento da Obesidade',
    'Sociedade Brasileira de Endocrinologia e Metabologia (SBEM) — Posicionamento sobre Tratamento da Obesidade e Sobrepeso.',
    'https://www.endocrino.org.br/',
    array['nutricao'],
    20
  ),
  (
    'ACSM Guidelines 11ª ed.',
    'American College of Sports Medicine — ACSM''s Guidelines for Exercise Testing and Prescription, 11th edition. Wolters Kluwer, 2021.',
    'https://www.acsm.org/',
    array['treino', 'geral'],
    30
  ),
  (
    'ISSN — Proteína e Exercício',
    'International Society of Sports Nutrition Position Stand: protein and exercise. Journal of the International Society of Sports Nutrition, 2017. Jäger R. et al.',
    'https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8',
    array['nutricao', 'treino'],
    40
  ),
  (
    'OMS — Atividade Física 2020',
    'World Health Organization — Guidelines on Physical Activity and Sedentary Behaviour. WHO, 2020.',
    'https://www.who.int/publications/i/item/9789240015128',
    array['treino', 'geral'],
    50
  ),
  (
    'NSCA — Treino de Força',
    'Essentials of Strength Training and Conditioning — National Strength and Conditioning Association (NSCA), 4th edition. Human Kinetics, 2016.',
    null,
    array['treino'],
    60
  ),
  (
    'DRI / IOM',
    'Dietary Reference Intakes (DRIs) — Institute of Medicine / National Academies. Recomendações de macronutrientes, micronutrientes e energia.',
    'https://www.nationalacademies.org/our-work/dietary-reference-intakes-tables-and-application',
    array['nutricao', 'geral'],
    70
  ),
  (
    'ISSN — Hidratação no Exercício',
    'International Society of Sports Nutrition Position Stand: nutrient timing and exercise hydration. Journal of the International Society of Sports Nutrition.',
    'https://jissn.biomedcentral.com/',
    array['nutricao', 'treino', 'geral'],
    80
  ),
  (
    'ISSN — Creatina',
    'International Society of Sports Nutrition Position Stand: safety and efficacy of creatine supplementation. Kreider RB et al., 2017.',
    'https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0173-z',
    array['nutricao', 'treino'],
    90
  ),
  (
    'Schoenfeld — Hipertrofia',
    'Schoenfeld BJ. Science and Development of Muscle Hypertrophy, 2nd edition. Human Kinetics, 2020. Meta-análises sobre volume, frequência e intensidade.',
    null,
    array['treino'],
    100
  ),
  (
    'SBC — Diretrizes de Cardiologia',
    'Diretrizes da Sociedade Brasileira de Cardiologia (SBC) sobre exercício, prevenção cardiovascular e reabilitação cardíaca.',
    'https://www.portal.cardiol.br/',
    array['treino', 'geral'],
    110
  ),
  (
    'OMS — Alimentação Saudável',
    'World Health Organization — Healthy Diet Fact Sheet. Recomendações sobre macronutrientes, sódio, açúcar e fibras.',
    'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    array['nutricao', 'geral'],
    120
  )
on conflict (short_name) do nothing;
