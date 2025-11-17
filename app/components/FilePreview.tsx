'use client';

// components/FilePreview.tsx
/**
 * Preview de Archivo - Validación de columnas y estadísticas
 * Muestra información del archivo ANTES de procesar
 */

import React from 'react';
import { CheckCircle, XCircle, FileSpreadsheet, DollarSign, AlertCircle } from 'lucide-react';

export interface FileStats {
  rows: number;
  fileName: string;
  fileSize: number;
  columns?: string[];
}

interface FilePreviewProps {
  fileStats: FileStats;
  estimatedCost: number;
  userBalance: number;
  detectedColumns: string[];
  onClear?: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  fileStats,
  estimatedCost,
  userBalance,
  detectedColumns,
  onClear
}) => {
  
  // Columnas requeridas
  const requiredColumns = [
    'monto',
    'fecha',
    'tipo_operacion',
    'cliente_id',
    'sector_actividad'
  ];

  // Validar columnas
  const columnsValidation = requiredColumns.map(col => ({
    name: col,
    found: detectedColumns.some(detected => 
      detected.toLowerCase().trim() === col.toLowerCase()
    )
  }));

  const allColumnsValid = columnsValidation.every(col => col.found);
  const insufficientFunds = estimatedCost > userBalance;

  // Formatear tamaño
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-medium">{fileStats.fileName}</h3>
            <p className="text-sm text-gray-400">{formatFileSize(fileStats.fileSize)}</p>
          </div>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Cambiar archivo
          </button>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Transacciones</p>
          <p className="text-2xl font-bold text-white">
            {fileStats.rows.toLocaleString()}
          </p>
        </div>
        <div className={`rounded-lg p-3 ${
          insufficientFunds 
            ? 'bg-red-500/10 border border-red-500/30' 
            : 'bg-emerald-500/10 border border-emerald-500/30'
        }`}>
          <p className="text-gray-400 text-xs mb-1">Costo Estimado</p>
          <p className={`text-2xl font-bold ${
            insufficientFunds ? 'text-red-400' : 'text-emerald-400'
          }`}>
            ${estimatedCost.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Validación de Balance */}
      {insufficientFunds && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium text-sm">Saldo Insuficiente</p>
            <p className="text-gray-400 text-xs mt-1">
              Balance actual: ${userBalance.toFixed(2)} USD
            </p>
            <p className="text-gray-400 text-xs">
              Necesitas recargar ${(estimatedCost - userBalance).toFixed(2)} USD adicionales
            </p>
          </div>
        </div>
      )}

      {/* Validación de Columnas - Diseño Compacto */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-300">Columnas Requeridas</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {columnsValidation.map((col) => (
            <div key={col.name} className="flex items-center gap-1">
              {col.found ? (
                <span className="text-emerald-400">✓</span>
              ) : (
                <span className="text-red-400">✗</span>
              )}
              <span className="text-gray-300">{col.name}</span>
            </div>
          ))}
        </div>

        {!allColumnsValid && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-400 text-xs">
              Faltan columnas requeridas. El análisis no se puede completar.
            </p>
          </div>
        )}
      </div>

      {/* Pricing Breakdown */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Desglose de Precio</h4>
        <div className="space-y-1 text-xs">
          {fileStats.rows <= 1000 && (
            <div className="flex justify-between text-gray-400">
              <span>Primeras {fileStats.rows} transacciones × $1.00</span>
              <span>${(fileStats.rows * 1).toFixed(2)}</span>
            </div>
          )}
          {fileStats.rows > 1000 && fileStats.rows <= 5000 && (
            <>
              <div className="flex justify-between text-gray-400">
                <span>Primeras 1,000 transacciones × $1.00</span>
                <span>$1,000.00</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Siguientes {fileStats.rows - 1000} × $0.75</span>
                <span>${((fileStats.rows - 1000) * 0.75).toFixed(2)}</span>
              </div>
            </>
          )}
          {fileStats.rows > 5000 && (
            <>
              <div className="flex justify-between text-gray-400">
                <span>Primeras 1,000 transacciones × $1.00</span>
                <span>$1,000.00</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Transacciones 1,001-5,000 × $0.75</span>
                <span>$3,000.00</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Transacciones 5,001+ × $0.50</span>
                <span>${((fileStats.rows - 5000) * 0.50).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-white font-medium pt-2 border-t border-gray-700">
            <span>Total</span>
            <span>${estimatedCost.toFixed(2)} USD</span>
          </div>
        </div>
      </div>

      {/* Resumen de Validación */}
      <div className={`rounded-lg p-3 ${
        allColumnsValid && !insufficientFunds
          ? 'bg-emerald-500/10 border border-emerald-500/30'
          : 'bg-red-500/10 border border-red-500/30'
      }`}>
        <div className="flex items-center gap-2">
          {allColumnsValid && !insufficientFunds ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <p className="text-emerald-400 font-medium text-sm">
                ✓ Listo para analizar
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 font-medium text-sm">
                {!allColumnsValid && 'Columnas faltantes'}
                {!allColumnsValid && insufficientFunds && ' • '}
                {insufficientFunds && 'Saldo insuficiente'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreview;