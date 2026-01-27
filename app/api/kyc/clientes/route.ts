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

    // Enriquecer cada cliente con el conteo dinámico de operaciones activas (no eliminadas)
    const clientesEnriquecidos = await Promise.all(
      (clientes || []).map(async (cliente: any) => {
        const { count, error: countError } = await supabase
          .from('operaciones')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', cliente.cliente_id)
          .is('eliminada', false); // Contar solo operaciones no eliminadas (soft delete)

        return {
          ...cliente,
          num_operaciones: !countError && count !== null ? count : 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      clientes: clientesEnriquecidos || []
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
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Extraer ID de la URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const clienteId = pathParts[pathParts.length - 2]; // ...clientes/:id/status

    if (!clienteId || clienteId === 'status') {
      return NextResponse.json(
        { error: 'Cliente ID no proporcionado' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: cliente, error } = await supabase
      .from('clientes')
      .select('cliente_id, nivel_riesgo, en_lista_69b, en_lista_ofac, es_pep, updated_at')
      .eq('cliente_id', clienteId)
      .eq('user_id', userId)
      .single();

    if (error || !cliente) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      cliente_id: cliente.cliente_id,
      nivel_riesgo: cliente.nivel_riesgo,
      en_lista_69b: cliente.en_lista_69b,
      en_lista_ofac: cliente.en_lista_ofac,
      es_pep: cliente.es_pep,
      updated_at: cliente.updated_at
    });
  } catch (error) {
    console.error('Error en GET /api/kyc/clientes/:id/status:', error);
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
          nivel_riesgo: 'pendiente',
          score_ebr: null,
          es_pep: false,
          en_lista_69b: false,
          en_lista_ofac: false,
          estado_expediente: 'borrador'
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

    // 🆕 Disparar validaciones automáticas en background
    // No esperamos la respuesta para no bloquear la creación
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const authHeader = request.headers.get('authorization') || '';
    
    // Ejecutar validaciones sin esperar
    (async () => {
      try {
        // Llamar a validar-listas para obtener resultados
        const validacionesResponse = await fetch(
          `${origin}/api/kyc/validar-listas`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              nombre: nombre_completo.split(' ')[0],
              apellido_paterno: nombre_completo.split(' ')[1] || '',
              apellido_materno: nombre_completo.split(' ').slice(2).join(' '),
              rfc: rfc.toUpperCase()
            })
          }
        );

        if (validacionesResponse?.ok) {
          const validacionData = await validacionesResponse.json();
          const validaciones = validacionData.validaciones;

          // Determinar nivel de riesgo basado en validaciones
          const en69B = validaciones?.lista_69b?.en_lista === true;
          const enOFAC = validaciones?.ofac?.encontrado === true;
          const enCSNU = validaciones?.csnu?.encontrado === true;

          let nivel_riesgo = 'bajo';
          if (en69B || enOFAC || enCSNU) {
            nivel_riesgo = 'alto';
          }

          // Actualizar cliente con resultados
          await supabase
            .from('clientes')
            .update({
              nivel_riesgo,
              en_lista_69b: en69B || false,
              en_lista_ofac: enOFAC || false,
              updated_at: new Date().toISOString()
            })
            .eq('cliente_id', cliente.cliente_id);

          console.log(`✅ Validaciones completadas para cliente ${cliente.cliente_id}:`, { nivel_riesgo, validaciones });
        }
      } catch (err) {
        console.error('Error en validaciones automáticas:', err);
      }
    })();

    return NextResponse.json({
      success: true,
      cliente,
      estado: 'pendiente',
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

