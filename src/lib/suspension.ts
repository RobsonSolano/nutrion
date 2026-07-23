// Helpers puros de suspensão de alunos. A reconciliação real vive no servidor
// (sync_coach_student_access); aqui só derivamos estado pra UI do professor.

/** Quantos alunos estão suspensos (suspended_at != null). */
export function suspendedCount(students: { suspended_at: string | null }[]): number {
  return students.filter((s) => s.suspended_at != null).length;
}

/** Ids dos alunos atualmente ativos (suspended_at == null). */
export function activeIds<T extends { id: string; suspended_at: string | null }>(
  students: T[],
): string[] {
  return students.filter((s) => s.suspended_at == null).map((s) => s.id);
}
