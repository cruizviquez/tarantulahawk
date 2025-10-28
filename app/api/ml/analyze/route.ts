import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId, checkUserBalance, deductBalance, logAuditEvent } from '@/app/lib/api-auth';

/**
 * EJEMPLO: API Route protegida para análisis de ML
 * 
 * Este endpoint demuestra las mejores prácticas de seguridad:
 * 1. Autenticación obligatoria
 * 2. Verificación de fondos antes de ejecutar
 * 3. Deducción de saldo tras uso exitoso
 * 4. Registro de auditoría (LFPIORPI compliance)
 * 5. Rate limiting (manejado por middleware)
 */

export async function POST(request: NextRequest) {
  // 1. AUTENTICACIÓN: Verificar que el usuario está autenticado
  const userId = await getAuthenticatedUserId(request);
  
  if (!userId) {
    await logAuditEvent('anonymous', 'ml_analysis_attempt', { reason: 'unauthenticated' }, undefined, 'analysis', 'failure');
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Debes iniciar sesión para usar este servicio' },
      { status: 401 }
    );
  }

  try {
    // 2. PARSEAR DATOS: Obtener archivo/datos del request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      await logAuditEvent(userId, 'ml_analysis_attempt', { reason: 'no_file' }, undefined, 'analysis', 'failure');
      return NextResponse.json(
        { error: 'Bad Request', message: 'Debes proporcionar un archivo' },
        { status: 400 }
      );
    }

    // 3. CALCULAR COSTO: Estimar transacciones y costo
    const fileSize = file.size;
    const estimatedTransactions = Math.floor(fileSize / 200); // Aproximación
    const cost = calculateCost(estimatedTransactions);

    // 4. VERIFICAR FONDOS: Asegurar que el usuario tiene saldo suficiente
    const hasBalance = await checkUserBalance(userId, cost);
    
    if (!hasBalance) {
      await logAuditEvent(userId, 'ml_analysis_attempt', { 
        reason: 'insufficient_funds',
        required: cost,
        transactions: estimatedTransactions 
      }, undefined, 'analysis', 'failure');
      
      return NextResponse.json(
        { 
          error: 'Insufficient Funds', 
          message: `Fondos insuficientes. Necesitas $${cost.toFixed(2)} para analizar ${estimatedTransactions} transacciones.`,
          required_amount: cost,
          transactions: estimatedTransactions
        },
        { status: 402 } // 402 Payment Required
      );
    }

    // 5. EJECUTAR ANÁLISIS DE ML (simulado aquí)
    // En producción, esto llamaría a tu backend de Python con los modelos de ML
    const analysisId = generateAnalysisId();
    
    // Simular procesamiento
    const mockResults = {
      analysis_id: analysisId,
      total_transacciones: estimatedTransactions,
      preocupante: Math.floor(estimatedTransactions * 0.05),
      inusual: Math.floor(estimatedTransactions * 0.12),
      relevante: Math.floor(estimatedTransactions * 0.28),
      limpio: Math.floor(estimatedTransactions * 0.55),
      cost: cost
    };

    // 6. DEDUCIR SALDO: Solo si el análisis fue exitoso
    const balanceDeducted = await deductBalance(userId, cost);
    
    if (!balanceDeducted) {
      await logAuditEvent(userId, 'ml_analysis_balance_error', { 
        analysis_id: analysisId,
        cost 
      }, analysisId, 'analysis', 'failure');
      
      return NextResponse.json(
        { error: 'Payment Error', message: 'Error al procesar el pago. Contacta soporte.' },
        { status: 500 }
      );
    }

    // 7. REGISTRO DE AUDITORÍA: Registrar análisis exitoso
    await logAuditEvent(userId, 'ml_analysis_completed', {
      analysis_id: analysisId,
      transactions: estimatedTransactions,
      cost: cost,
      file_name: file.name,
      file_size: fileSize
    }, analysisId, 'analysis', 'success');

    // 8. RETORNAR RESULTADOS
    return NextResponse.json({
      success: true,
      analysis_id: analysisId,
      results: mockResults,
      cost_charged: cost,
      transactions_analyzed: estimatedTransactions
    });

  } catch (error) {
    // Error handler con logging
    await logAuditEvent(userId, 'ml_analysis_error', { 
      error: error instanceof Error ? error.message : 'unknown' 
    }, undefined, 'analysis', 'failure');
    
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Error al procesar el análisis' },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateCost(numTransactions: number): number {
  if (numTransactions <= 2000) {
    return numTransactions * 1.0;
  } else if (numTransactions <= 5000) {
    return 2000 * 1.0 + (numTransactions - 2000) * 0.75;
  } else if (numTransactions <= 10000) {
    return 2000 * 1.0 + 3000 * 0.75 + (numTransactions - 5000) * 0.50;
  } else {
    return 2000 * 1.0 + 3000 * 0.75 + 5000 * 0.50;
  }
}

function generateAnalysisId(): string {
  return 'analysis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
