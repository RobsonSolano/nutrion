import { supabase } from './supabase';
import type {
  StudentRequest,
  StudentRequestStatus,
} from '@/types/database';

/** Lista solicitações do aluno logado (todas, ordenadas mais recentes primeiro). */
export async function listMyRequests(): Promise<StudentRequest[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const { data, error } = await supabase
    .from('student_requests')
    .select('*')
    .eq('student_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentRequest[];
}

/**
 * Lista solicitações que o professor logado precisa ver.
 * Retorna também o nome do aluno via join.
 */
export type CoachRequestRow = StudentRequest & {
  student: { id: string; full_name: string | null } | null;
};

export async function listCoachRequests(
  status?: StudentRequestStatus | 'all',
): Promise<CoachRequestRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  let q = supabase
    .from('student_requests')
    .select('*, student:profiles!student_requests_student_id_fkey(id, full_name)')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    q = q.eq('status', status);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CoachRequestRow[];
}

export async function createRequest(message: string): Promise<StudentRequest> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    throw new Error('Escreva sua solicitação.');
  }
  if (trimmed.length > 500) {
    throw new Error('A solicitação tem no máximo 500 caracteres.');
  }

  // Resolve coach_id do aluno (RLS exige bater com profile.coach_id).
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('coach_id, role')
    .eq('id', user.id)
    .single();
  if (pErr) throw pErr;
  if (profile.role !== 'aluno' || !profile.coach_id) {
    throw new Error('Apenas alunos vinculados podem solicitar.');
  }

  const { data, error } = await supabase
    .from('student_requests')
    .insert({
      student_id: user.id,
      coach_id: profile.coach_id,
      message: trimmed,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as StudentRequest;
}

export async function cancelRequest(requestId: string): Promise<StudentRequest> {
  const { data, error } = await supabase
    .from('student_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .select('*')
    .single();
  if (error) throw error;
  return data as StudentRequest;
}

export async function respondToRequest(params: {
  requestId: string;
  status: StudentRequestStatus;
  response?: string | null;
}): Promise<StudentRequest> {
  const { data, error } = await supabase
    .from('student_requests')
    .update({
      status: params.status,
      coach_response:
        params.response === undefined ? undefined : params.response,
    })
    .eq('id', params.requestId)
    .select('*')
    .single();
  if (error) throw error;
  return data as StudentRequest;
}
