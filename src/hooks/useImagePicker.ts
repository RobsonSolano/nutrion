import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { compressImageForAI, ImageTooLargeError } from '@/lib/imageCompress';

type Source = 'camera' | 'library';

type Options = {
  /** Frase usada no alert de permissão. Ex: "analisar o prato". */
  purpose?: string;
};

export function useImagePicker(options: Options = {}) {
  const purpose = options.purpose ?? 'usar a foto';

  const [uri, setUri] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  async function pick(source: Source) {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permissão necessária',
        `Precisamos da permissão de ${source === 'camera' ? 'câmera' : 'galeria'} pra ${purpose}.`,
      );
      return;
    }
    const launcher =
      source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
    const picked = await launcher({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];

    setPreparing(true);
    try {
      const compressed = await compressImageForAI(asset.uri);
      setUri(compressed.uri);
      setBase64(compressed.base64);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      const message =
        err instanceof ImageTooLargeError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não consegui preparar essa foto. Tenta outra.';
      Alert.alert('Foto muito pesada', message);
    } finally {
      setPreparing(false);
    }
  }

  function clear() {
    setUri(null);
    setBase64(null);
  }

  return { uri, base64, preparing, pick, clear };
}
