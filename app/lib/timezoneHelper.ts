/**
 * Helper para timestamps en zona horaria de Ciudad de México
 * Mexico/Mexico_City = UTC-6 (o UTC-5 durante horario de verano en ciertas fechas)
 */

export const MEXICO_CITY_TZ = 'America/Mexico_City';

/**
 * Obtiene el timestamp actual en zonahoraria de CDMX en formato ISO personalizado
 * @returns ISO string con la hora en CDMX (ej: 2026-01-27T14:30:45-06:00)
 */
export function getNowCDMX(): Date {
  // JavaScript maneja automáticamente el timezone del navegador
  // Para obtener la hora de CDMX, usamos Intl o calculamos manualmente
  const now = new Date();
  
  // Opción 1: Usar Intl.DateTimeFormat para verificación
  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: MEXICO_CITY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return now; // Retornamos la fecha actual; el servidor debe considerar la timezone
}

/**
 * Convierte una fecha a ISO string con la zona horaria de CDMX
 * @param date Fecha a convertir (default: ahora)
 * @returns ISO string con offset de CDMX
 */
export function toISOStringCDMX(date: Date = new Date()): string {
  // Obtener la hora local del cliente (asumimos que está en CDMX o
  // debería convertirse). Para serializar correctamente con zona horaria:
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: MEXICO_CITY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  
  // Extraer valores por tipo
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const hour = parts.find((p) => p.type === 'hour')?.value || '';
  const minute = parts.find((p) => p.type === 'minute')?.value || '';
  const second = parts.find((p) => p.type === 'second')?.value || '00';

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}:${second}`;

  // El offset de CDMX es -06:00 (puede variar durante horario de verano)
  // Por ahora asumimos UTC-6
  const offset = '-06:00';

  return `${dateStr}T${timeStr}${offset}`;
}

/**
 * Formatea una fecha/hora en CDMX para mostrar al usuario
 * @param date Fecha a formatear
 * @returns String como "27/01/2026 14:30:45"
 */
export function formatDateTimeCDMX(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: MEXICO_CITY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return formatter.format(dateObj);
}

/**
 * Formatea solo la fecha en CDMX
 * @param date Fecha a formatear
 * @returns String como "27/01/2026"
 */
export function formatDateCDMX(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: MEXICO_CITY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(dateObj);
}

/**
 * Obtiene la hora actual en CDMX como componentes separados
 * Útil para formularios
 */
export function getTimeCDMX(): {
  date: string;
  time: string;
  dateTime: string;
} {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: MEXICO_CITY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  
  // Extraer solo los valores numéricos (no literales)
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const hour = parts.find((p) => p.type === 'hour')?.value || '';
  const minute = parts.find((p) => p.type === 'minute')?.value || '';

  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;

  return {
    date,
    time,
    dateTime: `${date}T${time}`
  };
}
