import { IS_EXPO_GO } from '@/lib/platform';
import type * as NotificationsType from 'expo-notifications';

/**
 * Notificações LOCAIS do cronômetro de treino (OTA — expo-notifications já
 * instalado; lazy + no-op em Expo Go, igual pushNotifications.ts):
 *  - ongoing: notificação fixa "Treino em andamento" enquanto roda.
 *  - 2h: aviso agendado se o treino passar de 2h sem finalizar.
 * O segundo a segundo rolando fica DENTRO do app (limite OTA); a notificação
 * é estática. Widget nativo rolando = incremento futuro (build).
 */
function load(): typeof NotificationsType | null {
  if (IS_EXPO_GO) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

const WORKOUT_DATA = { type: 'active_workout' as const };

let ongoingId: string | null = null;
let twoHourId: string | null = null;

function hhmm(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Notificação fixa (sticky) enquanto o treino roda. Tocável → abre o timer. */
export async function showOngoing(
  routineName: string,
  startedAt: number,
): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    if (ongoingId) await N.dismissNotificationAsync(ongoingId).catch(() => {});
    ongoingId = await N.scheduleNotificationAsync({
      content: {
        title: 'Treino em andamento',
        body: `${routineName} — desde ${hhmm(startedAt)}`,
        sticky: true,
        autoDismiss: false,
        data: WORKOUT_DATA,
      },
      trigger: null,
    });
  } catch {
    // best-effort — sem permissão, simplesmente não aparece
  }
}

/** Agenda o aviso de 2h a partir do início (cancela um anterior). */
export async function scheduleTwoHourAlert(startedAt: number): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    if (twoHourId) await N.cancelScheduledNotificationAsync(twoHourId).catch(() => {});
    const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
    const seconds = Math.max(1, 7200 - elapsedSec);
    twoHourId = await N.scheduleNotificationAsync({
      content: {
        title: 'Seu treino ainda está cronometrando ⏱️',
        body: 'Esqueceu de finalizar? Abra pra salvar ou descartar.',
        data: WORKOUT_DATA,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        channelId: 'default',
      },
    });
  } catch {
    // best-effort
  }
}

/**
 * Remove a ongoing e cancela o aviso de 2h. Faz varredura dos agendados por
 * `data.type` pra cobrir o caso pós-kill (ids em memória se perdem, mas o
 * agendamento de 2h persiste no scheduler do SO).
 */
export async function clearWorkoutNotifications(): Promise<void> {
  const N = load();
  if (!N) return;
  try {
    if (ongoingId) await N.dismissNotificationAsync(ongoingId).catch(() => {});
    if (twoHourId) await N.cancelScheduledNotificationAsync(twoHourId).catch(() => {});
    ongoingId = null;
    twoHourId = null;
    const scheduled = await N.getAllScheduledNotificationsAsync().catch(() => []);
    await Promise.all(
      scheduled
        .filter((r) => (r.content?.data as { type?: string } | undefined)?.type === 'active_workout')
        .map((r) => N.cancelScheduledNotificationAsync(r.identifier).catch(() => {})),
    );
  } catch {
    // best-effort
  }
}
