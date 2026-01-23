import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '../../../../lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

    const resp = await fetch(`${backendUrl}/api/kyc/validar-listas-negras`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Reenviamos autorización si existe
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization') as string }
          : {}),
      },
      body: JSON.stringify(body),
    });

    const contentType = resp.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await resp.json().catch(() => null) : await resp.text().catch(() => null);

    return NextResponse.json(data ?? {}, { status: resp.status });
  } catch (error) {
    console.error('Error en validar-listas:', error);
    return NextResponse.json(
      { error: 'Error conectando con backend de validaciones' },
      { status: 502 }
    );
  }
}
