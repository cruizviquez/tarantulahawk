import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/app/lib/api-auth-helpers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { getNowCDMX, toISOStringCDMX } from '@/app/lib/timezoneHelper';

// GET /api/operaciones?cliente_id=...
export async function GET(request: NextRequest) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('cliente_id');

  if (!clienteId) {
    return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('operaciones')
    .select('*')
    .eq('user_id', auth.user.id)
    .eq('cliente_id', clienteId)
    .order('fecha_operacion', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, operaciones: data || [] });
}

// POST /api/operaciones
export async function POST(request: NextRequest) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Generar folio: OP-YYYY-### por usuario
    const now = new Date();
    const year = now.getUTCFullYear();
    
    // Obtener la última operación del año para el usuario
    const { data: lastOp, error: lastOpErr } = await supabase
      .from('operaciones')
      .select('folio_interno')
      .eq('user_id', auth.user.id)
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Extraer número de secuencia del último folio o comenzar en 1
    let seq = 1;
    if (lastOp && lastOp.folio_interno) {
      const match = lastOp.folio_interno.match(/OP-\d+-(\d+)/);
      if (match && match[1]) {
        seq = parseInt(match[1], 10) + 1;
      }
    }
    
    const folio_interno = `OP-${year}-${String(seq).padStart(3, '0')}`;

    // Convertir monto MXN a USD si es necesario (default rate: 17.5)
    const moneda = body.moneda || 'MXN';
    const monto = Number(body.monto);
    const fxRate = 17.5; // Fallback - idealmente obtener del cache o config
    const montoUSD = moneda === 'USD' ? monto : monto / fxRate;

    // Insertar operación base con timestamp en CDMX
    const nowCDMX = toISOStringCDMX();
    const insertPayload: any = {
      user_id: auth.user.id,
      cliente_id: body.cliente_id,
      folio_interno,
      fecha_operacion: body.fecha_operacion,
      hora_operacion: body.hora_operacion,
      monto,
      moneda,
      monto_usd: montoUSD, // Guardar conversión a USD
      tipo_operacion: body.tipo_operacion,
      metodo_pago: body.metodo_pago || null,
      actividad_vulnerable: body.actividad_vulnerable || null,
      ubicacion_operacion: body.ubicacion_operacion || null,
      descripcion: body.descripcion || null,
      referencia_factura: body.referencia_factura || body.referencia_pago || body.referencia || null,
      notas_internas: body.notas_internas || null,
      numero_cuenta: body.numero_cuenta || null,
      banco_origen: body.banco_origen || null,
      banco_destino: body.banco_destino || null,
      created_by: auth.user.id,
      created_at: nowCDMX, // Timestamp en CDMX
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('operaciones')
      .insert([insertPayload])
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Reglas rápidas (paso 1):
    // - Umbral relevante en USD: monto >= 17,500 USD (convertido si es necesario)
    // - Frecuencia: 3+ operaciones en 30 días
    let clasificacion_pld: 'relevante' | 'inusual' | 'preocupante' | null = null;
    const alertas: string[] = [];

    // Verificar umbral en USD (17,500)
    if (montoUSD >= 17500) {
      clasificacion_pld = 'relevante';
      alertas.push(`Operación relevante: ${moneda} ${monto} = USD ${montoUSD.toFixed(2).replace('.', ',')}`);
    }

    // Frecuencia de operaciones últimos 30 días para el cliente
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);

    const { data: recientes, error: freqErr } = await supabase
      .from('operaciones')
      .select('operacion_id, fecha_operacion')
      .eq('user_id', auth.user.id)
      .eq('cliente_id', body.cliente_id)
      .gte('fecha_operacion', since.toISOString().slice(0, 10));

    if (!freqErr) {
      const count = (recientes?.length || 0);
      if (count >= 3) {
        alertas.push('3ra operación en 30 días');
        if (!clasificacion_pld) clasificacion_pld = 'preocupante';
      }
    }

    const tiene_alertas = alertas.length > 0;

    if (clasificacion_pld || tiene_alertas) {
      await supabase
        .from('operaciones')
        .update({ clasificacion_pld, tiene_alertas, alertas })
        .eq('operacion_id', inserted.operacion_id);
    }

    return NextResponse.json({ success: true, operacion: { ...inserted, clasificacion_pld, tiene_alertas, alertas } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error procesando operación' }, { status: 500 });
  }
}
