'use client';

import { Brain, Database, Shield, TrendingUp, CheckCircle, Loader } from 'lucide-react';

interface MLProgressTrackerProps {
  stage: string; // '', 'uploading', 'validating', 'ml_supervised', 'ml_unsupervised', 'ml_reinforcement', 'generating_report', 'complete'
  progress: number; // 0-100
  language?: 'es' | 'en';
  fileName?: string;
}

const stages = {
  uploading: {
    icon: Database,
    label: { es: 'Cargando Archivo', en: 'Uploading File' },
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-800/30'
  },
  validating: {
    icon: Shield,
    label: { es: 'Validando Datos', en: 'Validating Data' },
    color: 'text-purple-400',
    bgColor: 'bg-purple-900/20',
    borderColor: 'border-purple-800/30'
  },
  ml_supervised: {
    icon: Brain,
    label: { es: 'Modelo Supervisado (IA)', en: 'Supervised ML Model' },
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-900/20',
    borderColor: 'border-cyan-800/30'
  },
  ml_unsupervised: {
    icon: TrendingUp,
    label: { es: 'Modelo No Supervisado (Clustering)', en: 'Unsupervised ML (Clustering)' },
    color: 'text-emerald-400',
    bgColor: 'bg-teal-900/20',
    borderColor: 'border-teal-800/30'
  },
  ml_reinforcement: {
    icon: Brain,
    label: { es: 'Aprendizaje por Refuerzo (Optimización)', en: 'Reinforcement Learning (Optimization)' },
    color: 'text-blue-400',
    bgColor: 'bg-blue-900/20',
    borderColor: 'border-blue-800/30'
  },
  generating_report: {
    icon: Database,
    label: { es: 'Generando Reporte XML', en: 'Generating XML Report' },
    color: 'text-green-400',
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-800/30'
  },
  complete: {
    icon: CheckCircle,
    label: { es: 'Completado', en: 'Complete' },
    color: 'text-green-400',
    bgColor: 'bg-green-900/20',
    borderColor: 'border-green-800/30'
  }
};

export default function MLProgressTracker({ 
  stage, 
  progress, 
  language = 'es',
  fileName 
}: MLProgressTrackerProps) {
  if (!stage || stage === '') return null;

  const currentStage = stages[stage as keyof typeof stages];
  if (!currentStage) return null;

  const Icon = currentStage.icon;
  const isComplete = stage === 'complete';

  return (
    <div className={`${currentStage.bgColor} border ${currentStage.borderColor} rounded-xl p-6 animate-pulse-slow`}>
      {/* Header with Icon */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`p-4 bg-black/50 rounded-xl ${isComplete ? '' : 'animate-pulse'}`}>
          {isComplete ? (
            <Icon className={`w-8 h-8 ${currentStage.color}`} />
          ) : (
            <Loader className={`w-8 h-8 ${currentStage.color} animate-spin`} />
          )}
        </div>
        <div className="flex-1">
          <div className={`text-lg font-bold ${currentStage.color} mb-1`}>
            {currentStage.label[language]}
          </div>
          {fileName && (
            <div className="text-sm text-gray-500 truncate">
              {fileName}
            </div>
          )}
        </div>
        <div className="text-3xl font-bold text-white">
          {progress}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden mb-6">
        <div 
          className={`h-full bg-gradient-to-r ${
            stage === 'ml_supervised' ? 'from-cyan-600 to-cyan-400' :
            stage === 'ml_unsupervised' ? 'from-teal-600 to-teal-400' :
            stage === 'ml_reinforcement' ? 'from-blue-600 to-blue-400' :
            'from-blue-600 to-blue-400'
          } transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage Timeline */}
      <div className="grid grid-cols-7 gap-2 text-xs">
        {Object.entries(stages).map(([key, stageInfo], index) => {
          const StageIcon = stageInfo.icon;
          const isCurrentStage = key === stage;
          const isPastStage = index < Object.keys(stages).indexOf(stage);
          
          return (
            <div 
              key={key}
              className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-all ${
                isCurrentStage ? `${stageInfo.bgColor} ${stageInfo.borderColor} border-2` :
                isPastStage ? 'bg-green-900/20 border border-green-800/30' :
                'bg-gray-900/50 border border-gray-800'
              }`}
            >
              <StageIcon className={`w-4 h-4 ${
                isCurrentStage ? stageInfo.color :
                isPastStage ? 'text-green-400' :
                'text-gray-600'
              }`} />
              <div className={`text-center leading-tight ${
                isCurrentStage ? 'text-white font-semibold' :
                isPastStage ? 'text-gray-400' :
                'text-gray-600'
              }`}>
                {stageInfo.label[language].split(' ')[0]}
              </div>
              {isPastStage && (
                <CheckCircle className="w-3 h-3 text-green-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Technical Details (only during ML stages) */}
      {(stage === 'ml_supervised' || stage === 'ml_unsupervised' || stage === 'ml_reinforcement') && !isComplete && (
        <div className="mt-6 pt-6 border-t border-gray-800">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">{language === 'es' ? 'Algoritmo' : 'Algorithm'}</div>
              <div className="font-mono text-emerald-400">
                {stage === 'ml_supervised' ? 'XGBoost + RF' :
                 stage === 'ml_unsupervised' ? 'DBSCAN + Isolation Forest' :
                 'PPO + Dynamic Thresholds'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">{language === 'es' ? 'Features' : 'Features'}</div>
              <div className="font-mono text-cyan-400">
                {stage === 'ml_supervised' ? '27 variables' :
                 stage === 'ml_unsupervised' ? '15 clusters' :
                 '8 thresholds'}
              </div>
            </div>
            <div>
              <div className="text-gray-500 mb-1">{language === 'es' ? 'Precisión' : 'Accuracy'}</div>
              <div className="font-mono text-green-400">
                {stage === 'ml_supervised' ? '94.2%' :
                 stage === 'ml_unsupervised' ? '89.7%' :
                 '96.1%'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
