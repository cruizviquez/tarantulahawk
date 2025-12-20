'use client';

import React from 'react';
import { Brain, Database, Shield, TrendingUp, CheckCircle, Loader } from 'lucide-react';

interface MLProgressTrackerProps {
  stage: string;
  progress: number;
  language?: 'es' | 'en';
  fileName?: string;
  onFileClick?: () => void;

  variant?: 'full' | 'compact';
  showTimeline?: boolean;
  showTechDetails?: boolean;
  reserveHeight?: boolean;
}

const stages = {
  idle: {
    icon: Database,
    label: { es: 'Listo para cargar archivo', en: 'Ready to load file' },
    color: 'text-gray-300',
    bgColor: 'bg-gray-900/20',
    borderColor: 'border-gray-800/40',
  },
  uploading: {
    icon: Database,
    label: { es: 'Cargando Archivo', en: 'Uploading File' },
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-800/30',
  },
  validating: {
    icon: Shield,
    label: { es: 'Validando Datos', en: 'Validating Data' },
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/20',
    borderColor: 'border-purple-800/30',
  },
  ml_supervised: {
    icon: Brain,
    label: { es: 'Etiquetando Operaciones', en: 'Labeling Transactions' },
    sublabel: { es: '(Modelo Supervisado)', en: '(Supervised Model)' },
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-900/20',
    borderColor: 'border-cyan-800/30',
  },
  ml_unsupervised: {
    icon: TrendingUp,
    label: { es: 'Detectando Anomalías', en: 'Detecting Anomalies' },
    sublabel: { es: '(Modelo No Supervisado)', en: '(Unsupervised Model)' },
    color: 'text-emerald-400',
    bgColor: 'bg-teal-900/20',
    borderColor: 'border-teal-800/30',
  },
  ml_reinforcement: {
    icon: Brain,
    label: { es: 'Ajustando Parámetros', en: 'Adjusting Parameters' },
    sublabel: { es: '(Aprendizaje por Refuerzo)', en: '(Reinforcement Learning)' },
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-800/30',
  },
  generating_report: {
    icon: Database,
    label: { es: 'Generando Reporte', en: 'Generating Report' },
    color: 'text-green-400',
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-800/30',
  },
  complete: {
    icon: CheckCircle,
    label: { es: 'Completado', en: 'Complete' },
    color: 'text-green-400',
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-800/30',
  },
} as const;

