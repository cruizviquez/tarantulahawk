// hooks/useValidacionLFPIORPI.ts
import { useState, useCallback, useEffect } from 'react';
import type {
  ValidacionLFPIORPIResponse,
  OperacionValidarRequest,
  AcumuladoCliente,
  ActividadVulnerable
} from '../lib/lfpiorpi-types';

/**
 * Hook para validación de operaciones LFPIORPI en tiempo real
 * 
 * Implementa las 5 reglas:
 * - Regla 1: Umbral de Aviso (Art. 23)
 * - Regla 2: Acumulación 6 meses (Art. 17 + Art. 7 Regl.)
 * - Regla 3: Listas Negras (Art. 24) - BLOQUEO
 * - Regla 4: Efectivo Prohibido (Art. 32)
 * - Regla 5: Indicios Procedencia Ilícita (Art. 24)
 */
export function useValidacionLFPIORPI() {
  const [validacion, setValidacion] = useState<ValidacionLFPIORPIResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validarOperacion = useCallback(async (request: OperacionValidarRequest) => {
    setCargando(true);
    setError(null);
    
    try {
      console.log('[useValidacionLFPIORPI] Validating operation...');
      const response = await fetch('/api/operaciones/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`[useValidacionLFPIORPI] HTTP ${response.status}:`, errorText);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.detail || `HTTP ${response.status} - Error al validar operación`);
      }

      const data: ValidacionLFPIORPIResponse = await response.json();
      console.log('[useValidacionLFPIORPI] Validation result:', data.recomendacion, '| Blocked:', data.debe_bloquearse);
      setValidacion(data);
      
      return data;
    } catch (err: any) {
      const mensaje = err?.message || 'Error al validar operación';
      console.error('[useValidacionLFPIORPI] Error:', mensaje);
      setError(mensaje);
      // Don't re-throw - let the component handle the error gracefully
    } finally {
      setCargando(false);
    }
  }, []);

  const resetValidacion = useCallback(() => {
    setValidacion(null);
    setError(null);
  }, []);

  return {
    validacion,
    cargando,
    error,
    validarOperacion,
    resetValidacion
  };
}

/**
 * Hook para obtener acumulado de cliente en 6 meses
 */
export function useAcumuladoCliente(clienteId: string | null, actividadVulnerable?: string) {
  const [acumulado, setAcumulado] = useState<AcumuladoCliente | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarAcumulado = useCallback(async () => {
    if (!clienteId) {
      console.log('[useAcumuladoCliente] clienteId is null/empty, skipping');
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (actividadVulnerable) {
        params.append('actividad_vulnerable', actividadVulnerable);
      }

      const url = `/api/operaciones/cliente/${clienteId}/acumulado-6m${params.toString() ? '?' + params.toString() : ''}`;
      console.log('[useAcumuladoCliente] Fetching:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.error(`[useAcumuladoCliente] HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status} - Error al cargar acumulado del cliente`);
      }

      const data: AcumuladoCliente = await response.json();
      console.log('[useAcumuladoCliente] Loaded successfully:', data.resumen.total_operaciones, 'operations');
      setAcumulado(data);
      
      return data;
    } catch (err: any) {
      const mensaje = err?.message || 'Error al cargar acumulado';
      console.error('[useAcumuladoCliente] Error:', mensaje);
      setError(mensaje);
      // Don't re-throw - let the component handle the error gracefully
    } finally {
      setCargando(false);
    }
  }, [clienteId, actividadVulnerable]);

  useEffect(() => {
    if (clienteId) {
      console.log('[useAcumuladoCliente] useEffect triggered for clienteId:', clienteId);
      cargarAcumulado();
    }
  }, [clienteId, cargarAcumulado]);

  return { acumulado, cargando, error, recargar: cargarAcumulado };
}

/**
 * Hook para cargar lista de actividades vulnerables
 */
export function useActividadesVulnerables() {
  const [actividades, setActividades] = useState<ActividadVulnerable[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        console.log('[useActividadesVulnerables] Fetching from /api/operaciones/opciones-actividades...');
        const response = await fetch('/api/operaciones/opciones-actividades', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No error details');
          console.error('[useActividadesVulnerables] HTTP', response.status, ':', errorText);
          throw new Error(`HTTP ${response.status} - Error al cargar actividades`);
        }

        const data = await response.json();
        const items = data?.opciones || [];
        console.log('[useActividadesVulnerables] Loaded', items.length, 'activities');
        setActividades(items);
      } catch (err: any) {
        const mensaje = err?.message || 'Error al cargar actividades';
        console.error('[useActividadesVulnerables] Error:', mensaje);
        setError(mensaje);
        setActividades([]);
      } finally {
        setCargando(false);
      }
    };

    cargar();
  }, []);

  return { actividades, cargando, error };
}
