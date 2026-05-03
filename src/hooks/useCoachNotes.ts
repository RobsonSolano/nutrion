import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from '@/services/coachNotes';

const notesKey = (studentId: string) =>
  ['coach_notes', studentId] as const;

export function useCoachNotes(studentId: string | null) {
  return useQuery({
    queryKey: notesKey(studentId ?? 'none'),
    queryFn: () => {
      if (!studentId) throw new Error('student_id ausente');
      return listNotes(studentId);
    },
    enabled: !!studentId,
    staleTime: 30_000,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { studentId: string; body: string }) =>
      createNote(params),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: notesKey(vars.studentId) });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      noteId: string;
      studentId: string;
      body: string;
    }) => updateNote(params.noteId, params.body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: notesKey(vars.studentId) });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { noteId: string; studentId: string }) =>
      deleteNote(params.noteId),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: notesKey(vars.studentId) });
    },
  });
}
