import { supabase } from './supabase';
import type { ProgressEntry } from '@/types/database';

export async function listProgressEntries(
  userId: string,
): Promise<ProgressEntry[]> {
  const { data, error } = await supabase
    .from('progress_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProgressEntry[];
}

export async function createProgressEntry(
  content: string,
): Promise<ProgressEntry> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.id) throw new Error('Sessão expirada.');
  const { data, error } = await supabase
    .from('progress_entries')
    .insert({ user_id: user.user.id, content })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProgressEntry;
}

export async function updateProgressEntry(
  id: string,
  content: string,
): Promise<ProgressEntry> {
  const { data, error } = await supabase
    .from('progress_entries')
    .update({ content })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ProgressEntry;
}

export async function deleteProgressEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('progress_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
