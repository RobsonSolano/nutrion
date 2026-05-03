// NutriOn — Edge Function coach-save-student-plan
// Persiste o plano gerado pelo coach-generate-plan no perfil do aluno:
// atualiza metas (calorie/protein/water) e cria as rotinas com
// `created_by_coach = caller.id` e `user_id = student_id`. Arquiva
// rotinas anteriores do mesmo professor pra esse aluno (assim refazer
// o plano não empilha rotinas antigas com novas).

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import type { PlanOut } from '../_shared/plan-generator.ts';
import { sendExpoPush } from '../_shared/expoPush.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  student_id: string;
  plan: PlanOut;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAuth.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.student_id || !body?.plan) {
      return json(
        { error: 'invalid_body', detail: 'student_id e plan obrigatórios.' },
        400,
      );
    }

    // Valida que caller é professor do aluno.
    const { data: student, error: studentErr } = await supabaseService
      .from('profiles')
      .select('id, role, coach_id')
      .eq('id', body.student_id)
      .single();

    if (studentErr || !student) {
      return json({ error: 'student_not_found' }, 404);
    }
    if (student.role !== 'aluno' || student.coach_id !== caller.id) {
      return json({ error: 'forbidden' }, 403);
    }

    const plan = body.plan;

    // 1. Update profile do aluno com as metas calculadas.
    const { data: profile, error: pErr } = await supabaseService
      .from('profiles')
      .update({
        daily_calorie_goal: plan.calorie_goal,
        protein_goal_g: plan.protein_goal_g,
        water_goal_ml: plan.water_goal_ml,
      })
      .eq('id', body.student_id)
      .select('*')
      .single();
    if (pErr) {
      return json(
        { error: 'profile_update_failed', detail: pErr.message },
        500,
      );
    }

    // 2. Arquiva rotinas anteriores do MESMO professor pra esse aluno.
    // Não toca em rotinas criadas por outros caminhos (created_by_coach IS NULL).
    const { error: archiveErr } = await supabaseService
      .from('workout_routines')
      .update({ is_archived: true })
      .eq('user_id', body.student_id)
      .eq('created_by_coach', caller.id)
      .eq('is_archived', false);
    if (archiveErr) {
      return json(
        { error: 'archive_failed', detail: archiveErr.message },
        500,
      );
    }

    // 2.5. Cria a linha de revisão (snapshot das metas + rationale).
    // As rotinas que vamos inserir abaixo apontam pra ela via
    // plan_revision_id, permitindo reconstruir o plano completo no
    // historico depois.
    const { data: revision, error: revisionErr } = await supabaseService
      .from('student_plan_revisions')
      .insert({
        student_id: body.student_id,
        coach_id: caller.id,
        rationale: plan.rationale ?? null,
        calorie_goal: plan.calorie_goal,
        protein_goal_g: plan.protein_goal_g,
        water_goal_ml: plan.water_goal_ml,
      })
      .select('id')
      .single();
    if (revisionErr) {
      return json(
        { error: 'revision_insert_failed', detail: revisionErr.message },
        500,
      );
    }
    const planRevisionId = revision.id as string;

    // 3. Resolve group_slug → group_id (catálogo global).
    const slugs = Array.from(
      new Set(
        plan.routines
          .map((r) => r.group_slug)
          .filter((s): s is string => !!s),
      ),
    );
    const groupIdBySlug = new Map<string, string>();
    if (slugs.length > 0) {
      const { data: groups, error: gErr } = await supabaseService
        .from('exercise_groups')
        .select('id, slug')
        .in('slug', slugs);
      if (gErr) {
        return json(
          { error: 'group_fetch_failed', detail: gErr.message },
          500,
        );
      }
      for (const g of groups ?? []) {
        groupIdBySlug.set(g.slug, g.id);
      }
    }

    // 4. Insere as rotinas + exercícios.
    const createdRoutines = [];
    for (const r of plan.routines) {
      const { data: routine, error: rErr } = await supabaseService
        .from('workout_routines')
        .insert({
          user_id: body.student_id,
          created_by_coach: caller.id,
          plan_revision_id: planRevisionId,
          name: r.name,
          modality: r.modality,
          group_id: r.group_slug
            ? groupIdBySlug.get(r.group_slug) ?? null
            : null,
          description: r.description ?? null,
        })
        .select('*')
        .single();
      if (rErr) {
        return json(
          { error: 'routine_insert_failed', detail: rErr.message },
          500,
        );
      }

      if (r.exercises.length > 0) {
        const rows = r.exercises.map((ex, i) => ({
          routine_id: routine.id,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          equipment: ex.equipment ?? null,
          sort_order: i,
          sets: ex.sets,
          reps_min: ex.reps_min,
          reps_max: ex.reps_max,
          weight_min_kg: ex.weight_min_kg ?? null,
          weight_max_kg: ex.weight_max_kg ?? null,
          duration_min: ex.duration_min ?? null,
          notes: ex.notes ?? null,
        }));
        const { error: exErr } = await supabaseService
          .from('workout_routine_exercises')
          .insert(rows);
        if (exErr) {
          return json(
            { error: 'exercises_insert_failed', detail: exErr.message },
            500,
          );
        }
      }

      createdRoutines.push(routine);
    }

    // Push pro aluno avisando que o plano foi atualizado. Erros aqui não
    // bloqueiam o save — push é best-effort.
    const { data: coachProfile } = await supabaseService
      .from('profiles')
      .select('full_name')
      .eq('id', caller.id)
      .single();
    const coachName = coachProfile?.full_name ?? 'Seu professor';
    await sendExpoPush(supabaseService, body.student_id, {
      title: 'Plano atualizado',
      body: `${coachName} atualizou seus treinos e metas.`,
      data: { event: 'plan_updated' },
    });

    return json({ profile, routines: createdRoutines });
  } catch (err) {
    console.error('[coach-save-student-plan] unexpected error:', err);
    return json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
