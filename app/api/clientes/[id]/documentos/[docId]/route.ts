import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/app/lib/api-auth-helpers';
import { getServiceSupabase } from '@/app/lib/supabaseServer';
import { toISOStringCDMX } from '@/app/lib/timezoneHelper';

// DELETE /api/clientes/[id]/documentos/[docId]
// Eliminar (soft delete) un documento con registro de auditoría
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: clienteId, docId: documentoId } = await params;

    if (!clienteId || !documentoId) {
      return NextResponse.json({ error: 'cliente_id y documento_id requeridos' }, { status: 400 });
    }

    const body = await request.json();
    const { razon_eliminacion } = body;

    if (!razon_eliminacion || !razon_eliminacion.trim()) {
      return NextResponse.json({ error: 'razon_eliminacion es requerida' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 1. Verificar que el cliente pertenece al usuario
    const { data: cliente, error: clienteErr } = await supabase
      .from('clientes')
      .select('cliente_id')
      .eq('cliente_id', clienteId)
      .eq('user_id', auth.user.id)
      .single();

    if (clienteErr || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // 2. Obtener el documento
    const { data: documento, error: docErr } = await supabase
      .from('documentos')
      .select('*')
      .eq('documento_id', documentoId)
      .eq('cliente_id', clienteId)
      .single();

    if (docErr || !documento) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // 3. Soft delete: marcar como eliminado
    const ahora = toISOStringCDMX();
    const { error: deleteErr } = await supabase
      .from('documentos')
      .update({
        eliminado: true,
        fecha_eliminacion: ahora,
        eliminado_por: auth.user.id,
        razon_eliminacion: razon_eliminacion.trim()
      })
      .eq('documento_id', documentoId)
      .eq('cliente_id', clienteId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 4. Registrar en auditoría
    const { error: auditErr } = await supabase
      .from('auditoria_documentos')
      .insert({
        user_id: auth.user.id,
        cliente_id: clienteId,
        documento_id: documentoId,
        accion: 'ELIMINAR',
        razon: razon_eliminacion.trim(),
        nombre_documento: documento.nombre,
        tipo: documento.tipo,
        fecha_accion: ahora,
        ip_usuario: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });

    if (auditErr) {
      console.warn('Error registrando auditoría de documento:', auditErr);
      // No es un error crítico - el documento ya fue eliminado
    }

    return NextResponse.json({
      success: true,
      message: `Documento "${documento.nombre}" eliminado. Registro de auditoría guardado.`,
      documento_id: documentoId
    });
  } catch (err: any) {
    console.error('Error en DELETE documentos:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
