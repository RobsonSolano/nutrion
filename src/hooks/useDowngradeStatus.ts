import { useProfile } from './useProfile';
import { useEntitlement } from './useEntitlement';
import { useStudents } from './useStudents';
import { needsStudentChoice } from '@/lib/downgrade';

/**
 * Estado de downgrade do professor: precisa "escolher quem fica" quando caiu abaixo do
 * nº de alunos que tem (e não é grandfather — D5). Deriva de profile + entitlement + alunos.
 */
export function useDowngradeStatus(): {
  needsChoice: boolean;
  studentLimit: number | null;
  studentCount: number;
  overBy: number;
} {
  const { data: profile } = useProfile();
  const { data: ent } = useEntitlement();
  const { data: students } = useStudents();

  const studentCount = students?.length ?? 0;
  const studentLimit = ent?.student_limit ?? null;

  const needsChoice =
    !!profile && !!ent
      ? needsStudentChoice({
          role: profile.role,
          source: ent.source,
          studentCount,
          studentLimit,
        })
      : false;

  const overBy =
    studentLimit !== null ? Math.max(0, studentCount - studentLimit) : 0;

  return { needsChoice, studentLimit, studentCount, overBy };
}
