import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // 1. Parsear FormData
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No se proporcionó un archivo válido. Asegúrate de enviar un campo "file".' },
        { status: 400 }
      );
    }

    // 2. Validar tipo de archivo (solo CSV permitido)
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.csv'];
    const isCsv = fileName.endsWith('.csv');
    if (!isCsv) {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo se aceptan archivos CSV. Exporta tu Excel como CSV antes de subirlo.',
          accepted: validExtensions
        },
        { status: 400 }
      );
    }

    // 3. Convertir File a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Validar que el buffer no esté vacío
    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío (0 bytes)' },
        { status: 400 }
      );
    }

    // 5. Procesar CSV de forma segura (sin librería vulnerable)
    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      return NextResponse.json(
        { success: false, error: 'El CSV está vacío (sin líneas útiles)' },
        { status: 400 }
      );
    }
    // Encabezados
    const headerLine = lines[0];
    const rawHeaders = headerLine.split(',').map(h => h.trim());
    const headersLower = rawHeaders.map(h => h.toLowerCase());
    const requiredColumns = ['cliente_id', 'monto', 'fecha', 'tipo_operacion', 'sector_actividad'];
    const missingColumns = requiredColumns.filter(c => !headersLower.includes(c));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Faltan columnas obligatorias: ${missingColumns.join(', ')}`,
          requiredColumns,
          foundColumns: rawHeaders,
          missingColumns
        },
        { status: 400 }
      );
    }
    // Contar filas de datos (excluyendo encabezado)
    const rowCount = lines.length - 1;
    // Previsualizar primeras 5 filas convertidas a objetos simples
    const previewRows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      rawHeaders.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
    return NextResponse.json(
      {
        success: true,
        fileName: file.name,
        fileSize: file.size,
        rowCount,
        columns: rawHeaders,
        requiredColumns,
        missingColumns: [],
        preview: previewRows
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    // Error genérico no capturado
    console.error('Error en /api/excel/parse:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: 'Error interno del servidor al procesar el archivo',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

// Opcional: GET para health check
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/excel/parse',
    method: 'POST',
    description: 'Procesa archivos CSV y retorna metadatos y preview',
    requiredFields: { file: 'File object en FormData' },
    supportedFormats: ['.csv'],
    maxDuration: 60,
    runtime: 'nodejs'
  });
}
