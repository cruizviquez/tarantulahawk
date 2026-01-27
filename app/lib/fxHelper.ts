/**
 * Helper para obtener tipo de cambio MXN/USD en tiempo real
 * Integración con Banxico (actualización diaria) + API pública + cacheo local
 * 
 * Flujo:
 * 1. Obtener de API /fx/tipo-cambio (que obtiene de BD o archivo local)
 * 2. Cache local (24 horas)
 * 3. Fallback a default (17.5)
 */

const CACHE_KEY = 'fx_rate_mxn_usd';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en ms

interface FXCache {
  rate: number;
  timestamp: number;
  source: string;
}

/**
 * Obtiene el tipo de cambio MXN/USD desde la API o cache
 * 
 * Prioridad:
 * 1. Cache local (si es válido < 24h)
 * 2. API /api/fx/tipo-cambio (obtiene de BD o archivo)
 * 3. Fallback a 17.5
 */
export async function getFXRate(
  fallbackRate: number = 17.5
): Promise<number> {
  try {
    // 1. Intentar obtener del cache local
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { rate, timestamp, source } = JSON.parse(cached) as FXCache;
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.debug(`[FX] Usando cache local (${source}): ${rate}`);
          return rate;
        }
      }
    }

    // 2. Obtener desde la API propia
    const response = await fetch('/api/fx/tipo-cambio');

    if (!response.ok) {
      console.warn(`[FX] API error: ${response.status}. Usando fallback.`);
      return fallbackRate;
    }

    const data = (await response.json()) as {
      tasa?: number;
      rate?: number;
      fuente?: string;
    };
    
    const rate = data.tasa || data.rate;

    if (rate && typeof rate === 'number' && rate > 0) {
      // Cachear el resultado
      if (typeof window !== 'undefined') {
        const cache: FXCache = {
          rate,
          timestamp: Date.now(),
          source: data.fuente || 'api'
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
          // localStorage lleno o deshabilitado, ignorar
        }
      }
      console.debug(`[FX] Obtenido desde API: ${rate} (${data.fuente})`);
      return rate;
    }

    console.warn('[FX] Datos inválidos del API. Usando fallback.');
    return fallbackRate;
  } catch (error) {
    console.warn(`[FX] Error obteniendo tipo de cambio: ${error}. Usando fallback.`);
    return fallbackRate;
  }
}

/**
 * Convierte MXN a USD usando el tipo de cambio actual
 */
export async function convertMXNtoUSD(
  amountMXN: number,
  fallbackRate: number = 17.5
): Promise<number> {
  const rate = await getFXRate(fallbackRate);
  return amountMXN / rate;
}

/**
 * Versión síncrona usando un fallback (para APIs sin async)
 * Retorna conversión con el último rate conocido o fallback
 */
export function convertMXNtoUSDSync(
  amountMXN: number,
  fallbackRate: number = 17.5
): number {
  if (typeof window === 'undefined') {
    // En servidor, no tenemos acceso a localStorage
    return amountMXN / fallbackRate;
  }

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { rate, timestamp } = JSON.parse(cached) as FXCache;
      if (Date.now() - timestamp < CACHE_DURATION) {
        return amountMXN / rate;
      }
    }
  } catch (e) {
    // Ignorar errores de parsing
  }

  return amountMXN / fallbackRate;
}
