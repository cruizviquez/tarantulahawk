// components/monitoring/MonitoringModule.tsx
import React, { useState } from 'react';
import { 
  Activity, Upload, FileSpreadsheet, TrendingUp, AlertTriangle, 
  User, DollarSign, Calendar, BarChart3, Download, Filter
} from 'lucide-react';
import { formatDateES } from '../../lib/dateFormatter';

interface Cliente {
  cliente_id: string;
  nombre_completo: string;
  rfc: string;
  nivel_riesgo: string;
  // Histórico acumulado (features ML)
  total_operaciones_historicas: number;
  monto_total_historico: number;
  monto_promedio_operacion: number;
  operaciones_ultimos_6m: number;
  monto_ultimos_6m: number;
  fecha_primera_operacion: string;
  fecha_ultima_operacion: string;
  perfil_transaccional: {
    num_ops_mes_esperado: number;
    monto_mensual_esperado: number;
    desviacion_estandar: number;
  };
}

interface OperacionCargada {
  folio: string;
  fecha: string;
  cliente_id: string;
  cliente_nombre: string;
  monto_mxn: number;
  monto_usd: number;
  tipo_operacion: string;
  // Análisis automático
  clasificacion?: string;
  nivel_riesgo?: string;
  alertas?: string[];
  supera_perfil?: boolean;
  desviacion_perfil?: number;
}

