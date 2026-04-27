-- =====================================================================
-- NutriOn — Imagens dos exercícios (demonstração visual)
-- Adiciona coluna image_urls text[] em exercises e popula com URLs
-- do Free Exercise DB (CC0) servidas via jsDelivr CDN:
--   https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/<id>/N.jpg
-- =====================================================================

alter table public.exercises
  add column if not exists image_urls text[];

comment on column public.exercises.image_urls is
  'URLs das imagens de demonstração (Free Exercise DB via jsDelivr). Null quando ainda não mapeado.';

-- ---------------------------------------------------------------------
-- Helper: gera as URLs das imagens 0.jpg e 1.jpg de um slug do dataset.
-- ---------------------------------------------------------------------
create or replace function public.exercise_image_urls(slug text)
returns text[]
language sql
immutable
as $$
  select array[
    'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/' || slug || '/0.jpg',
    'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/' || slug || '/1.jpg'
  ];
$$;

-- ---------------------------------------------------------------------
-- Mapeamento PT-BR → slug do Free Exercise DB
-- (Atualizado em 2026-04-23; ajustável manualmente conforme forem
-- validadas novas correspondências.)
-- ---------------------------------------------------------------------
do $$
declare
  m record;
  matches text[][] := array[
    -- Peito
    ['Supino reto (barra)',          'Barbell_Bench_Press_-_Medium_Grip'],
    ['Supino reto (halteres)',       'Dumbbell_Bench_Press'],
    ['Supino inclinado (barra)',     'Barbell_Incline_Bench_Press_-_Medium_Grip'],
    ['Supino inclinado (halteres)',  'Incline_Dumbbell_Press'],
    ['Supino declinado (barra)',     'Decline_Barbell_Bench_Press'],
    ['Crucifixo reto (halteres)',    'Dumbbell_Flyes'],
    ['Crucifixo inclinado (halteres)', 'Incline_Dumbbell_Flyes'],
    ['Crossover alto (cabos)',       'Cable_Crossover'],
    ['Peck deck (máquina)',          'Butterfly'],
    ['Pullover (halter)',            'Straight-Arm_Dumbbell_Pullover'],
    ['Flexão de braço',              'Pushups'],
    ['Mergulho em paralelas',        'Dips_-_Chest_Version'],

    -- Costas
    ['Levantamento terra (barra)',   'Barbell_Deadlift'],
    ['Puxada frontal (pulley)',      'Wide-Grip_Lat_Pulldown'],
    ['Puxada atrás (pulley)',        'Wide-Grip_Pulldown_Behind_The_Neck'],
    ['Puxada triângulo (pulley)',    'V-Bar_Pulldown'],
    ['Remada curvada (barra)',       'Bent_Over_Barbell_Row'],
    ['Remada curvada (halteres)',    'Bent_Over_Two-Dumbbell_Row'],
    ['Remada cavalinho',             'Bent_Over_One-Arm_Long_Bar_Row'],
    ['Remada baixa (pulley)',        'Seated_Cable_Rows'],
    ['Remada unilateral (halter)',   'One-Arm_Dumbbell_Row'],
    ['Barra fixa (pronada)',         'Pullups'],
    ['Barra fixa (supinada)',        'Chin-Up'],
    ['Pull-down (pulley)',           'Close-Grip_Front_Lat_Pulldown'],

    -- Pernas
    ['Agachamento livre (barra)',    'Barbell_Full_Squat'],
    ['Agachamento frontal (barra)',  'Front_Squat_Clean_Grip'],
    ['Leg press 45°',                'Leg_Press'],
    ['Leg press horizontal',         'Narrow_Stance_Leg_Press'],
    ['Hack squat',                   'Hack_Squat'],
    ['Cadeira extensora',            'Leg_Extensions'],
    ['Mesa flexora',                 'Lying_Leg_Curls'],
    ['Cadeira flexora',              'Seated_Leg_Curl'],
    ['Stiff (barra)',                'Stiff-Legged_Barbell_Deadlift'],
    ['Stiff (halteres)',             'Stiff-Legged_Dumbbell_Deadlift'],
    ['Afundo (halteres)',            'Dumbbell_Lunges'],
    ['Avanço (barra)',               'Barbell_Lunge'],
    ['Panturrilha em pé (máquina)',  'Standing_Calf_Raises'],
    ['Panturrilha sentado (máquina)','Seated_Calf_Raise'],
    ['Panturrilha no leg press',     'Calf_Press_On_The_Leg_Press_Machine'],

    -- Ombros
    ['Desenvolvimento (barra)',      'Barbell_Shoulder_Press'],
    ['Desenvolvimento (halteres)',   'Dumbbell_Shoulder_Press'],
    ['Desenvolvimento (máquina)',    'Leverage_Shoulder_Press'],
    ['Arnold press (halteres)',      'Arnold_Dumbbell_Press'],
    ['Elevação lateral (halteres)',  'Seated_Side_Lateral_Raise'],
    ['Elevação lateral (cabo)',      'Cable_Seated_Lateral_Raise'],
    ['Elevação frontal (cabo)',      'Front_Cable_Raise'],
    ['Elevação posterior (halteres)','Dumbbell_Lying_Rear_Lateral_Raise'],
    ['Face pull (cabo)',             'Face_Pull'],
    ['Remada alta (barra)',          'Upright_Barbell_Row'],
    ['Encolhimento (halteres)',      'Dumbbell_Shrug'],
    ['Encolhimento (barra)',         'Barbell_Shrug'],

    -- Bíceps
    ['Rosca direta (barra)',         'Barbell_Curl'],
    ['Rosca direta (W)',             'EZ-Bar_Curl'],
    ['Rosca alternada (halteres)',   'Seated_Dumbbell_Curl'],
    ['Rosca martelo (halteres)',     'Hammer_Curls'],
    ['Rosca Scott (barra)',          'Preacher_Curl'],
    ['Rosca Scott (halter)',         'Preacher_Hammer_Dumbbell_Curl'],
    ['Rosca concentrada (halter)',   'Concentration_Curls'],
    ['Rosca no cabo (pulley)',       'Cable_Preacher_Curl'],

    -- Tríceps
    ['Tríceps testa (barra)',        'EZ-Bar_Skullcrusher'],
    ['Tríceps corda (pulley)',       'Triceps_Pushdown_-_Rope_Attachment'],
    ['Tríceps pulley (barra)',       'Triceps_Pushdown'],
    ['Tríceps francês (halter)',     'Seated_Triceps_Press'],
    ['Tríceps coice (halter)',       'Tricep_Dumbbell_Kickback'],
    ['Mergulho (peso corporal)',     'Dips_-_Triceps_Version'],

    -- Core
    ['Abdominal supra',              'Crunches'],
    ['Abdominal infra',              'Reverse_Crunch'],
    ['Abdominal oblíquo',            'Oblique_Crunches'],
    ['Prancha (frontal)',            'Plank'],
    ['Prancha lateral',              'Side_Bridge'],
    ['Elevação de pernas',           'Hanging_Leg_Raise'],
    ['Russian twist',                'Russian_Twist'],
    ['Ab wheel / rodinha',           'Ab_Roller'],

    -- Full body / funcional
    ['Kettlebell swing',             'One-Arm_Kettlebell_Swings'],
    ['Thruster (barra)',             'Kettlebell_Thruster'],
    ['Clean and jerk (barra)',       'Clean_and_Jerk'],
    ['Snatch (barra)',               'Snatch'],
    ['Farmer walk (halteres)',       'Farmers_Walk'],

    -- Cardio
    ['Esteira (corrida)',            'Running_Treadmill'],
    ['Esteira (caminhada)',          'Walking_Treadmill'],
    ['Bicicleta ergométrica',        'Recumbent_Bike'],
    ['Elíptico',                     'Elliptical_Trainer'],
    ['Remo ergômetro',               'Rowing_Stationary'],
    ['Pular corda',                  'Rope_Jumping']
  ];
begin
  for i in 1 .. array_length(matches, 1) loop
    update public.exercises
       set image_urls = public.exercise_image_urls(matches[i][2])
     where name = matches[i][1];
  end loop;
end $$;
