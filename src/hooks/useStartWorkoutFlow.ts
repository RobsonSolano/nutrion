import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useActiveWorkout } from './useActiveWorkout';
import { startAction } from '@/lib/workoutTimer';

/**
 * Orquestra "iniciar treino" a partir de uma rotina. Trata o caso de já haver
 * um treino ativo ([WT]-01) com **confirmação explícita** — antes o app fazia
 * redirect silencioso pro treino em andamento, mostrando o nome errado.
 */
export function useStartWorkoutFlow() {
  const router = useRouter();
  const { active, start } = useActiveWorkout();

  const requestStart = useCallback(
    (routine: { id: string | null; name: string }) => {
      const open = () => router.push('/treino-ativo' as Href);
      const action = startAction(active, routine.id);

      if (action === 'open') {
        open();
        return;
      }
      if (action === 'start') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        start(routine);
        open();
        return;
      }
      // 'confirm' — já há OUTRO treino em andamento.
      Alert.alert(
        'Treino em andamento',
        `Você já está cronometrando "${active?.routineName}". O que deseja fazer?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar esse', onPress: open },
          {
            text: `Iniciar ${routine.name}`,
            style: 'destructive',
            onPress: () => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              start(routine); // sobrescreve estado + persistência + notificações
              open();
            },
          },
        ],
      );
    },
    [active, start, router],
  );

  return { requestStart, active };
}
