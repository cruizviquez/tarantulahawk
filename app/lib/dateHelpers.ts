// app/lib/dateHelpers.ts
/**
 * Calcula los días transcurridos desde una fecha hasta hoy
 * @param dateString ISO date string o null
 * @returns Número de días (0 si la fecha es hoy, negativo si es futura)
 */
export function daysSince(dateString: string | null | undefined): number {
  if (!dateString) return Infinity; // Si no hay fecha, considerar como nunca
  
  try {
    const pastDate = new Date(dateString);
    const today = new Date();
    
    // Normalizar a medianoche para evitar problemas de zona horaria
    pastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffMs = today.getTime() - pastDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.error('Error calculating daysSince:', error);
    return Infinity;
  }
}

/**
 * Formatea una fecha en formato CDMX (CDMX)
 * @param dateString ISO date string
 * @returns Fecha formateada como "27/01/2026"
 */
export function formatDateShortCDMX(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Mexico_City'
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Formatea hora en formato HH:MM
 * @param timeString ISO date string o time string
 * @returns Hora formateada como "14:30"
 */
export function formatTimeCDMX(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Mexico_City'
    });
  } catch (error) {
    return dateString;
  }
}
