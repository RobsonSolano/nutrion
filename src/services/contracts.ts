import { supabase } from './supabase';
import type {
  ContractInput,
  ContractPatch,
  StudentContract,
} from '@/types/database';

export async function listStudentContracts(
  studentId: string,
): Promise<StudentContract[]> {
  const { data, error } = await supabase
    .from('student_contracts_view')
    .select('*')
    .eq('student_id', studentId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudentContract[];
}

export async function getActiveContract(
  studentId: string,
): Promise<StudentContract | null> {
  const { data, error } = await supabase
    .from('student_contracts_view')
    .select('*')
    .eq('student_id', studentId)
    .eq('effective_status', 'active')
    .maybeSingle();
  if (error) throw error;
  return (data as StudentContract) ?? null;
}

export async function createContract(
  input: ContractInput,
): Promise<StudentContract> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.id) throw new Error('Sessão expirada.');
  const { data, error } = await supabase
    .from('student_contracts')
    .insert({ ...input, coach_id: user.user.id, status: 'active' })
    .select('*')
    .single();
  if (error) throw error;
  return data as StudentContract;
}

export async function updateContract(
  id: string,
  patch: ContractPatch,
): Promise<StudentContract> {
  const { data, error } = await supabase
    .from('student_contracts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as StudentContract;
}

export async function cancelContract(id: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from('student_contracts')
    .update({ status: 'cancelled', end_date: today })
    .eq('id', id);
  if (error) throw error;
}
