-- =====================================================================
-- NutriOn — Imagens dos exercícios v2
-- 1) Popula image_urls dos exercícios que ficaram sem mapeamento na
--    migration 20260423140000_exercise_images.sql (incluindo modalidades
--    de cardio/calistenia/crossfit adicionadas em migrations posteriores).
-- 2) Adiciona coluna video_url text (1 vídeo por exercício, nullable).
--
-- Fonte: yuhonas/free-exercise-db (CC0) via jsDelivr CDN.
-- Idempotente — só atualiza linhas que ainda estão NULL.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Coluna video_url
-- ---------------------------------------------------------------------
alter table public.exercises
  add column if not exists video_url text;

comment on column public.exercises.video_url is
  'URL única de vídeo demonstrativo (YouTube ou similar). Null quando não mapeado.';

-- ---------------------------------------------------------------------
-- 2. Popula image_urls faltantes
-- Helper public.exercise_image_urls(slug) já criado na migration anterior.
-- ---------------------------------------------------------------------
do $$
declare
  matches text[][] := array[
    -- Peito
    ['Supino reto (máquina)',         'Smith_Machine_Bench_Press'],
    ['Supino inclinado (máquina)',    'Smith_Machine_Incline_Bench_Press'],
    ['Crossover baixo (cabos)',       'Low_Cable_Crossover'],
    ['Flexão arqueira',               'Pushups'],
    ['Flexão explosiva',              'Plyo_Push-up'],
    ['Flexão pegada larga',           'Pushups'],

    -- Costas
    ['Barra fixa pegada larga',       'Wide-Grip_Pulldown_Behind_The_Neck'],
    ['Remada máquina',                'Seated_Cable_Rows'],

    -- Pernas
    ['Agachamento búlgaro (halteres)','Dumbbell_Rear_Lunge'],
    ['Cadeira abdutora',              'Thigh_Abductor'],
    ['Cadeira adutora',               'Thigh_Adductor'],
    ['Alongamento de panturrilha em pé', 'Standing_Gastrocnemius_Calf_Stretch'],
    ['Mobilidade de quadril (90/90)', 'Hip_Circles_prone'],

    -- Ombros
    ['Elevação frontal (halteres)',   'Front_Dumbbell_Raise'],
    ['Mobilidade de ombro (PVC pass-through)', 'Shoulder_Stretch'],

    -- Bíceps
    ['Rosca direta (halteres)',       'Dumbbell_Bicep_Curl'],
    ['Rosca 21 (barra)',              'Barbell_Curl'],

    -- Tríceps
    ['Tríceps testa (halter)',        'Lying_Dumbbell_Tricep_Extension'],
    ['Mergulho em máquina assistida', 'Weighted_Bench_Dip'],

    -- Core
    ['Dead bug',                      'Dead_Bug'],

    -- Full body / funcional
    ['Sumô deadlift high pull',       'Sumo_Deadlift_with_Bands'],
    ['Wall ball',                     'Kettlebell_Thruster'],
    ['Burpee box jump-over',          'Front_Box_Jump'],

    -- Cardio
    ['Assault bike',                  'Air_Bike'],
    ['Bicicleta (ao ar livre)',       'Bicycling'],
    ['Escada / Stair',                'Stairmaster'],
    ['Row 500m',                      'Rowing_Stationary'],
    ['Tiros 400m',                    'Running_Treadmill'],
    ['Fartlek',                       'Running_Treadmill'],
    ['Longão (long run)',             'Running_Treadmill'],
    ['Limiar (threshold)',            'Running_Treadmill'],
    ['Treino intervalado',            'Running_Treadmill'],
    ['HIIT',                          'Running_Treadmill'],
    ['Regenerativo',                  'Walking_Treadmill'],
    ['Double under',                  'Rope_Jumping'],
    ['Single under',                  'Rope_Jumping']
  ];
begin
  for i in 1 .. array_length(matches, 1) loop
    update public.exercises
       set image_urls = public.exercise_image_urls(matches[i][2])
     where name = matches[i][1]
       and image_urls is null;
  end loop;
end $$;
