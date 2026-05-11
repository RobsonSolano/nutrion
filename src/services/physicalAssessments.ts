import { supabase } from './supabase';
import type {
  PhysicalAssessment,
  PhysicalAssessmentInput,
  PhysicalAssessmentPatch,
} from '@/types/database';

export async function listAssessments(
  studentId: string,
): Promise<PhysicalAssessment[]> {
  const { data, error } = await supabase
    .from('physical_assessments')
    .select('*')
    .eq('student_id', studentId)
    .order('assessed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PhysicalAssessment[];
}

export async function getAssessment(
  assessmentId: string,
): Promise<PhysicalAssessment | null> {
  const { data, error } = await supabase
    .from('physical_assessments')
    .select('*')
    .eq('id', assessmentId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PhysicalAssessment | null;
}

export async function getLatestAssessment(
  studentId: string,
): Promise<PhysicalAssessment | null> {
  const { data, error } = await supabase
    .from('physical_assessments')
    .select('*')
    .eq('student_id', studentId)
    .order('assessed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PhysicalAssessment | null;
}

export async function createAssessment(
  input: PhysicalAssessmentInput,
): Promise<PhysicalAssessment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const { data, error } = await supabase
    .from('physical_assessments')
    .insert({ ...input, coach_id: user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data as PhysicalAssessment;
}

export async function updateAssessment(
  assessmentId: string,
  patch: PhysicalAssessmentPatch,
): Promise<PhysicalAssessment> {
  const { data, error } = await supabase
    .from('physical_assessments')
    .update(patch)
    .eq('id', assessmentId)
    .select('*')
    .single();
  if (error) throw error;
  return data as PhysicalAssessment;
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  const { error } = await supabase
    .from('physical_assessments')
    .delete()
    .eq('id', assessmentId);
  if (error) throw error;
}

export async function getPosturePhotoSignedUrl(
  path: string,
  expiresInSec = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('posture-photos')
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadPosturePhoto(params: {
  studentId: string;
  assessmentId: string;
  index: number;
  localUri: string;
  contentType: string;
}): Promise<string> {
  const ext = params.contentType.split('/')[1] ?? 'jpg';
  const path = `${params.studentId}/${params.assessmentId}/${params.index}.${ext}`;

  // ArrayBuffer via expo-file-system — fetch(uri).blob() em RN devolve
  // blob vazio e o Supabase Storage rejeita com "Network error".
  const { readFileAsArrayBuffer } = await import('@/lib/uploadFile');
  const buffer = await readFileAsArrayBuffer(params.localUri);

  const { error } = await supabase.storage
    .from('posture-photos')
    .upload(path, buffer, {
      contentType: params.contentType,
      upsert: true,
    });
  if (error) throw error;
  return path;
}

export async function deletePosturePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('posture-photos')
    .remove([path]);
  if (error) throw error;
}
