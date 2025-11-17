'use client';

import React, { useState, useMemo } from 'react';
import { Eye, Download, Search, Calendar, AlertTriangle, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import AnalysisHistoryPanel from './AnalysisHistoryPanel';

interface HistoryItem {
  analysis_id: string;
  file_name: string;
  total_transacciones: number;
  costo: number;
  pagado: boolean;
  created_at: string;
  resumen: {
    preocupante: number;
    inusual: number;
    relevante: number;
    estrategia: string;
  };
  original_file_path?: string;
  processed_file_path?: string;
  xml_path?: string;
}

interface Props {
  historyItems: HistoryItem[];
  apiUrl?: string;
  token?: string;
  onViewDetails?: (result: HistoryItem) => void;
  onDownloadReport?: (result: HistoryItem) => void;
}

export const HistoryTab: React.FC<Props> = ({
  historyItems,
  apiUrl = '',
  token = '',
  onViewDetails,
  onDownloadReport
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'preocupante' | 'inusual' | 'relevante'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<HistoryItem | null>(null);
  const itemsPerPage = 20;

  // Memoized filtered and paginated results
  const { filteredResults, totalPages, paginatedResults } = useMemo(() => {
    let filtered = historyItems;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.analysis_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.created_at?.includes(searchTerm)
      );
    }

    // Apply type filter - filter by highest risk category
    if (filterType !== 'all') {
      filtered = filtered.filter(item => {
        const resumen = item.resumen;
        if (!resumen) return false;

        switch (filterType) {
          case 'preocupante':
            return resumen.preocupante > 0;
          case 'inusual':
            return resumen.inusual > 0 && resumen.preocupante === 0;
          case 'relevante':
            return resumen.relevante > 0 && resumen.preocupante === 0 && resumen.inusual === 0;
          default:
            return true;
        }
      });
    }

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedResults = filtered.slice(startIndex, startIndex + itemsPerPage);

    return { filteredResults: filtered, totalPages, paginatedResults };
  }, [historyItems, searchTerm, filterType, currentPage]);

  const handleViewDetails = (result: HistoryItem) => {
    setSelectedResult(result);
    onViewDetails?.(result);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Historial de Análisis</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ID, monto o fecha..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:border-teal-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                filterType === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setFilterType('all')}
            >
              Todos ({historyItems.length})
            </button>
            <button
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                filterType === 'preocupante' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setFilterType('preocupante')}
            >
              Preocupante ({historyItems.filter(item => item.resumen?.preocupante > 0).length})
            </button>
            <button
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                filterType === 'inusual' ? 'bg-yellow-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setFilterType('inusual')}
            >
              Inusual ({historyItems.filter(item => item.resumen?.inusual > 0 && item.resumen?.preocupante === 0).length})
            </button>
            <button
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                filterType === 'relevante' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              onClick={() => setFilterType('relevante')}
            >
              Relevante ({historyItems.filter(item => item.resumen?.relevante > 0 && item.resumen?.preocupante === 0 && item.resumen?.inusual === 0).length})
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">
            Resultados ({filteredResults.length})
          </h3>
          <div className="text-sm text-gray-400">
            Página {currentPage} de {totalPages}
          </div>
        </div>

        <div className="space-y-4">
          {paginatedResults.map((item, index) => {
            const highestRisk = item.resumen?.preocupante > 0 ? 'preocupante' :
                               item.resumen?.inusual > 0 ? 'inusual' : 'relevante';

            return (
              <div key={item.analysis_id || index} className="flex items-center justify-between p-4 border border-gray-700 rounded-lg hover:bg-gray-800/50 transition">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {highestRisk === 'preocupante' ? (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    ) : highestRisk === 'inusual' ? (
                      <Clock className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.file_name || `Análisis ${item.analysis_id}`}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <span>{item.total_transacciones} transacciones</span>
                      <span>${item.costo?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                        {item.resumen?.preocupante || 0}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                        {item.resumen?.inusual || 0}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                        {item.resumen?.relevante || 0}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    highestRisk === 'preocupante' ? 'bg-red-900/50 text-red-400' :
                    highestRisk === 'inusual' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-green-900/50 text-green-400'
                  }`}>
                    {highestRisk === 'preocupante' ? 'Alto Riesgo' :
                     highestRisk === 'inusual' ? 'Riesgo Moderado' : 'Bajo Riesgo'}
                  </span>
                  <button
                    className="p-2 hover:bg-gray-700 rounded-lg transition"
                    onClick={() => handleViewDetails(item)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-gray-700 rounded-lg transition"
                    onClick={() => onDownloadReport?.(item)}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <div className="flex items-center space-x-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                return (
                  <button
                    key={page}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      page === currentPage ? 'bg-teal-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Analysis History Panel Modal */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold">Detalles del Análisis</h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <AnalysisHistoryPanel
                history={[selectedResult]}
                apiUrl={apiUrl}
                token={token}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};