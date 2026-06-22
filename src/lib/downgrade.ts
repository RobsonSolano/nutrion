// Detecção de downgrade de professor (revenuecat-integration #5a).
// "Escolhe quem fica" dispara só quando o professor caiu abaixo do nº de alunos que
// possui E o acesso NÃO é grandfather (que é tratado de forma não-destrutiva — D5 do #1).

export function needsStudentChoice(p: {
  role: string;
  source: string;
  studentCount: number;
  studentLimit: number | null;
}): boolean {
  if (p.role !== 'professor' || p.studentLimit === null) return false;
  if (p.source === 'grandfather') return false; // D5: alunos atuais permanecem
  return p.studentCount > p.studentLimit;
}
