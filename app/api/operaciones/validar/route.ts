/**
 * API Route: POST /api/operaciones/validar
 * 
 * Proxy to Python backend LFPIORPI validation endpoint
 * Validates operation without saving it
 * Returns validation result with 5 LFPIORPI rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/app/lib/api-auth-helpers';

export async function POST(request: NextRequest) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Determine backend URL based on environment
    const host = request.headers.get('host') || 'localhost:3000';
    const backendUrl = host.includes('github.dev')
      ? `https://${host.replace('-3000.app', '-8000.app')}`
      : 'http://localhost:8000';

    console.log('[PROXY] Validating operation:', `${backendUrl}/api/operaciones/validar`);
    console.log('[PROXY] Request body:', JSON.stringify(body, null, 2));

    // Fetch from Python backend
    const response = await fetch(`${backendUrl}/api/operaciones/validar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    console.log('[PROXY] Backend response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text');
      console.error(`[PROXY] Backend validation error: ${response.status}`, errorText);
      return NextResponse.json(
        { 
          error: 'Error al validar operación',
          detail: `Backend responded with ${response.status}`,
          debe_bloquearse: false,
          recomendacion: 'error'
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[PROXY] Validation result:', data.recomendacion, 'Bloqueo:', data.debe_bloquearse);
    
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[PROXY] Error validating operation:', error);
    
    return NextResponse.json(
      { 
        error: 'Error de conexión con servidor de validación',
        detail: error.message,
        debe_bloquearse: false,
        recomendacion: 'error'
      },
      { status: 500 }
    );
  }
}
