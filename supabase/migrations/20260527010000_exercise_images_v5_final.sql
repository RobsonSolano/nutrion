-- =====================================================================
-- NutriOn — Imagens v5: pass final de aproximações
--
-- Mapeia os ~12 exercícios restantes que têm equivalente razoável na
-- free-exercise-db (poses de yoga e variações específicas). Os ~10
-- que permanecem sem imagem por design:
--   - Bird dog, Hollow body rock, Pallof press, Wall slides
--     (lib não tem equivalente convincente)
--   - Mobilidade torácica em 4 apoios, Roll out de coluna
--     (alongamentos terapêuticos específicos)
--   - Foam roll adutor, Foam roll glúteo (SMR específicos)
--   - Aero jump, Natação, Tabata (modalidades sem demonstração visual
--     útil na lib)
--
-- Resultado esperado: ~4% sem imagem (~10 de 269).
--
-- Idempotente: só atualiza linhas que ainda estão NULL.
-- =====================================================================

do $$
declare
  matches text[][] := array[
    -- Costas
    ['Cobra (alongamento)',     'One_Half_Locust'],
    ['Thread the needle',       'Side-Lying_Floor_Stretch'],

    -- Pernas (yoga poses)
    ['Frog pose (sapo)',        'Lying_Bent_Leg_Groin'],
    ['Lizard pose (lagarto)',   'Intermediate_Hip_Flexor_and_Quad_Stretch'],
    ['Squat hold (agachamento profundo)', 'Groiners'],

    -- Ombros
    ['Eagle arm stretch',       'Round_The_World_Shoulder_Stretch'],
    ['Reverse prayer stretch',  'Round_The_World_Shoulder_Stretch'],
    ['Sleeper stretch',         'Side-Lying_Floor_Stretch'],

    -- Core
    ['Abdominal declinado',     'Decline_Crunch'],
    ['Abdominal na bola',       'Hug_A_Ball'],

    -- Full body
    ['Downward dog',            'Inchworm']
  ];
begin
  for i in 1 .. array_length(matches, 1) loop
    update public.exercises
       set image_urls = public.exercise_image_urls(matches[i][2])
     where name = matches[i][1]
       and image_urls is null;
  end loop;
end $$;
