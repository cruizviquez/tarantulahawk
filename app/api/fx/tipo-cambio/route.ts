import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/fx/tipo-cambio
 * Retorna el tipo de cambio MXN/USD actual
 * 
 * Prioridad:
 * 1. BD (configuracion_so.tipo_cambio_mxn_usd)
 * 2. Archivo local (app/backend/data/tipo_cambio/tipo_cambio_actual.json)
 * 3. Fallback: 17.5
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    // Intento 1: obtener de BD (si hay configuración)
    const { data: configs, error: dbError } = await supabase
      .from('configuracion_so')
      .select('tipo_cambio_mxn_usd, tipo_cambio_fecha')
      .limit(1);

    if (!dbError && configs && configs.length > 0 && configs[0].tipo_cambio_mxn_usd) {
      return NextResponse.json({
        success: true,
        tasa: configs[0].tipo_cambio_mxn_usd,
        fecha_actualizacion: configs[0].tipo_cambio_fecha,
        fuente: 'base_datos'
      });
    }

    // Intento 2: obtener de archivo local
    try {
      const filePath = path.join(
        process.cwd(),
        'app/backend/data/tipo_cambio/tipo_cambio_actual.json'
      );

      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        if (data.tasa_mxn_usd) {
          return NextResponse.json({
            success: true,
            tasa: data.tasa_mxn_usd,
            fecha_actualizacion: data.fecha_actualizacion,
            fuente: 'archivo_local'
          });
        }
      }
    } catch (fileError) {
      console.warn('No se pudo leer archivo local de tipo de cambio:', fileError);
    }

    // Fallback: retornar tasa por defecto
    return NextResponse.json({
      success: true,
      tasa: 17.5,
      fecha_actualizacion: new Date().toISOString(),
      fuente: 'fallback_default',
      advertencia: 'Usando tasa por defecto - ejecutar script actualizar_tipo_cambio.py'
    });
  } catch (error) {
    console.error('Error en GET /api/fx/tipo-cambio:', error);
    return NextResponse.json(
      {
        success: true,
        tasa: 17.5,
        fuente: 'fallback_error'
      },
      { status: 200 } // Retornar 200 siempre para no romper la UI
    );
  }
}
