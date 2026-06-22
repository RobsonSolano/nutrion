import { supabase } from './supabase';
import type { Entitlement } from '@/types/billing';

/**
 * Lê o entitlement do usuário autenticado via RPC resolve_entitlement (billing-core, #1).
 * A RPC é SECURITY DEFINER e usa auth.uid() — sem args.
 */
export async function fetchEntitlement(): Promise<Entitlement> {
  const { data, error } = await supabase.rpc('resolve_entitlement');
  if (error) throw error;
  return data as Entitlement;
}
