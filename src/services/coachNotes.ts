import { supabase } from './supabase';

export type CoachNote = {
  id: string;
  coach_id: string;
  student_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export async function listNotes(studentId: string): Promise<CoachNote[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const { data, error } = await supabase
    .from('coach_notes')
    .select('*')
    .eq('coach_id', user.id)
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CoachNote[];
}

export async function createNote(params: {
  studentId: string;
  body: string;
}): Promise<CoachNote> {
  const trimmed = params.body.trim();
  if (trimmed.length === 0) throw new Error('Escreva sua anotação.');
  if (trimmed.length > 2000)
    throw new Error('Limite de 2000 caracteres por anotação.');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const { data, error } = await supabase
    .from('coach_notes')
    .insert({
      coach_id: user.id,
      student_id: params.studentId,
      body: trimmed,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CoachNote;
}

export async function updateNote(
  noteId: string,
  body: string,
): Promise<CoachNote> {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw new Error('Anotação não pode ficar vazia.');
  if (trimmed.length > 2000)
    throw new Error('Limite de 2000 caracteres por anotação.');

  const { data, error } = await supabase
    .from('coach_notes')
    .update({ body: trimmed })
    .eq('id', noteId)
    .select('*')
    .single();
  if (error) throw error;
  return data as CoachNote;
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('coach_notes')
    .delete()
    .eq('id', noteId);
  if (error) throw error;
}
