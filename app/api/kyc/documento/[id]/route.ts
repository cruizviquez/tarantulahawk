import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '../../../../lib/api-auth';
import { getServiceSupabase } from '../../../../lib/supabaseServer';

/**
 * GET /api/kyc/documento/:id
 * Devuelve una URL firmada temporal para el documento del cliente (bucket privado).
 * Seguridad: solo el dueño del expediente puede solicitar la URL.
 * Query opcional: ?expires=SECONDS (por defecto 600 = 10 minutos)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: clienteId } = await params;
    if (!clienteId) {
      return NextResponse.json({ error: 'Falta id de cliente' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Obtener path del documento y validar pertenencia
    const { data: cliente, error: fetchError } = await supabase
      .from('kyc_clientes')
      .select('id, user_id, documento_url')
      .eq('id', clienteId)
      .single();

    if (fetchError || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado', detail: fetchError?.message }, { status: 404 });
    }

    if (cliente.user_id !== userId) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    const path: string | null = cliente.documento_url || null;
    if (!path) {
      return NextResponse.json({ error: 'Cliente no tiene documento' }, { status: 404 });
    }

    // TTL configurable
    const url = new URL(request.url);
    const expiresParam = url.searchParams.get('expires');
    const expires = Math.max(60, Math.min(60 * 60 * 24 * 7, Number(expiresParam) || 600)); // 1 min..7 días

    const { data: signed, error: signedErr } = await supabase.storage
      .from('kyc-documentos')
      .createSignedUrl(path, expires);

    if (signedErr) {
      return NextResponse.json({ error: 'No se pudo crear URL firmada', detail: signedErr.message }, { status: 500 });
    }

    return NextResponse.json({
      signed_url: signed?.signedUrl,
      expires,
      path
    });
  } catch (err) {
    console.error('Error creando URL firmada:', err);
    return NextResponse.json({ error: 'Error interno', detail: String(err) }, { status: 500 });
  }
}
