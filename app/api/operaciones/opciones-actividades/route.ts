/**
 * API Route: GET /api/operaciones/opciones-actividades
 * 
 * Proxy to Python backend endpoint for vulnerable activities dropdown
 * Returns list of Art. 17 LFPIORPI vulnerable activities from config_modelos.json
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Determine backend URL based on environment
    const host = request.headers.get('host') || 'localhost:3000';
    const backendUrl = host.includes('github.dev')
      ? `https://${host.replace('-3000.app', '-8000.app')}`
      : 'http://localhost:8000';

    console.log('[PROXY] Fetching from backend:', `${backendUrl}/api/operaciones/opciones-actividades`);

    // Fetch from Python backend
    const response = await fetch(`${backendUrl}/api/operaciones/opciones-actividades`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Don't cache in development
      cache: 'no-store',
    });

    console.log('[PROXY] Backend response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text');
      console.error(`[PROXY] Backend error: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json(
        { 
          error: 'Error al cargar opciones desde backend',
          detail: `Backend responded with ${response.status}`,
          total: 0,
          opciones: []
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[PROXY] Successfully fetched', data.total || 0, 'activities');
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error: any) {
    console.error('[PROXY] Error fetching opciones-actividades:', error);
    
    return NextResponse.json(
      { 
        error: 'Error de conexión con backend',
        detail: error.message,
        total: 0,
        opciones: []
      },
      { status: 500 }
    );
  }
}
