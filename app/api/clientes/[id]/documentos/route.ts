// app/api/clientes/[id]/documentos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { toISOStringCDMX } from '@/app/lib/timezoneHelper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Bucket de archivos (ajustado al bucket existente)
const BUCKET_DOCUMENTOS = 'kyc-documentos';

/**
 * GET /api/clientes/[id]/documentos
 * Lista documentos activos de un cliente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { id: clienteId } = await params;
    if (!clienteId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const { data: documentos, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('eliminado', false)
      .order('fecha_carga', { ascending: false });

    if (error) {
      console.error('Error obteniendo documentos:', error);
      return NextResponse.json({ error: 'Error obteniendo documentos' }, { status: 500 });
    }

    // Generar URLs firmadas para buckets privados (válidas por 1 hora)
    const documentosConUrls = await Promise.all(
      (documentos || []).map(async (doc) => {
        // Extraer el path del archivo desde la URL almacenada
        const urlParts = doc.archivo_url.split('/');
        const path = urlParts[urlParts.length - 1];
        
        // Generar signed URL (válida por 3600 segundos = 1 hora)
        const { data: signedUrlData, error: signedError } = await supabase.storage
          .from(BUCKET_DOCUMENTOS)
          .createSignedUrl(path, 3600);
        
        if (signedError) {
          console.error('Error creando signed URL:', signedError);
          return doc; // Devolver documento sin URL firmada si falla
        }
        
        return {
          ...doc,
          archivo_url: signedUrlData?.signedUrl || doc.archivo_url
        };
      })
    );

    return NextResponse.json({
      success: true,
      documentos: documentosConUrls
    });
  } catch (err: any) {
    console.error('Error en GET documentos:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clientes/[id]/documentos
 * Sube un documento al bucket "documentos" y lo registra en la tabla
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const { id: clienteId } = await params;
    if (!clienteId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const nombre = (formData.get('nombre') as string) || 'documento';
    const tipo = (formData.get('tipo') as string) || 'desconocido';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ruta de almacenamiento: user/cliente/timestamp-nombre
    const timestamp = Date.now();
    const safeName = nombre.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${timestamp}-${safeName}`;

    const { error: uploadError, data: storageData } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(path, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream'
      });

    if (uploadError) {
      console.error('Error subiendo a storage:', uploadError);
      return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 });
    }

    // Para buckets privados, guardamos el path y generaremos signed URLs cuando se necesiten
    const filePath = storageData?.path || path;

    // Registrar en tabla documentos
    const ahora = toISOStringCDMX();
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: 'No se pudo obtener el usuario' }, { status: 401 });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('documentos')
      .insert({
        user_id: userData.user.id,
        cliente_id: clienteId,
        nombre,
        tipo,
        archivo_url: filePath, // Guardamos solo el path, no la URL pública
        fecha_carga: ahora,
        metadata: {
          size: file.size,
          mime: file.type
        }
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Error registrando documento:', insertErr);
      return NextResponse.json({ error: 'No se pudo registrar el documento' }, { status: 500 });
    }

    // Generar signed URL para el documento recién subido
    const { data: signedUrlData } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(filePath, 3600);

    return NextResponse.json({ 
      success: true, 
      documento: {
        ...inserted,
        archivo_url: signedUrlData?.signedUrl || inserted.archivo_url
      }
    });
  } catch (err: any) {
    console.error('Error en POST documentos:', err);
    return NextResponse.json(
      { error: err?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
