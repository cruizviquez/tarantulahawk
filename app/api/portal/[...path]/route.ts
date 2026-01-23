import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '../../../lib/proxy-backend';

/**
 * Proxy genérico para todos los endpoints de /api/portal/*
 * Reenvía al backend manteniendo el navegador hablando solo con Next.js
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyToBackend(request, 'portal', {
    requireAuth: true,
    preserveHeaders: ['content-type', 'authorization'],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyToBackend(request, 'portal', {
    requireAuth: true,
    preserveHeaders: ['content-type', 'authorization'],
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyToBackend(request, 'portal', {
    requireAuth: true,
    preserveHeaders: ['content-type', 'authorization'],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyToBackend(request, 'portal', {
    requireAuth: true,
    preserveHeaders: ['content-type', 'authorization'],
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return proxyToBackend(request, 'portal', {
    requireAuth: true,
    preserveHeaders: ['content-type', 'authorization'],
  });
}
