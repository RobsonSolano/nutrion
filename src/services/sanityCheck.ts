import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const FN_URL = `${SUPABASE_URL}/functions/v1/chat-ai`;

export type SanityCheckResult = {
  items?: string[];
  consistency?: 'ok' | 'diverge' | string;
  macros?: {
    kcal?: number;
    protein_g?: number;
    carbs_g?: number;
    fats_g?: number;
  };
  feedback?: string;
  raw?: string; // resposta crua caso parse falhe
};

export type SanityCheckRequest = {
  description: string;
  imageBase64: string;
  imageMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  scaleWeightG?: number;
};

function parseJsonFromText(text: string): Partial<SanityCheckResult> | null {
  // tenta extrair JSON mesmo se o modelo embrulhou em ```json ... ```
  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // às vezes o JSON vem dentro de texto — tenta pegar o primeiro bloco { ... }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function runSanityCheck(
  params: SanityCheckRequest,
): Promise<SanityCheckResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('Sessão expirada. Faça login de novo.');
  }

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      message: params.description,
      mode: 'sanity_check',
      imageBase64: params.imageBase64,
      imageMime: params.imageMime ?? 'image/jpeg',
      scaleWeightG: params.scaleWeightG,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail ?? parsed?.error ?? text;
    } catch {
      // raw
    }
    if (res.status === 429) throw new Error(String(detail));
    throw new Error(`${res.status} · ${detail}`);
  }

  const data = await res.json();
  const rawText: string = data?.text ?? '';
  const parsed = parseJsonFromText(rawText);

  if (!parsed) {
    return { feedback: rawText, raw: rawText };
  }
  return { ...parsed, raw: rawText } as SanityCheckResult;
}
