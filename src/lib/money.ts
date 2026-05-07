/** Formata centavos em R$ no padrão pt-BR. */
export function formatBRL(cents: number | null): string {
  if (cents == null) return '—';
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Converte input mascarado/livre em centavos (int). */
export function parseBRL(input: string): number {
  const digits = input.replace(/\D/g, '');
  return parseInt(digits || '0', 10);
}
