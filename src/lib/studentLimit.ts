// Regra de limite de alunos do professor (billing-core student_limit por tier:
// free=2 · pro=5 · premium=null/ilimitado). Espelha o gating de coach-create-student.

/** true quando criar mais um aluno deve ser bloqueado. limit null = ilimitado. */
export function isStudentLimitReached(
  count: number,
  limit: number | null,
): boolean {
  return limit !== null && count >= limit;
}
