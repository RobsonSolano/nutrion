/** Limpa input livre/mascarado pro formato armazenado (só dígitos). */
export function parsePhoneInput(masked: string): string {
  return masked.replace(/\D/g, '');
}

/**
 * Formata `5511999999999` → `+55 (11) 99999-9999`. Tolera 10, 11 ou 13
 * dígitos. Fora desses tamanhos retorna a string limpa sem máscara.
 */
export function formatPhoneBR(digits: string): string {
  const cleaned = digits.replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(
      4,
      9,
    )}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return cleaned;
}

/** wa.me/<digits>. Aceita digits ou número formatado. */
export function whatsappUrl(input: string): string {
  return `https://wa.me/${parsePhoneInput(input)}`;
}

/** 10 a 13 dígitos cobrem BR (DDD+número, ou DDI+DDD+número). */
export function isValidPhone(digits: string): boolean {
  return /^[0-9]{10,13}$/.test(parsePhoneInput(digits));
}