const MonitoringModule = () => {
  const [vista, setVista] = useState<'cargar' | 'operaciones' | 'cliente_historico'>('cargar');
  const [file, setFile] = useState<File | null>(null);
  const [operacionesCargadas, setOperacionesCargadas] = useState<OperacionCargada[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);

  // Mock data - cliente con histórico
  const clienteMock: Cliente = {
    cliente_id: 'cli-1',
    nombre_completo: 'Juan Pérez García',
    rfc: 'PEGJ850515XY1',
    nivel_riesgo: 'alto',
    total_operaciones_historicas: 47,
    monto_total_historico: 2340000,
    monto_promedio_operacion: 49787,
    operaciones_ultimos_6m: 12,
    monto_ultimos_6m: 650000,
    fecha_primera_operacion: '2023-03-15',
    fecha_ultima_operacion: '2025-01-20',
    perfil_transaccional: {
      num_ops_mes_esperado: 2,
      monto_mensual_esperado: 108000,
      desviacion_estandar: 25000
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setProcesando(true);

    // Simular procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock operaciones procesadas con análisis automático
    const mockOps: OperacionCargada[] = [
      {
        folio: 'OP-2025-045',
        fecha: '2025-01-15',
        cliente_id: 'cli-1',
        cliente_nombre: 'Juan Pérez García',
        monto_mxn: 520000,
        monto_usd: 26500,
        tipo_operacion: 'Venta joyería',
        clasificacion: 'relevante',
        nivel_riesgo: 'medio',
        alertas: ['Supera umbral $17,500 USD'],
        supera_perfil: true,
        desviacion_perfil: 2.45
      },
      {
        folio: 'OP-2025-046',
        fecha: '2025-01-15',
        cliente_id: 'cli-2',
        cliente_nombre: 'María González López',
        monto_mxn: 85000,
        monto_usd: 4335,
        tipo_operacion: 'Compra reloj',
        clasificacion: 'relevante',
        nivel_riesgo: 'bajo',
        alertas: [],
        supera_perfil: false,
        desviacion_perfil: 0.3
      },
      {
        folio: 'OP-2025-047',
        fecha: '2025-01-20',
        cliente_id: 'cli-1',
        cliente_nombre: 'Juan Pérez García',
        monto_mxn: 450000,
        monto_usd: 22950,
        tipo_operacion: 'Venta diamantes',
        clasificacion: 'preocupante',
        nivel_riesgo: 'alto',
        alertas: [
          'Supera umbral $17,500 USD',
          '2da operación relevante en 7 días',
          'Cliente clasificado riesgo ALTO',
          'Desviación 2.1σ del perfil transaccional'
        ],
        supera_perfil: true,
        desviacion_perfil: 2.1
      }
    ];

    setOperacionesCargadas(mockOps);
    setProcesando(false);
    setVista('operaciones');
  };

  const getTotalMonto = () => {
    return operacionesCargadas.reduce((sum, op) => sum + op.monto_usd, 0);
  };

  const getNumPreocupantes = () => {
    return operacionesCargadas.filter(op => op.clasificacion === 'preocupante').length;
  };

  const getNumRelevantes = () => {
    return operacionesCargadas.filter(op => op.clasificacion === 'relevante').length;
  };

  // ==================== VISTA: CARGAR BATCH ====================
  if (vista === 'cargar') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-emerald-400" />
            Monitoreo Transaccional
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Carga batch de operaciones para análisis PLD automático
          </p>
        </div>

        {/* Caja de carga */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <Upload className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Cargar Operaciones del Periodo
              </h3>
              <p className="text-gray-400 text-sm">
                Sube un CSV o Excel con las operaciones realizadas en el periodo (día, semana o mes)
              </p>
            </div>

            {/* Área de drop */}
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-emerald-500/50 transition-all mb-6">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="batch-upload"
                disabled={procesando}
              />
              <label
                htmlFor="batch-upload"
                className={`cursor-pointer flex flex-col items-center gap-3 ${
                  procesando ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <FileSpreadsheet className="w-12 h-12 text-gray-400" />
                <div>
                  <p className="text-white font-medium mb-1">
                    {file ? file.name : 'Selecciona un archivo CSV o Excel'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    Formatos: .csv, .xlsx | Máx 50MB
                  </p>
                </div>
                {procesando && (
                  <div className="text-blue-400 text-sm">
                    Procesando y analizando operaciones...
                  </div>
                )}
              </label>
            </div>

            {/* Columnas requeridas */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-6">
              <h4 className="text-blue-400 font-medium mb-3 text-sm">
                📋 Columnas Requeridas en el Archivo
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[
                  'folio_interno',
                  'fecha_operacion',
                  'cliente_id',
                  'monto',
                  'tipo_operacion',
                  'descripcion'
                ].map(col => (
                  <div key={col} className="flex items-center gap-1">
                    <span className="text-emerald-400">✓</span>
                    <span className="text-gray-300">{col}</span>
                  </div>
                ))}
              </div>
              <p className="text-gray-400 text-xs mt-3">
                💡 <strong>Importante:</strong> El cliente_id debe corresponder a un cliente 
                existente en el módulo KYC para comparar vs su perfil transaccional histórico.
              </p>
            </div>

            {/* Información del proceso */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
              <h4 className="text-emerald-400 font-medium mb-2 text-sm">
                🤖 Análisis Automático Incluye:
              </h4>
              <ul className="space-y-1 text-xs text-gray-300">
                <li>• Comparación vs perfil transaccional histórico del cliente</li>
                <li>• Detección de operaciones ≥ $17,500 USD (relevantes)</li>
                <li>• Identificación de desviaciones σ del comportamiento normal</li>
                <li>• Acumulación de operaciones 6 meses (Art. 17 LFPIORPI)</li>
                <li>• Clasificación ML (3 modelos: supervisado, no supervisado, refuerzo)</li>
                <li>• Generación automática de alertas según nivel de riesgo</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Historial rápido */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">📊 Cargas Recientes</h3>
          <div className="space-y-2">
            <div className="bg-gray-900/50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">operaciones_semana_3_enero.csv</p>
                <p className="text-gray-400 text-xs">15/01/2025 • 24 operaciones • $156,400 USD</p>
              </div>
              <button className="text-blue-400 hover:text-blue-300 text-sm">Ver resultados →</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VISTA: OPERACIONES ANALIZADAS ====================
  if (vista === 'operaciones') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => setVista('cargar')}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 mb-2"
            >
              ← Volver
            </button>
            <h2 className="text-2xl font-bold text-white">
              Análisis Completado
            </h2>
            <p className="text-gray-400 text-sm">
              {operacionesCargadas.length} operaciones procesadas y analizadas
            </p>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all">
            <Download className="w-4 h-4" />
            Exportar CSV Enriquecido
          </button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Operaciones</span>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400">{operacionesCargadas.length}</p>
          </div>

          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Monto Total</span>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400">
              ${getTotalMonto().toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">USD</p>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Relevantes</span>
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-400">{getNumRelevantes()}</p>
            <p className="text-xs text-gray-500">≥ $17,500 USD</p>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Preocupantes</span>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-400">{getNumPreocupantes()}</p>
            <p className="text-xs text-gray-500">Requieren revisión</p>
          </div>
        </div>

        {/* Tabla de operaciones */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Folio</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Fecha</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tipo</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Monto USD</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Clasificación</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Alertas</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Perfil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {operacionesCargadas.map((op) => (
                  <tr key={op.folio} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-300">{op.folio}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">
                        {formatDateES(op.fecha)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setClienteSeleccionado(clienteMock);
                          setVista('cliente_historico');
                        }}
                        className="text-white text-sm hover:text-emerald-400 transition-colors"
                      >
                        {op.cliente_nombre}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">{op.tipo_operacion}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-semibold">
                        ${op.monto_usd.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          op.clasificacion === 'preocupante'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : op.clasificacion === 'inusual'
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              : 'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}>
                          {op.clasificacion?.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {op.alertas && op.alertas.length > 0 ? (
                          <div className="group relative">
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs cursor-help">
                              <AlertTriangle className="w-3 h-3" />
                              {op.alertas.length}
                            </span>
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-10 w-64">
                              <div className="bg-gray-900 border border-red-500/30 rounded-lg p-3 text-xs text-left">
                                <ul className="space-y-1">
                                  {op.alertas.map((alerta, idx) => (
                                    <li key={idx} className="text-red-300">• {alerta}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        {op.supera_perfil ? (
                          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
                            {op.desviacion_perfil?.toFixed(1)}σ
                          </span>
                        ) : (
                          <span className="text-green-400 text-xs">Normal</span>
                        )}
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
  }

  // ==================== VISTA: HISTÓRICO DEL CLIENTE ====================
  if (vista === 'cliente_historico' && clienteSeleccionado) {
    return (
      <div className="space-y-6">
        <div>
          <button
            onClick={() => setVista('operaciones')}
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2 mb-2"
          >
            ← Volver a operaciones
          </button>
          <h2 className="text-2xl font-bold text-white">
            Histórico Transaccional del Cliente
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {clienteSeleccionado.nombre_completo} • RFC: {clienteSeleccionado.rfc}
          </p>
        </div>

        {/* Resumen del perfil */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Operaciones Históricas</span>
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {clienteSeleccionado.total_operaciones_historicas}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Desde {formatDateES(clienteSeleccionado.fecha_primera_operacion)}
            </p>
          </div>

          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Monto Total Histórico</span>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-400">
              ${clienteSeleccionado.monto_total_historico.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Promedio: ${clienteSeleccionado.monto_promedio_operacion.toLocaleString()}/op
            </p>
          </div>

          <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Últimos 6 Meses</span>
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-purple-400">
              {clienteSeleccionado.operaciones_ultimos_6m}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ${clienteSeleccionado.monto_ultimos_6m.toLocaleString()} MXN
            </p>
          </div>
        </div>

        {/* Perfil transaccional */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            Perfil Transaccional Esperado
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Operaciones/mes esperadas</p>
              <p className="text-2xl font-bold text-white">
                {clienteSeleccionado.perfil_transaccional.num_ops_mes_esperado}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Monto mensual esperado</p>
              <p className="text-2xl font-bold text-white">
                ${clienteSeleccionado.perfil_transaccional.monto_mensual_esperado.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Desviación estándar</p>
              <p className="text-2xl font-bold text-white">
                ±${clienteSeleccionado.perfil_transaccional.desviacion_estandar.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              💡 <strong>Cómo se usa:</strong> Cuando se carga una nueva operación de este cliente, 
              el sistema compara automáticamente el monto y frecuencia vs este perfil histórico. 
              Si hay desviación {'>'} 2σ, genera alerta automática.
            </p>
          </div>
        </div>

        {/* Gráfica de tendencia (placeholder) */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4">📈 Tendencia de Operaciones (6 meses)</h3>
          <div className="h-64 bg-gray-900/50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">
              [Gráfica de línea mostrando evolución mensual de operaciones y montos]
            </p>
          </div>
        </div>

        {/* Tabla de últimas operaciones */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-white font-semibold">Últimas 10 Operaciones</h3>
          </div>
          <div className="p-6 text-center text-gray-500">
            <p>[Tabla con histórico de las últimas operaciones del cliente]</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MonitoringModule;