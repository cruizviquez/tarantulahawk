import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../lib/supabaseServer';
import { getAuthenticatedUserId } from '../../../lib/api-auth';

/**
 * GET /api/kyc/clientes
 * Obtener lista de clientes KYC
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    // Obtener clientes del usuario
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo clientes:', error);
      return NextResponse.json(
        { error: 'Error al obtener clientes', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clientes: clientes || []
    });
  } catch (error) {
    console.error('Error en GET /api/kyc/clientes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kyc/clientes
 * Crear nuevo cliente KYC
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tipo_persona, nombre_completo, rfc, curp, sector_actividad, origen_recursos } = body;

    // Validar campos requeridos
    if (!tipo_persona || !nombre_completo || !rfc || !sector_actividad || !origen_recursos) {
      return NextResponse.json(
        { error: 'Campos requeridos faltantes' },
        { status: 400 }
      );
    }

    if (tipo_persona === 'fisica' && !curp) {
      return NextResponse.json(
        { error: 'CURP es requerido para personas físicas' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Verificar que el cliente no exista
    const { data: clienteExistente } = await supabase
      .from('clientes')
      .select('cliente_id')
      .eq('rfc', rfc)
      .eq('user_id', userId)
      .single();

    if (clienteExistente) {
      return NextResponse.json(
        { error: 'Cliente con este RFC ya existe' },
        { status: 409 }
      );
    }

    // Crear cliente
    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert([
        {
          user_id: userId,
          tipo_persona,
          nombre_completo,
          rfc: rfc.toUpperCase(),
          curp: curp ? curp.toUpperCase() : null,
          sector_actividad,
          origen_recursos,
          nivel_riesgo: 'en_revision',
          score_ebr: null,
          es_pep: false,
          en_lista_69b: false,
          en_lista_ofac: false
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creando cliente:', error);
      return NextResponse.json(
        { error: 'Error al crear cliente', detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cliente,
      estado: 'en_revision',
      mensaje: 'Cliente creado. Ejecutando validaciones en tiempo real (OFAC, CSNU, Lista 69B, EBR)...'
    });
  } catch (error) {
    console.error('Error en POST /api/kyc/clientes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', detail: String(error) },
      { status: 500 }
    );
  }
}
