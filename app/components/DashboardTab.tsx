import React, { useState } from 'react';
import {
  Eye,
  Download,
  RefreshCw,
  FileText,
  Download as DownloadIcon
} from 'lucide-react';
import AnalysisSummary from './AnalysisSummary';
import MLProgressTracker from './MLProgressTracker';

interface DashboardTabProps {
  results: any[];
  summary?: any;
  isLoading: boolean;
  onRefresh: () => void;
  onViewDetails: (result: any) => void;
  onDownloadReport: (result: any) => void;
  classificationFilter?: string | null;
  onClassificationFilterChange?: (filter: string | null) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  results,
  summary,
  isLoading,
  onRefresh,
  onViewDetails,
  onDownloadReport,
  classificationFilter,
  onClassificationFilterChange
}) => {
  const [selectedResult, setSelectedResult] = useState<any>(null);

  const handleViewDetails = (result: any) => {
    setSelectedResult(result);
    onViewDetails(result);
  };

  const handleClassificationClick = (classification: string | null) => {
    if (onClassificationFilterChange) {
      onClassificationFilterChange(classification);
    }
  };

  if (isLoading) {
    return <MLProgressTracker stage="uploading" progress={50} />;
  }

  // Filter results based on classification filter
  const filteredResults = classificationFilter
    ? results.filter(r => r.clasificacion === classificationFilter)
    : results;

  // Simple stats calculation
  const totalTransactions = summary?.total_transacciones || results.length;
  const preocupanteCount = summary?.preocupante || results.filter(r => r.clasificacion === 'preocupante').length;
  const inusualCount = summary?.inusual || results.filter(r => r.clasificacion === 'inusual').length;
  const relevanteCount = summary?.relevante || results.filter(r => r.clasificacion === 'relevante').length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards - 4 Clickable Cards with Gradients */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => handleClassificationClick(null)}
          className={`bg-gradient-to-br from-gray-800 to-gray-900 border-2 rounded-xl p-6 text-center cursor-pointer transition-all hover:scale-105 ${
            classificationFilter === null ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-gray-700 hover:border-teal-500'
          }`}
        >
          <div className="text-3xl font-bold text-white mb-2">{totalTransactions}</div>
          <div className="text-sm text-gray-400">Total de Transacciones</div>
        </div>

        <div
          onClick={() => handleClassificationClick('preocupante')}
          className={`bg-gradient-to-br from-red-900/20 to-red-800/20 border-2 rounded-xl p-6 text-center cursor-pointer transition-all hover:scale-105 ${
            classificationFilter === 'preocupante' ? 'border-red-500 ring-2 ring-red-500/50' : 'border-red-800/50 hover:border-red-500'
          }`}
        >
          <div className="text-3xl font-bold text-red-400 mb-2">{preocupanteCount}</div>
          <div className="text-sm text-red-300">Preocupante</div>
        </div>

        <div
          onClick={() => handleClassificationClick('inusual')}
          className={`bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 border-2 rounded-xl p-6 text-center cursor-pointer transition-all hover:scale-105 ${
            classificationFilter === 'inusual' ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-yellow-800/50 hover:border-yellow-500'
          }`}
        >
          <div className="text-3xl font-bold text-yellow-400 mb-2">{inusualCount}</div>
          <div className="text-sm text-yellow-300">Inusual</div>
        </div>

        <div
          onClick={() => handleClassificationClick('relevante')}
          className={`bg-gradient-to-br from-green-900/20 to-green-800/20 border-2 rounded-xl p-6 text-center cursor-pointer transition-all hover:scale-105 ${
            classificationFilter === 'relevante' ? 'border-green-500 ring-2 ring-green-500/50' : 'border-green-800/50 hover:border-green-500'
          }`}
        >
          <div className="text-3xl font-bold text-green-400 mb-2">{relevanteCount}</div>
          <div className="text-sm text-green-300">Relevante</div>
        </div>
      </div>

      {/* Download Buttons */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => {/* Implement PDF download */}}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg font-semibold transition-all"
        >
          <FileText className="h-5 w-5" />
          Descargar Reporte PDF
        </button>
        <button
          onClick={() => {/* Implement XML download */}}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg font-semibold transition-all"
        >
          <DownloadIcon className="h-5 w-5" />
          Generar XML UIF
        </button>
      </div>

      {/* Transaction Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex flex-row items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-lg font-semibold">
            {classificationFilter
              ? `Transacciones ${classificationFilter === 'preocupante' ? 'Preocupantes' : classificationFilter === 'inusual' ? 'Inusuales' : 'Relevantes'}`
              : 'Transacciones Analizadas'
            }
          </h3>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Sector</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Score EBR</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Clasificación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Explicación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredResults.slice(0, 20).map((result, index) => (
                <tr key={index} className="hover:bg-gray-800/30">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-300">
                    {result.id || `TXN-${index + 1}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {result.fecha}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-teal-400">
                    ${result.monto?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {result.tipo_operacion}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {result.sector_actividad}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-400">
                    {result.score_ebr !== undefined ? result.score_ebr.toFixed(2) : result.risk_score?.toFixed(2) || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      result.clasificacion === 'preocupante'
                        ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                        : result.clasificacion === 'inusual'
                        ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30'
                        : 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {result.clasificacion === 'preocupante' ? 'Preocupante' :
                       result.clasificacion === 'inusual' ? 'Inusual' : 'Relevante'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">
                    {result.explicacion_principal || result.razones?.join(', ') || 'Sin explicación'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewDetails(result)}
                        className="p-1 hover:bg-gray-700 rounded transition"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4 text-gray-400 hover:text-white" />
                      </button>
                      <button
                        onClick={() => onDownloadReport(result)}
                        className="p-1 hover:bg-gray-700 rounded transition"
                        title="Descargar reporte"
                      >
                        <Download className="h-4 w-4 text-gray-400 hover:text-white" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};