import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = (userId: string) => `requests:lastSeen:${userId}`;

/**
 * Persiste localmente a última vez que o aluno abriu a tela de
 * solicitações. Usado pra calcular badge de "não lidas" sem precisar
 * de campo no banco.
 */
export async function getRequestsLastSeen(
  userId: string,
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY(userId));
  } catch {
    return null;
  }
}

export async function markRequestsSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY(userId), new Date().toISOString());
  } catch {
    // ignora — best-effort
  }
}
