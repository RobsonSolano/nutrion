import * as FileSystem from 'expo-file-system/legacy';

/**
 * Lê um arquivo local (file://, content://) e devolve ArrayBuffer.
 *
 * Por que NÃO usar `fetch(uri).blob()` em RN: o fetch pra URIs locais
 * em React Native frequentemente devolve um Blob com size=0 ou
 * mal-formado, e o Supabase Storage rejeita com "Network error".
 * Lendo via expo-file-system em base64 e convertendo manualmente
 * pra ArrayBuffer é o caminho estável.
 */
export async function readFileAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToArrayBuffer(base64);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  // atob disponível globalmente no Hermes (RN 0.71+).
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
