'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Download, FileText, FileSpreadsheet, File } from 'lucide-react';

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
  history: HistoryItem[];
  language: 'es' | 'en';
  apiUrl: string;
  token: string;
}

export default function AnalysisHistoryPanel({ history, language, apiUrl, token }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, any>>({});

  const toggleExpand = async (analysisId: string) => {
    if (expandedId === analysisId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(analysisId);

    // Fetch details if not cached
    if (!detailsCache[analysisId]) {
      try {
        const response = await fetch(`${apiUrl}/api/history/${analysisId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setDetailsCache(prev => ({ ...prev, [analysisId]: data }));
        }
      } catch (error) {
        console.error('Error fetching details:', error);
      }
    }
  };

  const downloadFile = async (analysisId: string, type: 'original' | 'results') => {
    try {
      const response = await fetch(`${apiUrl}/api/history/${analysisId}/download/${type}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${analysisId}_${type}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>{language === 'es' ? 'No hay análisis en el historial' : 'No analysis history'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((item) => {
        const isExpanded = expandedId === item.analysis_id;
        const details = detailsCache[item.analysis_id];

        return (
          <div key={item.analysis_id} className="border border-gray-800 rounded-lg overflow-hidden">
            {/* Row principal */}
            <div
              onClick={() => toggleExpand(item.analysis_id)}
              className="flex items-center gap-4 p-4 hover:bg-gray-800/40 cursor-pointer transition"
            >
              <div className="flex-shrink-0">
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1 grid grid-cols-6 gap-4 items-center text-sm">
                <div className="col-span-2">
                  <div className="font-medium text-white truncate">{item.file_name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString(language === 'es' ? 'es-MX' : 'en-US')}
                  </div>
                </div>

                <div className="text-center">
                  <div className="font-mono text-white">{item.total_transacciones}</div>
                  <div className="text-xs text-gray-500">{language === 'es' ? 'transacciones' : 'transactions'}</div>
                </div>

                <div className="text-center">
                  <div className="font-bold text-green-400">${item.costo.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">USD</div>
                </div>

                <div className="text-center">
                  <div className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 inline-block">
                    {item.pagado ? (language === 'es' ? 'Pagado' : 'Paid') : (language === 'es' ? 'Pendiente' : 'Pending')}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
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

            {/* Panel expandido */}
            {isExpanded && (
              <div className="border-t border-gray-800 bg-gray-900/50 p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Información general */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">
                      {language === 'es' ? 'Información General' : 'General Information'}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{language === 'es' ? 'ID de Análisis' : 'Analysis ID'}:</span>
                        <span className="font-mono text-xs text-gray-300">{item.analysis_id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{language === 'es' ? 'Estrategia' : 'Strategy'}:</span>
                        <span className="text-white capitalize">{item.resumen?.estrategia || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{language === 'es' ? 'Total Transacciones' : 'Total Transactions'}:</span>
                        <span className="text-white font-semibold">{item.total_transacciones}</span>
                      </div>
                    </div>
                  </div>

                  {/* Distribución de riesgo */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-400 mb-3">
                      {language === 'es' ? 'Distribución de Riesgo' : 'Risk Distribution'}
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-400">{language === 'es' ? 'Preocupante' : 'High Risk'}:</span>
                        <span className="font-semibold text-red-400">
                          {item.resumen?.preocupante || 0} ({((item.resumen?.preocupante || 0) / item.total_transacciones * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-yellow-400">{language === 'es' ? 'Inusual' : 'Unusual'}:</span>
                        <span className="font-semibold text-yellow-400">
                          {item.resumen?.inusual || 0} ({((item.resumen?.inusual || 0) / item.total_transacciones * 100).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-400">{language === 'es' ? 'Relevante' : 'Relevant'}:</span>
                        <span className="font-semibold text-green-400">
                          {item.resumen?.relevante || 0} ({((item.resumen?.relevante || 0) / item.total_transacciones * 100).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Botones de descarga */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3">
                    {language === 'es' ? 'Archivos' : 'Files'}
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => downloadFile(item.analysis_id, 'original')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm transition"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {language === 'es' ? 'CSV Original' : 'Original CSV'}
                    </button>

                    <button
                      onClick={() => downloadFile(item.analysis_id, 'results')}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm transition"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {language === 'es' ? 'CSV Analizado' : 'Analyzed CSV'}
                    </button>

                    {item.xml_path && (
                      <button
                        onClick={() => window.open(`${apiUrl}/api/xml/${item.analysis_id}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-sm transition"
                      >
                        <File className="w-4 h-4" />
                        {language === 'es' ? 'XML UIF' : 'XML UIF'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
