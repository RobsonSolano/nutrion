-- =====================================================================
-- NutriOn — Imagens v4: cobertura agressiva de stretches e cardio
--
-- Mapeia ~55 exercícios novos do enrichment (20260526) pra slugs
-- existentes na yuhonas/free-exercise-db (CC0). Alguns mapeamentos
-- são APROXIMAÇÕES (ex: pigeon pose → Dancer's_Stretch) — escolhidos
-- conscientemente pra ter imagem demonstrativa em vez de fallback
-- vazio. O coach pode trocar manualmente depois se preferir.
--
-- Resultado esperado: baixa "sem imagem" de ~32% pra ~9-10% (apenas
-- yoga poses não-cobertas, foam rolls específicos e modalidades sem
-- equivalente como natação).
--
-- Idempotente: só atualiza linhas que ainda estão NULL.
-- Helper public.exercise_image_urls(slug) já existe desde 20260423.
-- =====================================================================

do $$
declare
  matches text[][] := array[
    -- ================================================================
    -- CORE
    -- ================================================================
    ['Abdominal canivete',              'Jackknife_Sit-Up'],
    ['Abdominal bicicleta',             'Air_Bike'],
    ['Abdominal V-up',                  'Press_Sit-Up'],
    ['Abdominal remador',               'Janda_Sit-Up'],
    ['Abdominal na polia (cable crunch)','Standing_Rope_Crunch'],
    ['Sit-up tradicional',              'Sit-Up'],
    ['Prancha em antebraço',            'Plank'],
    ['Prancha com elevação de perna',   'Push_Up_to_Side_Plank'],
    ['Prancha com toque no ombro',      'Plank'],
    ['Mountain climber lento',          'Mountain_Climbers'],
    ['Rotação russa com halter',        'Russian_Twist'],
    ['Leg raise no banco',              'Bent-Knee_Hip_Raise'],
    ['Elevação pélvica solo',           'Pelvic_Tilt_Into_Bridge'],
    ['Flutter kicks',                   'Scissor_Kick'],
    ['Heel touch',                      'Alternate_Heel_Touchers'],

    -- ================================================================
    -- CARDIO
    -- ================================================================
    ['Caminhada (ao ar livre)',         'Walking_Treadmill'],
    ['Corrida (ao ar livre)',           'Running_Treadmill'],
    ['Crosstrainer',                    'Elliptical_Trainer'],
    ['Pular corda (alta intensidade)',  'Rope_Jumping'],
    ['Spinning (aula)',                 'Recumbent_Bike'],
    ['Sprint na esteira',               'Running_Treadmill'],
    ['Stair climber (máquina)',         'Stairmaster'],
    ['Step (aeróbico)',                 'Step_Mill'],
    ['Subida de escada (ao ar livre)',  'Stairmaster'],
    ['Trekking',                        'Walking_Treadmill'],
    ['Trote leve (esteira)',            'Running_Treadmill'],
    ['Versaclimber',                    'Stairmaster'],

    -- ================================================================
    -- PERNAS (alongamentos)
    -- ================================================================
    ['Alongamento de quadríceps em pé',          'Quad_Stretch'],
    ['Alongamento de quadríceps deitado',        'On-Your-Back_Quad_Stretch'],
    ['Alongamento de isquiotibiais sentado',     'Seated_Floor_Hamstring_Stretch'],
    ['Alongamento de isquiotibiais em pé',       'Standing_Toe_Touches'],
    ['Alongamento de adutor (borboleta)',        'Groin_and_Back_Stretch'],
    ['Alongamento de adutor em pé (afastado)',   'Adductor'],
    ['Alongamento de glúteo deitado (figure 4)', 'Ankle_On_The_Knee'],
    ['Alongamento de glúteo em pé',              'Seated_Glute'],
    ['Alongamento piriforme',                    'Piriformis-SMR'],
    ['Alongamento de panturrilha contra parede', 'Calf_Stretch_Hands_Against_Wall'],
    ['Alongamento de panturrilha no step',       'Standing_Gastrocnemius_Calf_Stretch'],
    ['Alongamento IT band em pé',                'IT_Band_and_Glute_Stretch'],
    ['Pigeon pose',                              'Dancers_Stretch'],
    ['Hip flexor lunge stretch',                 'Kneeling_Hip_Flexor'],

    -- ================================================================
    -- COSTAS (alongamentos)
    -- ================================================================
    ['Child''s pose',                            'Childs_Pose'],
    ['Spinal twist sentado',                     'Spinal_Stretch'],
    ['Spinal twist deitado',                     'Lying_Crossover'],
    ['Alongamento de latíssimo (lat stretch)',   'Overhead_Lat'],
    ['Foam roll lombar',                         'Lower_Back-SMR'],
    ['Alongamento de trapézio',                  'Side_Neck_Stretch'],

    -- ================================================================
    -- PEITO (alongamentos)
    -- ================================================================
    ['Alongamento de peito no batente',          'One_Arm_Against_Wall'],
    ['Alongamento de peito no chão (cruz)',      'Chest_And_Front_Of_Shoulder_Stretch'],
    ['Doorway pec stretch',                      'One_Arm_Against_Wall'],
    ['Wall chest stretch',                       'Behind_Head_Chest_Stretch'],

    -- ================================================================
    -- OMBROS (alongamentos)
    -- ================================================================
    ['Cross-body shoulder stretch',              'Shoulder_Stretch'],
    ['Alongamento de trapézio superior',         'Chin_To_Chest_Stretch'],

    -- ================================================================
    -- BÍCEPS / ANTEBRAÇO
    -- ================================================================
    ['Alongamento de bíceps na parede',          'Standing_Biceps_Stretch'],
    ['Alongamento de antebraço (flexor)',        'Kneeling_Forearm_Stretch'],
    ['Alongamento de antebraço (extensor)',      'Kneeling_Forearm_Stretch'],

    -- ================================================================
    -- TRÍCEPS
    -- ================================================================
    ['Alongamento de tríceps acima da cabeça',   'Triceps_Stretch'],
    ['Alongamento de tríceps com toalha',        'Overhead_Triceps'],

    -- ================================================================
    -- FULL BODY (mobilidade/alongamento)
    -- ================================================================
    ['Standing forward fold',                    'Standing_Toe_Touches'],
    ['Seated forward fold',                      'Seated_Floor_Hamstring_Stretch'],
    ['Butterfly stretch',                        'Groin_and_Back_Stretch'],
    ['Standing side bend',                       'Standing_Lateral_Stretch'],
    ['Mobilidade cervical (rotação)',            'Side_Neck_Stretch']
  ];
begin
  for i in 1 .. array_length(matches, 1) loop
    update public.exercises
       set image_urls = public.exercise_image_urls(matches[i][2])
     where name = matches[i][1]
       and image_urls is null;
  end loop;
end $$;
