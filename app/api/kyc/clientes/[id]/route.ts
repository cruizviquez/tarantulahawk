import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/supabaseServer';
import { getAuthenticatedUserId } from '../../../../lib/api-auth';

/**
 * PUT /api/kyc/clientes/:id/validaciones
 * Actualiza los resultados de validación de un cliente
 * Llamado después de ejecutar validaciones en listas
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🔵 PUT /api/kyc/clientes/[id] iniciado');
  try {
    const userId = await getAuthenticatedUserId(request);
    console.log('🔐 UserId autenticado:', userId);
    
    if (!userId) {
      console.log('❌ No autorizado - sin userId');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const clienteId = params.id;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    
    console.log('📋 Parámetros:', { clienteId, action, url: request.url });

    // Manejo de actualización de validaciones
    if (action === 'validaciones') {
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
        fecha_ultima_busqueda_listas,
        validaciones
      } = await request.json();

      const supabase = getServiceSupabase();
      console.log('🔍 Buscando cliente:', { clienteId, userId });

      // Verificar que el cliente pertenece al usuario actual
      const { data: cliente, error: checkError } = await supabase
        .from('clientes')
        .select('cliente_id')
        .eq('cliente_id', clienteId)
        .eq('user_id', userId)
        .single();

      if (checkError || !cliente) {
        console.error('❌ Cliente no encontrado:', { clienteId, userId, checkError });
        return NextResponse.json(
          { error: 'Cliente no encontrado', detail: checkError?.message || 'Sin datos' },
          { status: 404 }
        );
      }
      
      console.log('✅ Cliente encontrado:', cliente);

      // Construir objeto de actualización solo con campos definidos
      const updateData: any = {
        fecha_ultima_busqueda_listas: fecha_ultima_busqueda_listas || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (nivel_riesgo !== undefined) updateData.nivel_riesgo = nivel_riesgo;
      if (score_ebr !== undefined) updateData.score_ebr = score_ebr;
      if (en_lista_69b !== undefined) updateData.en_lista_69b = en_lista_69b;
      if (en_lista_ofac !== undefined) updateData.en_lista_ofac = en_lista_ofac;
      if (en_lista_uif !== undefined) updateData.en_lista_uif = en_lista_uif;
      if (en_lista_peps !== undefined) updateData.en_lista_peps = en_lista_peps;
      if (en_lista_csnu !== undefined) updateData.en_lista_csnu = en_lista_csnu;
      if (es_pep !== undefined) updateData.es_pep = es_pep;
      if (estado_expediente !== undefined) updateData.estado_expediente = estado_expediente;
      if (validaciones !== undefined) updateData.validaciones = validaciones;

      console.log('📝 Actualizando cliente con:', JSON.stringify(updateData, null, 2));

      // Actualizar cliente con resultados de validación
      const { data: clienteActualizado, error: updateError } = await supabase
        .from('clientes')
        .update(updateData)
        .eq('cliente_id', clienteId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error actualizando cliente en BD:', updateError);
        return NextResponse.json(
          { error: 'Error al actualizar cliente', detail: updateError.message, code: updateError.code },
          { status: 500 }
        );
      }
      
      console.log('✅ Cliente actualizado exitosamente:', clienteActualizado?.cliente_id);
      return NextResponse.json({
        success: true,
        cliente: clienteActualizado,
        message: 'Cliente actualizado con resultados de validación'
      });
    }

    console.log('⚠️ Acción no válida:', action);
    return NextResponse.json(
      { error: 'Acción no especificada o no válida', action_received: action },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ Error CATCH en PUT /api/kyc/clientes/:id:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', detail: String(error) },
      { status: 500 }
    );
  }
}
