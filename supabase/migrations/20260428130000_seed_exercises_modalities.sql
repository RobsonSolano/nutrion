-- =====================================================================
-- NutriOn — Seed de exercícios pra modalidades novas
-- Adiciona ~70 exercícios em Calistenia, CrossFit, Corrida e Genérico,
-- reusando os exercise_groups existentes (chest/back/legs/shoulders/
-- biceps/triceps/core/full_body/cardio).
--
-- Imagens (Free Exercise DB via jsDelivr) só pra slugs com alta confiança.
-- Os demais ficam image_urls=null e podem ser mapeados depois.
--
-- Idempotente: usa unique (group_id, name) já existente em exercises.
-- =====================================================================

do $$
declare
  g_chest     uuid;
  g_back      uuid;
  g_legs      uuid;
  g_shoulders uuid;
  g_biceps    uuid;
  g_triceps   uuid;
  g_core      uuid;
  g_full      uuid;
  g_cardio    uuid;
begin
  select id into g_chest     from public.exercise_groups where slug = 'chest';
  select id into g_back      from public.exercise_groups where slug = 'back';
  select id into g_legs      from public.exercise_groups where slug = 'legs';
  select id into g_shoulders from public.exercise_groups where slug = 'shoulders';
  select id into g_biceps    from public.exercise_groups where slug = 'biceps';
  select id into g_triceps   from public.exercise_groups where slug = 'triceps';
  select id into g_core      from public.exercise_groups where slug = 'core';
  select id into g_full      from public.exercise_groups where slug = 'full_body';
  select id into g_cardio    from public.exercise_groups where slug = 'cardio';

  -- ==================================================================
  -- CALISTENIA (~30) — peso corporal, foco em progressões
  -- ==================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    -- Push (peito/triceps/ombro)
    (g_chest,     'Flexão pegada larga',           'peso corporal', true,  'calistenia'),
    (g_chest,     'Flexão diamante',                'peso corporal', true,  'calistenia'),
    (g_chest,     'Flexão declinada',               'peso corporal', true,  'calistenia'),
    (g_chest,     'Flexão inclinada',               'peso corporal', true,  'calistenia'),
    (g_chest,     'Flexão arqueira',                'peso corporal', true,  'calistenia'),
    (g_chest,     'Flexão explosiva',               'peso corporal', true,  'calistenia'),
    (g_shoulders, 'Pike push-up',                   'peso corporal', true,  'calistenia'),
    (g_shoulders, 'Handstand push-up',              'peso corporal', true,  'calistenia'),
    (g_triceps,   'Mergulho em paralelas (calistenia)', 'peso corporal', true, 'calistenia'),
    (g_triceps,   'Mergulho no banco',              'peso corporal', true,  'calistenia'),
    -- Pull (costas/biceps)
    (g_back,      'Barra fixa pronada',             'peso corporal', true,  'calistenia'),
    (g_back,      'Barra fixa supinada',            'peso corporal', true,  'calistenia'),
    (g_back,      'Barra fixa pegada larga',        'peso corporal', true,  'calistenia'),
    (g_back,      'Barra fixa fechada',             'peso corporal', true,  'calistenia'),
    (g_back,      'Barra australiana',              'peso corporal', true,  'calistenia'),
    (g_back,      'Muscle-up',                      'peso corporal', true,  'calistenia'),
    -- Legs
    (g_legs,      'Agachamento livre (peso corporal)', 'peso corporal', true, 'calistenia'),
    (g_legs,      'Pistol squat',                   'peso corporal', true,  'calistenia'),
    (g_legs,      'Afundo (peso corporal)',         'peso corporal', true,  'calistenia'),
    (g_legs,      'Afundo com salto',               'peso corporal', true,  'calistenia'),
    (g_legs,      'Step-up (peso corporal)',        'peso corporal', true,  'calistenia'),
    (g_legs,      'Agachamento com salto',          'peso corporal', true,  'calistenia'),
    -- Core
    (g_core,      'Prancha',                        'peso corporal', false, 'calistenia'),
    (g_core,      'Prancha lateral',                'peso corporal', false, 'calistenia'),
    (g_core,      'Hollow body hold',               'peso corporal', false, 'calistenia'),
    (g_core,      'L-sit',                          'peso corporal', false, 'calistenia'),
    (g_core,      'Elevação de pernas suspensa',    'peso corporal', false, 'calistenia'),
    (g_core,      'Elevação de joelhos suspensa',   'peso corporal', false, 'calistenia'),
    -- Full body
    (g_full,      'Burpee',                         'peso corporal', true,  'calistenia'),
    (g_full,      'Bear crawl',                     'peso corporal', true,  'calistenia'),
    (g_full,      'Mountain climber',               'peso corporal', true,  'calistenia')
  on conflict (group_id, name) do nothing;

  -- ==================================================================
  -- CROSSFIT (~25) — movimentos olímpicos + WOD staples
  -- ==================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_full,      'Kettlebell swing russo',         'kettlebell',    true,  'crossfit'),
    (g_full,      'Kettlebell swing americano',     'kettlebell',    true,  'crossfit'),
    (g_legs,      'Goblet squat',                   'kettlebell',    true,  'crossfit'),
    (g_full,      'Box jump',                       'caixa',         true,  'crossfit'),
    (g_full,      'Wall ball',                      'medicine ball', true,  'crossfit'),
    (g_full,      'Thruster',                       'barra',         true,  'crossfit'),
    (g_shoulders, 'Push press',                     'barra',         true,  'crossfit'),
    (g_full,      'Power clean',                    'barra',         true,  'crossfit'),
    (g_full,      'Snatch',                         'barra',         true,  'crossfit'),
    (g_back,      'Deadlift (CrossFit)',            'barra',         true,  'crossfit'),
    (g_back,      'Sumô deadlift high pull',        'barra',         true,  'crossfit'),
    (g_full,      'Burpee box jump-over',           'caixa',         true,  'crossfit'),
    (g_cardio,    'Double under',                   'corda',         false, 'crossfit'),
    (g_cardio,    'Single under',                   'corda',         false, 'crossfit'),
    (g_core,      'Toes to bar',                    'barra',         true,  'crossfit'),
    (g_core,      'Knees to elbow',                 'barra',         true,  'crossfit'),
    (g_triceps,   'Ring dips',                      'argolas',       true,  'crossfit'),
    (g_back,      'Muscle-up nas argolas',          'argolas',       true,  'crossfit'),
    (g_full,      'Subida na corda',                'corda',         true,  'crossfit'),
    (g_full,      'Sled push',                      'sled',          true,  'crossfit'),
    (g_full,      'Farmer walk',                    'halter',        true,  'crossfit'),
    (g_full,      'Turkish get-up',                 'kettlebell',    true,  'crossfit'),
    (g_cardio,    'Row 500m',                       'remo',          true,  'crossfit'),
    (g_cardio,    'Assault bike',                   'bike',          true,  'crossfit'),
    (g_cardio,    'Ski erg',                        'ski erg',       true,  'crossfit')
  on conflict (group_id, name) do nothing;

  -- ==================================================================
  -- CORRIDA (~6) — protocolos (sem imagens, são tipos de treino)
  -- ==================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_cardio, 'Tiros 400m',         'pista/rua', true,  'corrida'),
    (g_cardio, 'Treino intervalado', 'pista/rua', true,  'corrida'),
    (g_cardio, 'Fartlek',            'pista/rua', true,  'corrida'),
    (g_cardio, 'Longão (long run)',  'rua',       true,  'corrida'),
    (g_cardio, 'Regenerativo',       'rua',       false, 'corrida'),
    (g_cardio, 'Limiar (threshold)', 'pista/rua', true,  'corrida')
  on conflict (group_id, name) do nothing;

  -- ==================================================================
  -- GENÉRICO (~10) — mobilidade, alongamento, regeneração
  -- ==================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_full, 'Foam roll quadríceps',                     'rolo',           false, 'generico'),
    (g_full, 'Foam roll panturrilha',                    'rolo',           false, 'generico'),
    (g_full, 'Foam roll costas',                         'rolo',           false, 'generico'),
    (g_full, 'Mobilidade de ombro (PVC pass-through)',   'cano/elástico',  false, 'generico'),
    (g_full, 'Cat-cow',                                  'peso corporal',  false, 'generico'),
    (g_full, 'World''s greatest stretch',                'peso corporal',  false, 'generico'),
    (g_full, 'Mobilidade de quadril (90/90)',            'peso corporal',  false, 'generico'),
    (g_full, 'Alongamento de posterior em pé',           'peso corporal',  false, 'generico'),
    (g_full, 'Alongamento de panturrilha em pé',         'peso corporal',  false, 'generico'),
    (g_full, 'Hip flexor stretch',                       'peso corporal',  false, 'generico')
  on conflict (group_id, name) do nothing;
