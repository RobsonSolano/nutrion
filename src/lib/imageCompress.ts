import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Limite rígido do arquivo original que aceitamos do usuário. Arquivos maiores
 * disparam erro amigável; não tentamos comprimir (o processamento em RAM de
 * um arquivo >8MB pode travar dispositivos low-end).
 */
export const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Target de saída depois da compressão. Base64 é ~1.33x o tamanho binário,
 * então ~700KB binário vira ~900KB em base64. Isso cabe tranquilo no payload
 * de uma edge function e dentro do limite de tokens da Groq Vision.
 */
const TARGET_BYTES = 700 * 1024;

export class ImageTooLargeError extends Error {
  constructor(public readonly sizeBytes: number) {
    super(
      `A foto está muito grande (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). O limite é 8 MB — escolha uma menor ou tire uma nova.`,
    );
    this.name = 'ImageTooLargeError';
  }
}

export type CompressResult = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  approxBytes: number;
};

async function getFileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? info.size ?? null : null;
  } catch {
    return null;
  }
}

function approxBinaryFromBase64(base64: string): number {
  // base64 codifica 3 bytes em 4 chars — binary ≈ length * 3/4
  // (ignoramos padding '=' pro cálculo; diferença é desprezível)
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Comprime a imagem apontada por `uri` para um JPEG suficientemente pequeno
 * pra caber no payload da edge function + contexto da Groq Vision.
 *
 * Estratégia em cascata (para minimizar perda de qualidade):
 *   1. Se < 700KB, já retorna.
 *   2. Resize pra 1280px + quality 0.65.
 *   3. Se ainda > target, 960px + 0.55.
 *   4. Último recurso: 720px + 0.45.
 *
 * Arquivo original > 8MB dispara `ImageTooLargeError` antes de tentar.
 */
export async function compressImageForAI(uri: string): Promise<CompressResult> {
  const originalSize = await getFileSize(uri);
  if (originalSize != null && originalSize > MAX_INPUT_BYTES) {
    throw new ImageTooLargeError(originalSize);
  }

  const steps: Array<{ width: number; quality: number }> = [
    { width: 1280, quality: 0.65 },
    { width: 960, quality: 0.55 },
    { width: 720, quality: 0.45 },
  ];

  let last: CompressResult | null = null;

  for (const step of steps) {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: step.width } }],
      {
        compress: step.quality,
        format: SaveFormat.JPEG,
        base64: true,
      },
    );
    const base64 = result.base64 ?? '';
    const approx = approxBinaryFromBase64(base64);
    last = {
      uri: result.uri,
      base64,
      width: result.width,
      height: result.height,
      approxBytes: approx,
    };
    if (approx <= TARGET_BYTES) return last;
  }

  // Mesmo no modo mais agressivo, retornamos o último resultado — a IA ainda
  // consegue analisar imagens pequenas e o payload continua gerenciável.
  if (!last) {
    throw new Error('Falha ao processar a imagem. Tenta outra foto.');
  }
  return last;
}
