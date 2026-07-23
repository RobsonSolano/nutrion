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
