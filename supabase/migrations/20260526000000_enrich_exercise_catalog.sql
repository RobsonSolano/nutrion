-- =====================================================================
-- NutriOn — Enriquecimento do catálogo de exercícios
--
-- Adiciona dezenas de exercícios novos pra cobrir lacunas reportadas:
--   * Core: mais variações de abdominal e estabilização
--   * Cardio: mais modalidades comuns (caminhada outdoor, spinning,
--     stair climber, jump rope)
--   * Alongamentos por grupo muscular (não só no full_body):
--     pernas, costas, peito, ombros, quadril, panturrilha
--
-- Padrão de modalidade: 'generico' pra alongamentos e mobilidade
-- (não devem aparecer só pra musculação — relevantes pra todas as
-- modalidades). Demais seguem 'musculacao' ou 'cardio'.
--
-- Idempotente via unique (group_id, name): se já existir o nome no
-- grupo, o INSERT vira no-op via ON CONFLICT.
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

  -- =================================================================
  -- CORE — mais variações de abdominal e estabilização
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_core, 'Abdominal canivete',              'peso corporal', false, 'musculacao'),
    (g_core, 'Abdominal bicicleta',             'peso corporal', false, 'musculacao'),
    (g_core, 'Abdominal V-up',                  'peso corporal', false, 'musculacao'),
    (g_core, 'Abdominal remador',               'peso corporal', false, 'musculacao'),
    (g_core, 'Abdominal na bola',               'bola suíça',    false, 'musculacao'),
    (g_core, 'Abdominal na polia (cable crunch)', 'cabo',        false, 'musculacao'),
    (g_core, 'Abdominal declinado',             'banco',         false, 'musculacao'),
    (g_core, 'Sit-up tradicional',              'peso corporal', false, 'musculacao'),
    (g_core, 'Prancha em antebraço',            'peso corporal', false, 'musculacao'),
    (g_core, 'Prancha com elevação de perna',   'peso corporal', false, 'musculacao'),
    (g_core, 'Prancha com toque no ombro',      'peso corporal', false, 'musculacao'),
    (g_core, 'Bird dog',                        'peso corporal', false, 'musculacao'),
    (g_core, 'Mountain climber lento',          'peso corporal', false, 'musculacao'),
    (g_core, 'Hollow body rock',                'peso corporal', false, 'musculacao'),
    (g_core, 'Pallof press (cabo)',             'cabo',          false, 'musculacao'),
    (g_core, 'Rotação russa com halter',        'halter',        false, 'musculacao'),
    (g_core, 'Leg raise no banco',              'banco',         false, 'musculacao'),
    (g_core, 'Elevação pélvica solo',           'peso corporal', false, 'musculacao'),
    (g_core, 'Flutter kicks',                   'peso corporal', false, 'musculacao'),
    (g_core, 'Heel touch',                      'peso corporal', false, 'musculacao')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- CARDIO — mais modalidades comuns
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_cardio, 'Caminhada (ao ar livre)',         'equipamento',   false, 'musculacao'),
    (g_cardio, 'Corrida (ao ar livre)',           'equipamento',   false, 'musculacao'),
    (g_cardio, 'Subida de escada (ao ar livre)',  'equipamento',   false, 'musculacao'),
    (g_cardio, 'Stair climber (máquina)',         'máquina',       false, 'musculacao'),
    (g_cardio, 'Spinning (aula)',                 'máquina',       false, 'musculacao'),
    (g_cardio, 'Step (aeróbico)',                 'equipamento',   false, 'musculacao'),
    (g_cardio, 'Aero jump (cama elástica)',       'equipamento',   false, 'musculacao'),
    (g_cardio, 'Crosstrainer',                    'máquina',       false, 'musculacao'),
    (g_cardio, 'Versaclimber',                    'máquina',       false, 'musculacao'),
    (g_cardio, 'Tabata',                          'peso corporal', false, 'musculacao'),
    (g_cardio, 'Sprint na esteira',               'máquina',       false, 'musculacao'),
    (g_cardio, 'Trote leve (esteira)',            'máquina',       false, 'musculacao'),
    (g_cardio, 'Trekking',                        'equipamento',   false, 'musculacao'),
    (g_cardio, 'Pular corda (alta intensidade)',  'corda',         false, 'musculacao')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS — Pernas (g_legs)
  -- Modalidade 'generico' pra serem listados em qualquer rotina.
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_legs, 'Alongamento de quadríceps em pé',          'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de quadríceps deitado',        'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de isquiotibiais sentado',     'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de isquiotibiais em pé',       'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de adutor (borboleta)',        'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de adutor em pé (afastado)',   'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de glúteo deitado (figure 4)', 'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de glúteo em pé',              'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento piriforme',                    'peso corporal', false, 'generico'),
    (g_legs, 'Pigeon pose',                              'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de panturrilha contra parede', 'peso corporal', false, 'generico'),
    (g_legs, 'Alongamento de panturrilha no step',       'equipamento',   false, 'generico'),
    (g_legs, 'Alongamento IT band em pé',                'peso corporal', false, 'generico'),
    (g_legs, 'Frog pose (sapo)',                         'peso corporal', false, 'generico'),
    (g_legs, 'Squat hold (agachamento profundo)',        'peso corporal', false, 'generico'),
    (g_legs, 'Lizard pose (lagarto)',                    'peso corporal', false, 'generico'),
    (g_legs, 'Hip flexor lunge stretch',                 'peso corporal', false, 'generico')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS — Costas (g_back)
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_back, 'Child''s pose',                            'peso corporal', false, 'generico'),
    (g_back, 'Cobra (alongamento)',                      'peso corporal', false, 'generico'),
    (g_back, 'Spinal twist sentado',                     'peso corporal', false, 'generico'),
    (g_back, 'Spinal twist deitado',                     'peso corporal', false, 'generico'),
    (g_back, 'Alongamento de latíssimo (lat stretch)',   'peso corporal', false, 'generico'),
    (g_back, 'Thread the needle',                        'peso corporal', false, 'generico'),
    (g_back, 'Foam roll lombar',                         'rolo',          false, 'generico'),
    (g_back, 'Alongamento de trapézio',                  'peso corporal', false, 'generico')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS — Peito (g_chest)
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_chest, 'Alongamento de peito no batente',         'peso corporal', false, 'generico'),
    (g_chest, 'Doorway pec stretch',                     'peso corporal', false, 'generico'),
    (g_chest, 'Wall chest stretch',                      'peso corporal', false, 'generico'),
    (g_chest, 'Alongamento de peito no chão (cruz)',     'peso corporal', false, 'generico')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS — Ombros (g_shoulders)
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_shoulders, 'Cross-body shoulder stretch',         'peso corporal', false, 'generico'),
    (g_shoulders, 'Sleeper stretch',                     'peso corporal', false, 'generico'),
    (g_shoulders, 'Wall slides',                         'peso corporal', false, 'generico'),
    (g_shoulders, 'Alongamento de trapézio superior',    'peso corporal', false, 'generico'),
    (g_shoulders, 'Eagle arm stretch',                   'peso corporal', false, 'generico'),
    (g_shoulders, 'Reverse prayer stretch',              'peso corporal', false, 'generico')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS — Bíceps / antebraço (g_biceps)
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_biceps, 'Alongamento de bíceps na parede',        'peso corporal', false, 'generico'),
    (g_biceps, 'Alongamento de antebraço (flexor)',      'peso corporal', false, 'generico'),
    (g_biceps, 'Alongamento de antebraço (extensor)',    'peso corporal', false, 'generico')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS — Tríceps (g_triceps)
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_triceps, 'Alongamento de tríceps acima da cabeça', 'peso corporal', false, 'generico'),
    (g_triceps, 'Alongamento de tríceps com toalha',     'peso corporal', false, 'generico')
  on conflict (group_id, name) do nothing;

  -- =================================================================
  -- ALONGAMENTOS / MOBILIDADE — Genéricos extras em full_body
  -- =================================================================
  insert into public.exercises (group_id, name, equipment, is_compound, modality) values
    (g_full, 'Downward dog',                             'peso corporal', false, 'generico'),
    (g_full, 'Standing forward fold',                    'peso corporal', false, 'generico'),
    (g_full, 'Seated forward fold',                      'peso corporal', false, 'generico'),
    (g_full, 'Butterfly stretch',                        'peso corporal', false, 'generico'),
    (g_full, 'Standing side bend',                       'peso corporal', false, 'generico'),
    (g_full, 'Mobilidade torácica em quatro apoios',     'peso corporal', false, 'generico'),
    (g_full, 'Mobilidade cervical (rotação)',            'peso corporal', false, 'generico'),
    (g_full, 'Roll out / rolinho de coluna',             'peso corporal', false, 'generico'),
    (g_full, 'Foam roll glúteo',                         'rolo',          false, 'generico'),
    (g_full, 'Foam roll adutor',                         'rolo',          false, 'generico')
  on conflict (group_id, name) do nothing;
end $$;
