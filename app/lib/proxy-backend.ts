import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from './api-auth';

/**
 * Proxy genérico para reenviar requests al backend desde Next.js
 * Permite mantener el browser hablando únicamente con Next.js
 * mientras Next.js reenvía al backend del lado del servidor
 */
export async function proxyToBackend(
  request: NextRequest,
  pathSegment: string,
  options?: {
    requireAuth?: boolean;
    preserveHeaders?: string[];
  }
): Promise<NextResponse> {
  try {
    const {
      requireAuth = true,
      preserveHeaders = ['content-type', 'authorization']
    } = options || {};

    // Verificar autenticación si es requerida
    if (requireAuth) {
      const userId = await getAuthenticatedUserId(request);
      if (!userId) {
        return NextResponse.json(
          { error: 'No autorizado' },
          { status: 401 }
        );
      }
    }

    // Obtener URL del backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
    
    // Extraer path relativo de la request
    const url = new URL(request.url);
    const relativePath = url.pathname.replace(/^\/api\/(portal|kyc|history)/, '');
    
    // Construir URL del backend
    const backendRequestUrl = `${backendUrl}/api/${pathSegment}${relativePath}${url.search}`;

    // Preparar headers
    const headers = new Headers();
    
    // Copiar headers relevantes
    for (const headerName of preserveHeaders) {
      const headerValue = request.headers.get(headerName);
      if (headerValue) {
        headers.set(headerName, headerValue);
      }
    }

    // Asegurar que tenemos el Content-Type correcto para POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    }

    // Obtener body si existe
    let body: BodyInit | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          body = JSON.stringify(await request.json());
        } else if (contentType?.includes('multipart/form-data')) {
          body = await request.arrayBuffer();
        } else {
          body = await request.text();
        }
      } catch {
        // No hay body o no se puede parsear
      }
    }

    // Reenviar request al backend
    const backendResponse = await fetch(backendRequestUrl, {
      method: request.method,
      headers,
      body,
    });

    // Obtener respuesta del backend
    const responseData = await backendResponse.text();

    // Crear respuesta
    const response = new NextResponse(responseData, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });

    // Copiar headers relevantes de la respuesta
    const relevantResponseHeaders = [
      'content-type',
      'content-length',
      'cache-control',
      'set-cookie',
    ];

    for (const headerName of relevantResponseHeaders) {
      const headerValue = backendResponse.headers.get(headerName);
      if (headerValue) {
        response.headers.set(headerName, headerValue);
      }
    }

    return response;
  } catch (error) {
    console.error(`Error en proxy a backend (${pathSegment}):`, error);
    return NextResponse.json(
      { 
        error: 'Error al conectar con el backend',
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
