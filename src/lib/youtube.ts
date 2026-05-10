import { Alert, Linking } from 'react-native';

/**
 * Abre uma busca no YouTube com o nome do exercício pré-preenchido.
 * Tenta o app nativo do YouTube primeiro; se não instalado, cai pro web.
 *
 * Padrão da query: "<exercise_name> como fazer" — termo que tende a
 * priorizar tutoriais técnicos em PT-BR (Cariani, Bottura, etc).
 */
export async function openYouTubeSearchForExercise(
  exerciseName: string,
): Promise<void> {
  const query = encodeURIComponent(`${exerciseName} como fazer`);
  const webUrl = `https://www.youtube.com/results?search_query=${query}`;

  try {
    // Tenta deeplink do app YouTube (vnd.youtube://results funciona em
    // Android com app instalado; iOS já trata https://www.youtube.com/*
    // como universal link).
    const appUrl = `vnd.youtube://results?search_query=${query}`;
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch (err) {
      Alert.alert(
        'Não consegui abrir',
        err instanceof Error ? err.message : 'Tente novamente.',
      );
    }
  }
}
