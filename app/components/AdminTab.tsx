import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Settings,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Upload,
  Trash2
} from 'lucide-react';
import AdminDashboard from './AdminDashboard';

interface AdminTabProps {
  userRole: string;
  onSystemCheck: () => Promise<any>;
  onExportData: () => void;
  onImportData: () => void;
  onClearCache: () => void;
}

export const AdminTab: React.FC<AdminTabProps> = ({
  userRole,
  onSystemCheck,
  onExportData,
  onImportData,
  onClearCache
}) => {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Check system status on mount
  useEffect(() => {
    handleSystemCheck();
  }, []);

  const handleSystemCheck = async () => {
    setIsChecking(true);
    try {
      const status = await onSystemCheck();
      setSystemStatus(status);
    } catch (error) {
      console.error('Error checking system status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acceso Restringido</h3>
            <p className="text-gray-400">
              No tienes permisos para acceder a esta sección.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-800">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              activeTab === 'dashboard'
                ? 'bg-teal-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              activeTab === 'system'
                ? 'bg-teal-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Sistema
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              activeTab === 'users'
                ? 'bg-teal-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              activeTab === 'maintenance'
                ? 'bg-teal-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Mantenimiento
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <AdminDashboard />
      )}

      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* System Status */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Estado del Sistema</h3>
              <button
                onClick={handleSystemCheck}
                disabled={isChecking}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                Verificar
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <Database className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Base de Datos</p>
                    <p className="text-xs text-gray-400">
                      {systemStatus?.database ? 'Conectado' : 'Desconectado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Activity className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">API Backend</p>
                    <p className="text-xs text-gray-400">
                      {systemStatus?.api ? 'Operativo' : 'Fuera de línea'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">Seguridad</p>
                    <p className="text-xs text-gray-400">
                      {systemStatus?.security ? 'Activa' : 'Inactiva'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Metrics */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Métricas del Sistema</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium mb-3">Uso de Recursos</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>CPU</span>
                      <span>{systemStatus?.cpu || 'N/A'}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full"
                        style={{ width: `${systemStatus?.cpu || 0}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-sm">
                      <span>Memoria</span>
                      <span>{systemStatus?.memory || 'N/A'}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-teal-600 h-2 rounded-full"
                        style={{ width: `${systemStatus?.memory || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3">Actividad Reciente</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Análisis hoy</span>
                      <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">{systemStatus?.todayAnalyses || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Usuarios activos</span>
                      <span className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs">{systemStatus?.activeUsers || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Alertas pendientes</span>
                      <span className="px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs">{systemStatus?.pendingAlerts || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-semibold">Gestión de Usuarios</h3>
          </div>
          <div className="p-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Funcionalidad Próxima</h3>
              <p className="text-gray-400">
                La gestión de usuarios estará disponible en la próxima versión.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Operaciones de Mantenimiento</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={onExportData}
                  className="h-20 flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition"
                >
                  <Download className="h-6 w-6 mb-2" />
                  Exportar Datos
                </button>

                <button
                  onClick={onImportData}
                  className="h-20 flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition"
                >
                  <Upload className="h-6 w-6 mb-2" />
                  Importar Datos
                </button>

                <button
                  onClick={onClearCache}
                  className="h-20 flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition"
                >
                  <Trash2 className="h-6 w-6 mb-2" />
                  Limpiar Cache
                </button>

                <button
                  onClick={handleSystemCheck}
                  disabled={isChecking}
                  className="h-20 flex flex-col items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-6 w-6 mb-2 ${isChecking ? 'animate-spin' : ''}`} />
                  Verificar Sistema
                </button>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl">
            <div className="p-6 border-b border-gray-800">
              <h3 className="text-lg font-semibold">Logs del Sistema</h3>
            </div>
            <div className="p-6">
              <div className="space-y-2 text-sm font-mono bg-gray-800 p-4 rounded-lg max-h-64 overflow-y-auto">
                {systemStatus?.logs?.map((log: string, index: number) => (
                  <div key={index} className="text-gray-400">
                    {log}
                  </div>
                )) || (
                  <div className="text-gray-400">
                    No hay logs disponibles
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};