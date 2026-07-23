import { supabase } from './supabase';

/**
 * Verifica (e auto-cura) se o aluno logado está suspenso. Chama a RPC
 * check_and_sync_my_suspension, que reconcilia o acesso via o coach do aluno
 * antes de responder — assim um webhook perdido se corrige no próximo acesso.
 */
export async function checkMySuspension(): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_and_sync_my_suspension');
  if (error) throw error;
  return data === true;
}

/**
 * Reconcilia o acesso dos alunos do professor logado (reativa suspensos ao
 * subir de plano, suspende excedente ao cair). No-op quando o caller não é
 * professor. Idempotente com o sync disparado pelo webhook — serve pra não
 * depender do timing dele (ex.: logo após uma compra na sessão atual).
 */
export async function syncMyCoachAccess(coachId: string): Promise<void> {
  const { error } = await supabase.rpc('sync_coach_student_access', {
    p_coach_id: coachId,
  });
  if (error) throw error;
}
