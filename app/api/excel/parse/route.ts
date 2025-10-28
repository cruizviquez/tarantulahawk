import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

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

    // 2. Validar tipo de archivo
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return NextResponse.json(
        { 
          error: `Tipo de archivo no válido. Extensión actual: ${fileName.split('.').pop()}. ` +
                 `Se requiere: ${validExtensions.join(', ')}`
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

    // 5. Parse con xlsx
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (xlsxError: unknown) {
      const errorMsg = xlsxError instanceof Error ? xlsxError.message : 'Error desconocido';
      return NextResponse.json(
        { 
          error: `No se pudo leer el archivo Excel. Puede estar corrupto o en formato no soportado.`,
          details: errorMsg
        },
        { status: 400 }
      );
    }

    // 6. Validar que tenga hojas
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: 'El archivo Excel no contiene hojas de cálculo' },
        { status: 400 }
      );
    }

    // 7. Obtener primera hoja
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 8. Convertir a JSON
    let jsonData: unknown[];
    try {
      jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
    } catch (jsonError: unknown) {
      const errorMsg = jsonError instanceof Error ? jsonError.message : 'Error desconocido';
      return NextResponse.json(
        { 
          error: 'Error al convertir la hoja de Excel a JSON',
          details: errorMsg
        },
        { status: 500 }
      );
    }

    // 9. Validar que tenga datos
    if (jsonData.length === 0) {
      return NextResponse.json(
        { 
          warning: 'El archivo se procesó correctamente pero no contiene datos (solo encabezados o está vacío)',
          sheetName: firstSheetName,
          rowCount: 0,
          data: []
        },
        { status: 200 }
      );
    }

    // 10. Preparar respuesta exitosa
    const response = {
      success: true,
      fileName: file.name,
      fileSize: file.size,
      sheetName: firstSheetName,
      totalSheets: workbook.SheetNames.length,
      rowCount: jsonData.length,
      columns: Object.keys(jsonData[0] as object),
      data: jsonData,
      preview: jsonData.slice(0, 5), // Primeras 5 filas para preview
    };

    return NextResponse.json(response, { status: 200 });

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
    description: 'Procesa archivos Excel (.xlsx, .xls, .csv) y retorna JSON',
    requiredFields: {
      file: 'File object en FormData'
    },
    supportedFormats: ['.xlsx', '.xls', '.csv'],
    maxDuration: 60,
    runtime: 'nodejs'
  });
}
