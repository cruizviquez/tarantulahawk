// app/api/clientes/[id]/actualizar-listas/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { validarListas } from '@/lib/lista-validators';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST /api/clientes/[id]/actualizar-listas
 * Re-valida las listas negras para un cliente específico
 * Retorna resultado actualizado + indica si fue encontrado en listas
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const clienteId = params.id;
    if (!clienteId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    // Obtener datos del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('cliente_id', clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Validar en listas
    const resultado = await validarListas(
      {
        tipo_persona: cliente.tipo_persona,
        nombre_completo: cliente.nombre_completo,
        rfc: cliente.rfc,
        curp: cliente.curp,
        sector_actividad: cliente.sector_actividad,
        origen_recursos: cliente.origen_recursos || ''
      },
      clienteId
    );

    // Verificar si fue encontrado en listas críticas
    const encontradoEnListas = 
      resultado.validaciones?.ofac?.encontrado ||
      resultado.validaciones?.csnu?.encontrado ||
      resultado.validaciones?.lista_69b?.en_lista ||
      resultado.validaciones?.uif?.encontrado ||
      resultado.validaciones?.peps_mexico?.encontrado;

    // Actualizar en BD
    const ahora = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        fecha_ultima_busqueda_listas: ahora,
        en_lista_ofac: resultado.validaciones?.ofac?.encontrado || false,
        en_lista_69b: resultado.validaciones?.lista_69b?.en_lista || false,
        en_lista_uif: resultado.validaciones?.uif?.encontrado || false,
        en_lista_peps: resultado.validaciones?.peps_mexico?.encontrado || false,
        en_lista_csnu: resultado.validaciones?.csnu?.encontrado || false,
        es_pep: resultado.validaciones?.peps_mexico?.encontrado || false,
        nivel_riesgo: resultado.nivel_riesgo || 'pendiente',
        score_ebr: resultado.score_riesgo !== undefined ? resultado.score_riesgo / 100 : null,
        estado_expediente: resultado.aprobado ? 'aprobado' : 'pendiente_aprobacion',
        updated_at: ahora
      })
      .eq('cliente_id', clienteId);

    if (updateError) {
      console.error('Error actualizando cliente:', updateError);
      return NextResponse.json(
        { error: 'Error actualizando cliente' },
        { status: 500 }
      );
    }

    // Respuesta
    return NextResponse.json({
      success: true,
      encontrado_en_listas: !!encontradoEnListas,
      alertas: resultado.alertas || [],
      validaciones: resultado.validaciones,
      nivel_riesgo: resultado.nivel_riesgo,
      aprobado: resultado.aprobado,
      timestamp: ahora
    });
  } catch (error: any) {
    console.error('Error en actualizar-listas:', error);
    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
