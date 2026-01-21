import React from 'react';
import { Loader, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface GlobalStatusBarProps {
  isProcessing: boolean;
  progress: number;
  processingStage: string;
  onViewDetails?: () => void;
  statusMessage?: {
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
  } | null;
}

const GlobalStatusBar: React.FC<GlobalStatusBarProps> = ({
  isProcessing,
  progress,
  processingStage,
  onViewDetails,
  statusMessage
}) => {
  // Si no hay processing ni mensaje, no mostrar nada
  if (!isProcessing && !statusMessage) return null;

  const getIcon = () => {
    if (isProcessing) return <Loader className="w-4 h-4 animate-spin" />;
    if (!statusMessage) return null;
    
    switch (statusMessage.type) {
      case 'success': return <CheckCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getBgColor = () => {
    if (isProcessing) return 'bg-blue-500/10 border-blue-500/30';
    if (!statusMessage) return 'bg-gray-800/40 border-gray-700';
    
    switch (statusMessage.type) {
      case 'success': return 'bg-emerald-500/10 border-emerald-500/30';
      case 'error': return 'bg-red-500/10 border-red-500/30';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/30';
      default: return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  const getTextColor = () => {
    if (isProcessing) return 'text-blue-300';
    if (!statusMessage) return 'text-gray-300';
    
    switch (statusMessage.type) {
      case 'success': return 'text-emerald-300';
      case 'error': return 'text-red-300';
      case 'warning': return 'text-yellow-300';
      default: return 'text-blue-300';
    }
  };

  const getStageLabel = (stage: string) => {
    const stages: Record<string, string> = {
      uploading: 'Subiendo archivo',
      validating: 'Validando datos',
      ml_supervised: 'Modelo supervisado',
      ml_unsupervised: 'Detección de anomalías',
      ml_reinforcement: 'Aprendizaje por refuerzo',
      generating_report: 'Generando reporte',
      complete: 'Completado'
    };
    return stages[stage] || stage;
  };

  return (
    <div className={`border-b ${getBgColor()} sticky top-16 z-40`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={getTextColor()}>
              {getIcon()}
            </div>
            
            <div className="flex-1 min-w-0">
              {isProcessing ? (
                <>
                  <div className={`text-sm font-medium ${getTextColor()}`}>
                    Análisis ML en progreso: {Math.min(100, Math.max(0, progress))}%
                  </div>
                  <div className="text-xs text-gray-400">
                    {getStageLabel(processingStage)}
                  </div>
                </>
              ) : statusMessage ? (
                <div className={`text-sm ${getTextColor()}`}>
                  {statusMessage.message}
                </div>
              ) : null}
            </div>

            {isProcessing && (
              <div className="hidden sm:block w-32">
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {isProcessing && onViewDetails && (
            <button
              onClick={onViewDetails}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline whitespace-nowrap"
            >
              Ver detalle →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalStatusBar;