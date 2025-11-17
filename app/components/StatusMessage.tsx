'use client';
// components/StatusMessage.tsx
/**
 * Centro de Mensajes - Sistema de notificaciones in-app
 * Reemplaza los alerts nativos del browser con UI consistente
 */

import React from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface StatusMessageProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onClose?: () => void;
  autoClose?: boolean;
  duration?: number;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ 
  type, 
  message, 
  onClose,
  autoClose = true,
  duration = 5000 
}) => {
  
  // Auto-close después de duration
  React.useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  // Configuración por tipo
  const config = {
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      icon: CheckCircle,
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: AlertCircle,
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: Info,
    },
  };

  const { bg, border, text, icon: Icon } = config[type];

  return (
    <div 
      className={`${bg} ${border} border rounded-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300`}
      role="alert"
    >
      <Icon className={`w-5 h-5 ${text} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        <p className="text-gray-300 text-sm leading-relaxed">
          {message}
        </p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          aria-label="Cerrar mensaje"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default StatusMessage;