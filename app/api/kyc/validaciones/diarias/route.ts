import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/supabaseServer';

/**
 * POST /api/kyc/validaciones/diarias
 * PASO 8: Job Diario (Background)
 * - Ejecuta a las 2am vía cron
 * - Re-verifica TODOS los clientes registrados
 * - Si cliente pasa a lista → Alerta + marca en rojo
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticación via CRON_SECRET
    const authHeader = request.headers.get('authorization') || '';
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabase = getServiceSupabase();

    // 1. Obtener TODOS los clientes activos
    const { data: clientes, error: fetchError } = await supabase
      .from('kyc_clientes')
      .select('*')
      .neq('estado', 'eliminado');

    if (fetchError || !clientes) {
      return NextResponse.json({ error: 'Error obteniendo clientes', detail: fetchError?.message }, { status: 500 });
    }

    let procesados = 0;
    let actualizados = 0;
    let alertas = 0;

    // 2. Re-validar cada cliente contra listas
    for (const cliente of clientes) {
      try {
        // Llamar a validar-listas internamente
        const validacionRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/kyc/validar-listas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: cliente.nombre,
            apellido_paterno: cliente.apellido_paterno,
            apellido_materno: cliente.apellido_materno,
            rfc: cliente.rfc
          })
        });

        const validacion = await validacionRes.json();
        const scoreNuevo = validacion.score_riesgo || 0;
        const aprobadoNuevo = validacion.aprobado;

        // Clasificación EBR actualizada
        const clasificacionNueva = clasificarEBR(scoreNuevo, validacion.validaciones);

        // 3. Detectar cambios críticos
        const cambioEstado = cliente.decision_automatica !== clasificacionNueva.decision;
        const ahoraEnLista = !aprobadoNuevo && cliente.estado === 'aprobado';

        if (cambioEstado || ahoraEnLista) {
          // ALERTA: Cliente pasó a lista o cambió nivel de riesgo
          await supabase.from('kyc_clientes').update({
            validaciones: validacion.validaciones,
            score_riesgo: scoreNuevo,
            clasificacion_ebr: clasificacionNueva.nivel,
            decision_automatica: clasificacionNueva.decision,
            estado: ahoraEnLista ? 'rechazado' : clasificacionNueva.estado,
            alerta_activa: ahoraEnLista,
            ultima_validacion: new Date().toISOString()
          }).eq('id', cliente.id);

          actualizados++;
          if (ahoraEnLista) alertas++;
        }

        procesados++;
      } catch (err) {
        console.error(`Error validando cliente ${cliente.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      clientes_procesados: procesados,
      clientes_actualizados: actualizados,
      alertas_generadas: alertas,
      message: `Job diario completado: ${procesados} clientes verificados, ${actualizados} actualizados, ${alertas} alertas`
    });
  } catch (error) {
    console.error('Error en job diario:', error);
    return NextResponse.json({ error: 'Error ejecutando job diario', detail: String(error) }, { status: 500 });
  }
}

/**
 * PASO 5: Clasificación EBR Automática
 * Matriz de riesgo: Score 0-100 → Nivel: Bajo/Medio/Alto/Crítico
 */
function clasificarEBR(score: number, validaciones: any) {
  let nivel = 'BAJO';
  let decision = 'APROBADO';
  let estado = 'aprobado';

  // PASO 6: Decisión Automática
  const enLista = validaciones?.ofac?.encontrado || validaciones?.csnu?.encontrado || 
                  validaciones?.uif?.encontrado || validaciones?.peps?.encontrado ||
                  validaciones?.lista_69b?.en_lista;

  if (enLista) {
    // En listas → ❌ Rechazado siempre
    nivel = 'CRITICO';
    decision = 'RECHAZADO';
    estado = 'rechazado';
  } else if (score > 70) {
    // Score > 70 → ❌ Rechazado automático
    nivel = 'ALTO';
    decision = 'RECHAZADO';
    estado = 'rechazado';
  } else if (score >= 30 && score <= 70) {
    // Score 30-70 → ⚠️ Revisión manual
    nivel = 'MEDIO';
    decision = 'REVISION_MANUAL';
    estado = 'pendiente_aprobacion';
  } else {
    // Score < 30 → ✅ Aprobado automático
    nivel = 'BAJO';
    decision = 'APROBADO';
    estado = 'aprobado';
  }

  return { nivel, decision, estado, score };
}

export { clasificarEBR };
