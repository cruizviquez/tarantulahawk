import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/app/lib/api-auth-helpers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { toISOStringCDMX } from '@/app/lib/timezoneHelper';

// PATCH /api/operaciones/[id]
// Actualiza una operación existente y recalcula clasificación PLD
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: operacionId } = await params;
  if (!operacionId) {
    return NextResponse.json({ error: 'operacion_id requerido' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const required = ['cliente_id', 'fecha_operacion', 'hora_operacion', 'tipo_operacion', 'monto', 'moneda'];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ error: `Campo requerido: ${k}` }, { status: 400 });
      }
    }

    const supabase = getServiceSupabase();

    // 1. Verificar que la operación existe y pertenece al usuario
    const { data: existente, error: fetchErr } = await supabase
      .from('operaciones')
      .select('*')
      .eq('operacion_id', operacionId)
      .eq('user_id', auth.user.id)
      .single();

    if (fetchErr || !existente) {
      return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 });
    }

    // 2. Preparar payload de actualización
    const moneda = body.moneda || 'MXN';
    const monto = Number(body.monto);
    const fxRate = 17.5; // TODO: obtener de cache/config
    const montoUSD = moneda === 'USD' ? monto : monto / fxRate;
    const ahora = toISOStringCDMX();

    // Reglas rápidas de clasificación
    let clasificacion_pld: 'relevante' | 'inusual' | 'preocupante' | null = null;
    const alertas: string[] = [];

    if (montoUSD >= 17500) {
      clasificacion_pld = 'relevante';
      alertas.push(`Operación relevante: ${moneda} ${monto} = USD ${montoUSD.toFixed(2).replace('.', ',')}`);
    }

    const desde = new Date();
    desde.setUTCDate(desde.getUTCDate() - 30);
    const { data: recientes, error: freqErr } = await supabase
      .from('operaciones')
      .select('operacion_id, fecha_operacion')
      .eq('user_id', auth.user.id)
      .eq('cliente_id', body.cliente_id)
      .gte('fecha_operacion', desde.toISOString().slice(0, 10));

    if (!freqErr) {
      const count = (recientes?.length || 0);
      if (count >= 3) {
        alertas.push('3ra operación en 30 días');
        if (!clasificacion_pld) clasificacion_pld = 'preocupante';
      }
    }

    const tiene_alertas = alertas.length > 0;

    const updatePayload: any = {
      fecha_operacion: body.fecha_operacion,
      hora_operacion: body.hora_operacion,
      monto,
      moneda,
      monto_usd: montoUSD,
      tipo_operacion: body.tipo_operacion,
      descripcion: body.descripcion || null,
      referencia: body.referencia_pago || body.referencia || null,
      numero_cuenta: body.numero_cuenta || null,
      banco_origen: body.banco_origen || null,
      banco_destino: body.banco_destino || null,
      clasificacion_pld,
      tiene_alertas,
      alertas,
      updated_at: ahora,
      updated_by: auth.user.id,
    };

    const { data: updated, error: updateErr } = await supabase
      .from('operaciones')
      .update(updatePayload)
      .eq('operacion_id', operacionId)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Auditoría
    const { error: auditErr } = await supabase.from('auditoria_operaciones').insert({
      user_id: auth.user.id,
      cliente_id: body.cliente_id,
      operacion_id: operacionId,
      accion: 'EDITAR',
      razon: body.razon_edicion || 'Actualización de operación',
      folio_operacion: existente.folio_interno,
      monto: monto,
      moneda,
      fecha_accion: ahora,
      ip_usuario: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
    });

    if (auditErr) {
      console.warn('Error registrando auditoría de edición:', auditErr);
    }

    return NextResponse.json({ success: true, operacion: updated });
  } catch (err: any) {
    console.error('Error en PATCH operaciones:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/operaciones/[id]
// Eliminar (soft delete) una operación con registro de auditoría
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: operacionId } = await params;
    if (!operacionId) {
      return NextResponse.json({ error: 'operacion_id requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { razon_eliminacion, cliente_id } = body;

    if (!razon_eliminacion || !razon_eliminacion.trim()) {
      return NextResponse.json({ error: 'razon_eliminacion es requerida' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Obtener la operación para verificar permisos
    const { data: operacion, error: fetchErr } = await supabase
      .from('operaciones')
      .select('*')
      .eq('operacion_id', operacionId)
      .eq('user_id', auth.user.id)
      .single();

    if (fetchErr || !operacion) {
      return NextResponse.json({ error: 'Operación no encontrada' }, { status: 404 });
    }

    // 2. Soft delete: marcar como eliminado
    const ahora = toISOStringCDMX();
    const { error: deleteErr } = await supabase
      .from('operaciones')
      .update({
        eliminada: true,
        fecha_eliminacion: ahora,
        eliminada_por: auth.user.id,
        razon_eliminacion: razon_eliminacion.trim()
      })
      .eq('operacion_id', operacionId)
      .eq('user_id', auth.user.id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 3. Registrar en auditoría
    const { error: auditErr } = await supabase
      .from('auditoria_operaciones')
      .insert({
        user_id: auth.user.id,
        cliente_id: cliente_id || operacion.cliente_id,
        operacion_id: operacionId,
        accion: 'ELIMINAR',
        razon: razon_eliminacion.trim(),
        folio_operacion: operacion.folio_interno,
        monto: operacion.monto,
        moneda: operacion.moneda,
        fecha_accion: ahora,
        ip_usuario: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });

    if (auditErr) {
      console.warn('Error registrando auditoría:', auditErr);
      // No es un error crítico - la operación ya fue eliminada
    }

    return NextResponse.json({
      success: true,
      message: `Operación ${operacion.folio_interno} eliminada. Registro de auditoría guardado.`,
      operacion_id: operacionId
    });
  } catch (err: any) {
    console.error('Error en DELETE operaciones:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
