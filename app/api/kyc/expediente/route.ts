import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '../../../lib/api-auth';
import { getServiceSupabase } from '../../../lib/supabaseServer';

/**
 * POST /api/kyc/expediente
 * PASO 7: Guarda expediente completo en Supabase
 * - Sube documento a Storage
 * - Guarda metadata + validaciones en DB
 * - Conservación 10 años (timestamp)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const documento = formData.get('documento') as File | null;
    const clienteData = JSON.parse(formData.get('clienteData') as string || '{}');
    const validacionesData = JSON.parse(formData.get('validaciones') as string || '{}');
    const clasificacionEBR = JSON.parse(formData.get('clasificacionEBR') as string || '{}');

    const supabase = getServiceSupabase();

    // 1. Subir documento a Storage (si existe)
    // Store only the storage path; return signed URL for immediate use
    let documentoPath: string | null = null;
    let documentoSignedUrl: string | null = null;
    if (documento) {
      const filename = `${userId}/${Date.now()}_${documento.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('kyc-documentos')
        .upload(filename, documento, {
          contentType: documento.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Error subiendo documento:', uploadError);
      } else {
        documentoPath = filename;
        const { data: signedData, error: signedErr } = await supabase.storage
          .from('kyc-documentos')
          .createSignedUrl(filename, 60 * 60 * 24 * 7); // 7 días
        if (signedErr) {
          console.error('Error creando URL firmada:', signedErr);
        } else {
          documentoSignedUrl = signedData?.signedUrl || null;
        }
      }
    }

    // 2. Guardar en DB: tabla kyc_clientes
    const { data: cliente, error: dbError } = await supabase
      .from('kyc_clientes')
      .insert({
        user_id: userId,
        nombre: clienteData.nombre || '',
        apellido_paterno: clienteData.apellido_paterno || '',
        apellido_materno: clienteData.apellido_materno || '',
        rfc: clienteData.rfc || null,
        curp: clienteData.curp || null,
        documento_url: documentoPath, // almacenar solo el path
        validaciones: validacionesData,
        clasificacion_ebr: clasificacionEBR.nivel || 'BAJO',
        score_riesgo: clasificacionEBR.score || 0,
        decision_automatica: clasificacionEBR.decision || 'APROBADO',
        estado: clasificacionEBR.estado || 'aprobado',
        fecha_expiracion: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString() // 10 años
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error guardando en DB:', dbError);
      return NextResponse.json({ error: 'Error guardando expediente', detail: dbError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      cliente,
      documento_path: documentoPath,
      documento_signed_url: documentoSignedUrl,
      message: 'Expediente guardado exitosamente (conservación 10 años)'
    });
  } catch (error) {
    console.error('Error en expediente:', error);
    return NextResponse.json({ error: 'Error procesando expediente', detail: String(error) }, { status: 500 });
  }
}
