// app/api/clientes/[id]/operaciones/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/clientes/[id]/operaciones
 * Obtiene el historial de operaciones de un cliente
 * Incluye: total de operaciones, monto acumulado, estadísticas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: clienteId } = await params;
    if (!clienteId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    // Obtener operaciones del cliente, ordenadas por fecha DESC
    const { data: operaciones, error: opsError } = await supabase
      .from('operaciones')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('eliminada', false)
      .order('fecha_operacion', { ascending: false })
      .order('hora_operacion', { ascending: false });

    if (opsError) {
      console.error('Error obteniendo operaciones:', opsError);
      return NextResponse.json(
        { error: 'Error obteniendo operaciones' },
        { status: 500 }
      );
    }

    // Calcular estadísticas
    const totalOperaciones = operaciones?.length || 0;
    const montoTotalMXN = (operaciones || [])
      .filter(op => op.moneda === 'MXN')
      .reduce((sum, op) => sum + (Number(op.monto) || 0), 0);
    
    const montoTotalUSD = (operaciones || [])
      .filter(op => op.moneda === 'USD')
      .reduce((sum, op) => sum + (Number(op.monto_usd) || 0), 0);

    // Calcular últimas 6 meses (180 días)
    const hace6Meses = new Date();
    hace6Meses.setDate(hace6Meses.getDate() - 180);
    
    const operaciones6M = (operaciones || []).filter(op => {
      const opDate = new Date(op.fecha_operacion);
      return opDate >= hace6Meses;
    });

    const monto6M = operaciones6M.reduce((sum, op) => {
      const monto = op.moneda === 'MXN' ? Number(op.monto) : (Number(op.monto_usd) || 0) * 17.5;
      return sum + monto;
    }, 0);

    // Clasificación PLD
    const clasificaciones = {
      relevante: (operaciones || []).filter(op => op.clasificacion_pld === 'relevante').length,
      preocupante: (operaciones || []).filter(op => op.clasificacion_pld === 'preocupante').length,
      normal: (operaciones || []).filter(op => op.clasificacion_pld === 'normal').length
    };

    // Última operación
    const ultimaOperacion = operaciones && operaciones.length > 0
      ? {
          folio: operaciones[0].folio_interno,
          fecha: operaciones[0].fecha_operacion,
          hora: operaciones[0].hora_operacion,
          monto: operaciones[0].monto,
          moneda: operaciones[0].moneda
        }
      : null;

    return NextResponse.json({
      success: true,
      resumen: {
        total_operaciones: totalOperaciones,
        monto_total_mxn: Math.round(montoTotalMXN * 100) / 100,
        monto_total_usd: Math.round(montoTotalUSD * 100) / 100,
        monto_6meses_mxn: Math.round(monto6M * 100) / 100,
        clasificaciones,
        ultima_operacion: ultimaOperacion
      },
      operaciones: (operaciones || []).map(op => ({
        operacion_id: op.operacion_id,
        folio_interno: op.folio_interno,
        fecha_operacion: op.fecha_operacion,
        hora_operacion: op.hora_operacion,
        tipo_operacion: op.tipo_operacion,
        monto: Number(op.monto),
        moneda: op.moneda,
        monto_usd: op.monto_usd ? Number(op.monto_usd) : null,
        metodo_pago: op.metodo_pago,
        clasificacion_pld: op.clasificacion_pld,
        alertas: op.alertas,
        descripcion: op.descripcion,
        referencia_factura: op.referencia_factura,
        producto_servicio: op.producto_servicio
      }))
    });
  } catch (error: any) {
    console.error('Error en GET operaciones:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
