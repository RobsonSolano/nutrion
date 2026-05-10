import { supabase } from './supabase';
import type { PushPreference, PushType } from '@/types/database';

export async function listPushPreferences(): Promise<PushPreference[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const { data, error } = await supabase
    .from('push_preferences')
    .select('*')
    .eq('user_id', user.id);
  if (error) throw error;
  return (data ?? []) as PushPreference[];
}

export async function setPushEnabled(
  type: PushType,
  enabled: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  // Upsert (composite PK user_id+type)
  const { error } = await supabase
    .from('push_preferences')
    .upsert(
      {
        user_id: user.id,
        type,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,type' },
    );
  if (error) throw error;
}