end $$;

-- =====================================================================
-- Imagens (Free Exercise DB) — slugs com alta confiança apenas.
-- Pra slugs duvidosos deixei null; refino depois conforme validar.
-- =====================================================================
do $$
declare
  matches text[][] := array[
    -- Calistenia
    ['Flexão diamante',                       'Diamond_Pushup'],
    ['Flexão declinada',                      'Decline_Pushup'],
    ['Flexão inclinada',                      'Incline_Pushup'],
    ['Pike push-up',                          'Pike_Pushup'],
    ['Handstand push-up',                     'Handstand_Push-up'],
    ['Mergulho no banco',                     'Bench_Dips'],
    ['Mergulho em paralelas (calistenia)',    'Dips_-_Triceps_Version'],
    ['Barra fixa pronada',                    'Pullups'],
    ['Barra fixa supinada',                   'Chin-Up'],
    ['Barra fixa fechada',                    'Close-Grip_Chin-Up'],
    ['Barra australiana',                     'Inverted_Row'],
    ['Muscle-up',                             'Muscle_Up'],
    ['Agachamento livre (peso corporal)',     'Bodyweight_Squat'],
    ['Pistol squat',                          'Pistols'],
    ['Afundo (peso corporal)',                'Bodyweight_Walking_Lunge'],
    ['Step-up (peso corporal)',               'Bodyweight_Step-up'],
    ['Prancha',                               'Plank'],
    ['Prancha lateral',                       'Side_Bridge'],
    ['Hollow body hold',                      'Hollow_Body_Hold'],
    ['L-sit',                                 'L-Sit_On_Floor'],
    ['Elevação de pernas suspensa',           'Hanging_Leg_Raise'],
    ['Elevação de joelhos suspensa',          'Hanging_Knee_Raise'],
    ['Mountain climber',                      'Mountain_Climbers'],
    ['Burpee',                                'Burpees'],
    ['Bear crawl',                            'Bear_Crawl'],
    ['Afundo com salto',                      'Jumping_Lunges'],
    ['Agachamento com salto',                 'Jump_Squat'],
    -- CrossFit
    ['Kettlebell swing russo',                'Kettlebell_Swing'],
    ['Kettlebell swing americano',            'Kettlebell_Swing'],
    ['Goblet squat',                          'Goblet_Squat'],
    ['Box jump',                              'Box_Jump'],
    ['Thruster',                              'Thruster'],
    ['Push press',                            'Push_Press'],
    ['Power clean',                           'Power_Clean'],
    ['Snatch',                                'Power_Snatch'],
    ['Deadlift (CrossFit)',                   'Deadlift'],
    ['Toes to bar',                           'Toes_To_Bar'],
    ['Knees to elbow',                        'Hanging_Knee_Raise'],
    ['Ring dips',                             'Ring_Dips'],
    ['Muscle-up nas argolas',                 'Muscle_Up'],
    ['Subida na corda',                       'Rope_Climb'],
    ['Sled push',                             'Sled_Drag_-_Forward_Walk'],
    ['Farmer walk',                           'Farmers_Walk'],
    ['Turkish get-up',                        'Turkish_Get-Up'],
    -- Genérico
    ['Cat-cow',                               'Cat_Stretch'],
    ['World''s greatest stretch',             'Worlds_Greatest_Stretch'],
    ['Alongamento de posterior em pé',        'Standing_Hamstring_Stretch'],
    ['Hip flexor stretch',                    'Iliopsoas_Stretch'],
    ['Foam roll quadríceps',                  'Iliotibial_Tract-SMR'],
    ['Foam roll panturrilha',                 'Calves-SMR'],
    ['Foam roll costas',                      'Upper_Back-SMR']
  ];
  exercise_name text;
  slug text;
begin
  for i in 1..array_length(matches, 1) loop
    exercise_name := matches[i][1];
    slug := matches[i][2];
    update public.exercises
       set image_urls = public.exercise_image_urls(slug)
     where name = exercise_name
       and image_urls is null;
  end loop;
end $$;
