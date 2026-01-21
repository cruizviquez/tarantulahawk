/**
 * Safe date formatter for server/client hydration compatibility
 * Avoids using Date objects which can produce different output
 * between server and client due to timezone differences
 */

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Format a date string in format 'YYYY-MM-DD' to Spanish format
 * @param dateStr - Date string in ISO format (YYYY-MM-DD)
 * @returns Formatted string like "5 de enero de 2025"
 */
export function formatDateES(dateStr: string): string {
  // Espera 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr;

  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);

  // Salida determinística (SSR y cliente igual)
  return `${day} de ${MONTHS_ES[monthIndex]} de ${year}`;
}

/**
 * Format a date string to short format DD/MM/YYYY
 * @param dateStr - Date string in ISO format (YYYY-MM-DD)
 * @returns Formatted string like "05/01/2025"
 */
export function formatDateShortES(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return dateStr;

  const year = m[1];
  const month = m[2];
  const day = m[3];

  return `${day}/${month}/${year}`;
}

/**
 * Format a date string with time to Spanish format
 * @param dateStr - Date string in ISO format (YYYY-MM-DDTHH:mm:ss)
 * @returns Formatted string like "5 de enero de 2025 14:30"
 */
export function formatDateTimeES(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(dateStr);
  if (!m) return dateStr;

  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hours = m[4];
  const minutes = m[5];

  return `${day} de ${MONTHS_ES[monthIndex]} de ${year} ${hours}:${minutes}`;
}
