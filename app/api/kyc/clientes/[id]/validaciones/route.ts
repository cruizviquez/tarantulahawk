import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../../lib/supabaseServer';
import { getAuthenticatedUserId } from '../../../../../lib/api-auth';

/**
 * PUT /api/kyc/clientes/:id/validaciones
 * Actualiza los resultados de validación de un cliente
 * Llamado después de ejecutar validaciones en listas
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const clienteId = params.id;
    const {
      nivel_riesgo,
      score_ebr,
      en_lista_69b,
      en_lista_ofac,
      en_lista_uif,
      en_lista_peps,
      en_lista_csnu,
      es_pep,
      estado_expediente,
      validaciones
    } = await request.json();

    const supabase = getServiceSupabase();

    // Verificar que el cliente pertenece al usuario actual
    const { data: cliente, error: checkError } = await supabase
      .from('clientes')
      .select('cliente_id')
      .eq('cliente_id', clienteId)
      .eq('user_id', userId)
      .single();

    if (checkError || !cliente) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar cliente con resultados de validación
    const { data: clienteActualizado, error: updateError } = await supabase
      .from('clientes')
      .update({
        nivel_riesgo: nivel_riesgo || undefined,
        score_ebr: score_ebr !== undefined ? score_ebr : undefined,
        en_lista_69b: en_lista_69b !== undefined ? en_lista_69b : undefined,
        en_lista_ofac: en_lista_ofac !== undefined ? en_lista_ofac : undefined,
        en_lista_uif: en_lista_uif !== undefined ? en_lista_uif : undefined,
        en_lista_peps: en_lista_peps !== undefined ? en_lista_peps : undefined,
        en_lista_csnu: en_lista_csnu !== undefined ? en_lista_csnu : undefined,
        es_pep: es_pep !== undefined ? es_pep : undefined,
        estado_expediente: estado_expediente || undefined,
        validaciones: validaciones || undefined,
        fecha_ultima_busqueda_listas: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('cliente_id', clienteId)
      .select()
      .single();

    if (updateError) {
      console.error('Error actualizando cliente:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar cliente', detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cliente: clienteActualizado,
      message: 'Cliente actualizado con resultados de validación'
    });
  } catch (error) {
    console.error('Error en PUT /api/kyc/clientes/:id/validaciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', detail: String(error) },
      { status: 500 }
    );
  }
}