export default function MLProgressTracker({
  stage,
  progress,
  language = 'es',
  fileName,
  onFileClick,
  variant = 'full',
  showTimeline,
  showTechDetails,
  reserveHeight = true,
}: MLProgressTrackerProps) {
  const normalizedStage = stage && stage.trim() !== '' ? stage : 'idle';
  const currentStage = stages[normalizedStage as keyof typeof stages] ?? stages.idle;

  const Icon = currentStage.icon;
  const isComplete = normalizedStage === 'complete';
  const isIdle = normalizedStage === 'idle';

  const effectiveShowTimeline = showTimeline ?? (variant === 'full');
  const effectiveShowTechDetails = showTechDetails ?? (variant === 'full');

  // ✅ Ajuste: idle no necesita 168px
  const minHeightClass =
    !reserveHeight
      ? ''
      : variant === 'compact'
        ? 'min-h-[72px]'
        : isIdle
          ? 'min-h-[120px]'
          : 'min-h-[168px]';

  const clickable =
    ((normalizedStage === 'uploading' || isIdle) && !!onFileClick) ? 'cursor-pointer hover:opacity-90 transition-opacity' : '';

  return (
    <div
      className={[
        currentStage.bgColor,
        'border',
        currentStage.borderColor,
        'rounded-xl',
        'px-4',
        variant === 'compact' ? 'py-3' : 'py-4',
        minHeightClass,
        clickable,
      ].join(' ')}
      onClick={((normalizedStage === 'uploading' || isIdle) && onFileClick) ? onFileClick : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-black/40 rounded-xl">
          {isComplete || isIdle ? (
            <Icon className={`w-6 h-6 ${currentStage.color}`} />
          ) : (
            <Loader className={`w-6 h-6 ${currentStage.color} animate-spin`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm md:text-base font-bold ${currentStage.color} leading-tight`}>
            {currentStage.label[language]}
          </div>

          {'sublabel' in currentStage && variant === 'full' && (
            <div className="text-xs text-gray-400">{currentStage.sublabel[language]}</div>
          )}

          {fileName && variant !== 'compact' && (
            <div className="text-xs md:text-sm text-gray-500 truncate">{fileName}</div>
          )}
        </div>

        <div className="text-lg md:text-xl font-bold text-white tabular-nums">
          {isIdle ? '' : `${Math.min(100, Math.max(0, progress))}%`}
        </div>
      </div>

      <div className={variant === 'compact' ? 'mt-2' : 'mt-3'}>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className={[
              'h-full transition-all duration-500',
              isIdle ? 'bg-gray-700' : 'bg-gradient-to-r',
              !isIdle && normalizedStage === 'ml_supervised' ? 'from-cyan-600 to-cyan-400' : '',
              !isIdle && normalizedStage === 'ml_unsupervised' ? 'from-teal-600 to-teal-400' : '',
              !isIdle && normalizedStage === 'ml_reinforcement' ? 'from-blue-600 to-blue-400' : '',
              !isIdle && !['ml_supervised', 'ml_unsupervised', 'ml_reinforcement'].includes(normalizedStage) ? 'from-blue-600 to-blue-400' : '',
            ].join(' ')}
            style={{ width: `${isIdle ? 0 : Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      {effectiveShowTimeline && variant === 'full' && (
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-1 text-xs">
            {Object.entries(stages)
              .filter(([key]) => key !== 'idle')
              .map(([key, stageInfo], index, arr) => {
                const StageIcon = stageInfo.icon;
                const stageKeys = arr.map(([k]) => k);
                const currentIndex = stageKeys.indexOf(normalizedStage as any);
                const isCurrentStage = key === normalizedStage;
                const isPastStage = currentIndex >= 0 ? index < currentIndex : false;

                return (
                  <div
                    key={key}
                    className={[
                      'flex flex-col items-center gap-1 p-1 rounded-lg transition-all border',
                      isCurrentStage
                        ? `${(stageInfo as any).bgColor} ${(stageInfo as any).borderColor} border-2`
                        : isPastStage
                          ? 'bg-green-900/20 border-green-800/30'
                          : 'bg-gray-900/50 border-gray-800',
                    ].join(' ')}
                  >
                    <StageIcon
                      className={[
                        'w-3 h-3',
                        isCurrentStage ? (stageInfo as any).color : isPastStage ? 'text-green-400' : 'text-gray-600',
                      ].join(' ')}
                    />
                    <div
                      className={[
                        'text-center leading-tight',
                        isCurrentStage ? 'text-white font-semibold' : isPastStage ? 'text-gray-400' : 'text-gray-600',
                      ].join(' ')}
                    >
                      {(stageInfo as any).label[language].split(' ')[0]}
                    </div>
                    {isPastStage && <CheckCircle className="w-2 h-2 text-green-400" />}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {effectiveShowTechDetails &&
        variant === 'full' &&
        (normalizedStage === 'ml_supervised' || normalizedStage === 'ml_unsupervised' || normalizedStage === 'ml_reinforcement') &&
        !isComplete && (
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-500 mb-1">{language === 'es' ? 'Algoritmo' : 'Algorithm'}</div>
                <div className="font-mono text-emerald-400">
                  {normalizedStage === 'ml_supervised'
                    ? 'XGBoost + RF'
                    : normalizedStage === 'ml_unsupervised'
                      ? 'DBSCAN + Isolation Forest'
                      : 'PPO + Dynamic Thresholds'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">{language === 'es' ? 'Features' : 'Features'}</div>
                <div className="font-mono text-cyan-400">
                  {normalizedStage === 'ml_supervised' ? '27 variables' : normalizedStage === 'ml_unsupervised' ? '15 clusters' : '8 thresholds'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1">{language === 'es' ? 'Precisión' : 'Accuracy'}</div>
                <div className="font-mono text-green-400">
                  {normalizedStage === 'ml_supervised' ? '94.2%' : normalizedStage === 'ml_unsupervised' ? '89.7%' : '96.1%'}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
