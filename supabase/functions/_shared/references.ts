// Helper compartilhado entre as edge functions de IA (chat-ai,
// onboarding-plan) pra buscar referências bibliográficas curadas e
// formatá-las para inclusão nos prompts.
//
// Estratégia: cada edge function decide quais tags são relevantes pro
// contexto e busca só essas. As referências são incluídas no system
// prompt + uma instrução pra a IA citar no final da resposta.

import type { SupabaseClient } from '@supabase/supabase-js';

export type BibliographyReference = {
  id: string;
  short_name: string;
  full_citation: string;
  url: string | null;
  tags: string[];
  sort_order: number;
};

/**
 * Busca as referências ativas que tocam pelo menos uma das tags pedidas.
 * Ordena pelo `sort_order` ascendente (menor = mais importante).
 *
 * Em caso de erro (RLS, tabela inexistente, etc) retorna array vazio —
 * a IA segue funcionando sem referências em vez de quebrar a chamada.
 */
export async function fetchReferences(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  tags: string[],
): Promise<BibliographyReference[]> {
  if (tags.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('bibliography_references')
      .select('id, short_name, full_citation, url, tags, sort_order')
      .eq('is_active', true)
      .overlaps('tags', tags)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[references] fetch error:', error);
      return [];
    }
    return (data ?? []) as BibliographyReference[];
  } catch (err) {
    console.error('[references] unexpected error:', err);
    return [];
  }
}

type CitationMode = 'text' | 'json_field';

type FormatOptions = {
  /**
   * 'text' (default) → resposta é texto livre; cite numa linha separada no final.
   * 'json_field' → resposta é JSON estrito; cite DENTRO do campo de texto
   * principal (`feedback` no sanity_check, `rationale` no onboarding-plan)
   * pra não quebrar o formato.
   */
  mode?: CitationMode;
  /**
   * Nome do campo onde a citação vai (só usado em mode='json_field' pra
   * deixar a instrução explícita pra IA).
   */
  jsonField?: string;
};

/**
 * Monta o bloco de texto a ser incluído no system prompt:
 * - Lista das referências disponíveis (short_name + full + URL se houver)
 * - Instrução pra IA usar como base e citar no final
 *
 * Retorna string vazia se a lista estiver vazia (não polui o prompt).
 */
export function formatReferencesForPrompt(
  refs: BibliographyReference[],
  options: FormatOptions = {},
): string {
  if (refs.length === 0) return '';

  const mode = options.mode ?? 'text';

  const lines: string[] = [
    '',
    'REFERÊNCIAS BIBLIOGRÁFICAS DISPONÍVEIS (use como base científica):',
  ];

  for (const r of refs) {
    const url = r.url ? ` — ${r.url}` : '';
    lines.push(`- ${r.short_name}: ${r.full_citation}${url}`);
  }

  lines.push('', 'INSTRUÇÃO DE CITAÇÃO:');
  lines.push(
    '- Use estas referências como base do raciocínio quando aplicável.',
    '- Liste APENAS as que efetivamente embasaram a resposta atual (não todas).',
    '- Se nenhuma referência disponível for aplicável, OMITA a citação — não cite por citar.',
    '- Use o `short_name` exato listado acima (não a citação completa).',
  );

  if (mode === 'text') {
    lines.push(
      '- No FINAL da resposta, inclua uma linha separada com o formato:',
      '  "Referência utilizada: <short_name>, <short_name>"',
    );
  } else {
    const fieldHint = options.jsonField
      ? ` (ex: dentro de "${options.jsonField}")`
      : '';
    lines.push(
      `- A resposta é JSON estrito. Inclua a citação no FINAL do texto do campo principal${fieldHint}, separada por uma linha em branco. Formato:`,
      '  "Referência utilizada: <short_name>, <short_name>"',
      '- NÃO crie um campo separado pras referências — mantenha o JSON shape exato.',
    );
  }

  return lines.join('\n');
}
