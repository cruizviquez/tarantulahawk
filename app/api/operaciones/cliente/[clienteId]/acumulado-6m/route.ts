/**
 * API Route: GET /api/operaciones/cliente/[clienteId]/acumulado-6m
 * 
 * Proxy to Python backend endpoint for 6-month client accumulation
 * Returns accumulated operations data for LFPIORPI validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/app/lib/api-auth-helpers';

interface RouteParams {
  params: Promise<{
    clienteId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await validateAuth(request);
  if (auth.error || !auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clienteId } = await params;
    const { searchParams } = new URL(request.url);
    const actividadVulnerable = searchParams.get('actividad_vulnerable');

    // Determine backend URL based on environment
    const host = request.headers.get('host') || 'localhost:3000';
    const backendUrl = host.includes('github.dev')
      ? `https://${host.replace('-3000.app', '-8000.app')}`
      : 'http://localhost:8000';

    // Build backend URL with query params
    let backendUrlWithParams = `${backendUrl}/api/operaciones/cliente/${clienteId}/acumulado-6m`;
    if (actividadVulnerable) {
      backendUrlWithParams += `?actividad_vulnerable=${encodeURIComponent(actividadVulnerable)}`;
    }

    console.log('[PROXY] Fetching accumulation:', backendUrlWithParams);

    // Fetch from Python backend
    const response = await fetch(backendUrlWithParams, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    console.log('[PROXY] Backend response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text');
      console.error(`[PROXY] Backend accumulation error: ${response.status}`, errorText);
      return NextResponse.json(
        { 
          error: 'Error al cargar acumulado',
          detail: `Backend responded with ${response.status}`,
          cliente_id: clienteId,
          total_monto: 0,
          total_operaciones: 0,
          operaciones: []
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[PROXY] Accumulation loaded:', data.total_operaciones || 0, 'operations');
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });

  } catch (error: any) {
    console.error('[PROXY] Error fetching accumulation:', error);
    
    return NextResponse.json(
      { 
        error: 'Error de conexión al cargar acumulado',
        detail: error.message,
        total_monto: 0,
        total_operaciones: 0,
        operaciones: []
      },
      { status: 500 }
    );
  }
}
