// components/reportes-uif/UIFReportModule.tsx
import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Calendar, AlertTriangle, CheckCircle, 
  Send, Loader, Shield, Clock, DollarSign, Users
} from 'lucide-react';

interface OperacionRelevante {
  operacion_id: string;
  folio_interno: string;
  fecha_operacion: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_rfc: string;
  monto: number;
  monto_usd: number;
  tipo_operacion: string;
  clasificacion_pld: string;
  nivel_riesgo: string;
}

interface ReporteUIF {
  reporte_id: string;
  tipo_reporte: string;
  periodo_inicio: string;
  periodo_fin: string;
  num_operaciones: number;
  monto_total: number;
  estado: string;
  xml_file_path?: string;
  enviado_uif: boolean;
  fecha_envio?: string;
  numero_operacion_uif?: string;
}

const UIFReportModule = () => {
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());
  const [operacionesRelevantes, setOperacionesRelevantes] = useState<OperacionRelevante[]>([]);
  const [reportesHistoricos, setReportesHistoricos] = useState<ReporteUIF[]>([]);
  const [generando, setGenerando] = useState(false);
  const [tipoReporte, setTipoReporte] = useState<'mensual_relevantes' | 'aviso_24hrs' | 'informe_ausencia'>('mensual_relevantes');

  // Mock data - en producción vendría de la API
  useEffect(() => {
    // Simular carga de operaciones relevantes del mes
    const mockOperaciones: OperacionRelevante[] = [
      {
        operacion_id: '1',
        folio_interno: 'OP-2025-001',
        fecha_operacion: '2025-01-15',
        cliente_id: 'cli-1',
        cliente_nombre: 'Juan Pérez García',
        cliente_rfc: 'PEGJ850515XY1',
        monto: 520000,
        monto_usd: 26500,
        tipo_operacion: 'Venta de joyería',
        clasificacion_pld: 'relevante',
        nivel_riesgo: 'medio'
      },
      {
        operacion_id: '2',
        folio_interno: 'OP-2025-002',
        fecha_operacion: '2025-01-18',
        cliente_id: 'cli-2',
        cliente_nombre: 'María González López',
        cliente_rfc: 'GOLM901020ABC',
        monto: 380000,
        monto_usd: 19400,
        tipo_operacion: 'Compra de reloj',
        clasificacion_pld: 'relevante',
        nivel_riesgo: 'bajo'
      },
      {
        operacion_id: '3',
        folio_interno: 'OP-2025-003',
        fecha_operacion: '2025-01-20',
        cliente_id: 'cli-1',
        cliente_nombre: 'Juan Pérez García',
        cliente_rfc: 'PEGJ850515XY1',
        monto: 450000,
        monto_usd: 22950,
        tipo_operacion: 'Venta de diamantes',
        clasificacion_pld: 'preocupante',
        nivel_riesgo: 'alto'
      }
    ];
    setOperacionesRelevantes(mockOperaciones);

    // Mock reportes históricos
    const mockReportes: ReporteUIF[] = [
      {
        reporte_id: '1',
        tipo_reporte: 'mensual_relevantes',
        periodo_inicio: '2024-12-01',
        periodo_fin: '2024-12-31',
        num_operaciones: 8,
        monto_total: 156000,
        estado: 'enviado',
        enviado_uif: true,
        fecha_envio: '2025-01-05',
        numero_operacion_uif: 'UIF-2025-00123'
      }
    ];
    setReportesHistoricos(mockReportes);
  }, [selectedMes, selectedAnio]);

  const getNombreMes = (mes: number) => {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return meses[mes - 1];
  };

  const handleGenerarXML = async () => {
    setGenerando(true);
    
    try {
      // Simular generación de XML
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // En producción, aquí iría la llamada a la API
      const response = await fetch('/api/uif/generar-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_reporte: tipoReporte,
          periodo_inicio: `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-01`,
          periodo_fin: `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-31`,
          operaciones_ids: operacionesRelevantes.map(op => op.operacion_id)
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Descargar XML
        const blob = new Blob([data.xml_content], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `UIF_${tipoReporte}_${selectedAnio}_${String(selectedMes).padStart(2, '0')}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('✅ XML generado y descargado exitosamente');
      }
    } catch (error) {
      console.error('Error generando XML:', error);
      alert('❌ Error al generar XML: ' + error);
    } finally {
      setGenerando(false);
    }
  };

  const montoTotalRelevantes = operacionesRelevantes.reduce((sum, op) => sum + op.monto_usd, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-400" />
            Reportes UIF
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Generación de avisos mensuales y reportes para la Unidad de Inteligencia Financiera
          </p>
        </div>
      </div>

      {/* Estadísticas del periodo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Operaciones Relevantes</span>
            <DollarSign className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">{operacionesRelevantes.length}</p>
          <p className="text-xs text-gray-500 mt-1">≥ $17,500 USD</p>
        </div>

        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Monto Total</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-400">
            ${montoTotalRelevantes.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">USD</p>
        </div>

        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Clientes Únicos</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {new Set(operacionesRelevantes.map(op => op.cliente_id)).size}
          </p>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Preocupantes</span>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-400">
            {operacionesRelevantes.filter(op => op.clasificacion_pld === 'preocupante').length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Requieren aviso 24h</p>
        </div>
      </div>

      {/* Selector de periodo y tipo de reporte */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Generar Nuevo Reporte</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Tipo de Reporte</label>
            <select
              value={tipoReporte}
              onChange={(e) => setTipoReporte(e.target.value as any)}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="mensual_relevantes">Aviso Mensual - Operaciones Relevantes</option>
              <option value="aviso_24hrs">Aviso 24 horas - Preocupantes</option>
              <option value="informe_ausencia">Informe de Ausencia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Mes</label>
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(Number(e.target.value))}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                <option key={mes} value={mes}>{getNombreMes(mes)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Año</label>
            <select
              value={selectedAnio}
              onChange={(e) => setSelectedAnio(Number(e.target.value))}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            >
              {[2025, 2024, 2023].map(anio => (
                <option key={anio} value={anio}>{anio}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumen del reporte a generar */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-white font-medium mb-2">
                {tipoReporte === 'mensual_relevantes' && 'Aviso Mensual de Operaciones Relevantes'}
                {tipoReporte === 'aviso_24hrs' && 'Aviso de Operaciones Preocupantes (24 horas)'}
                {tipoReporte === 'informe_ausencia' && 'Informe de Ausencia de Operaciones'}
              </h4>
              <p className="text-sm text-gray-300 mb-3">
                Periodo: {getNombreMes(selectedMes)} {selectedAnio}
              </p>
              
              {tipoReporte === 'mensual_relevantes' && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Operaciones a incluir:</span>
                    <span className="text-white font-medium">{operacionesRelevantes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Monto total:</span>
                    <span className="text-white font-medium">${montoTotalRelevantes.toLocaleString()} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fundamento legal:</span>
                    <span className="text-white font-medium">Art. 17 LFPIORPI</span>
                  </div>
                </div>
              )}

              {tipoReporte === 'aviso_24hrs' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mt-2">
                  <p className="text-red-300 text-sm">
                    ⚠️ Las operaciones preocupantes deben reportarse dentro de las 24 horas siguientes 
                    a su detección. Verifica que todas las operaciones incluidas sean recientes.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerarXML}
            disabled={generando || operacionesRelevantes.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generando ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generando XML...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Generar XML UIF
              </>
            )}
          </button>

          <button
            className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all"
          >
            Vista Previa
          </button>
        </div>

        {operacionesRelevantes.length === 0 && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-300 text-sm">
              ℹ️ No hay operaciones relevantes en el periodo seleccionado. 
              {tipoReporte === 'mensual_relevantes' && ' Considera generar un Informe de Ausencia si es obligatorio para tu actividad.'}
            </p>
          </div>
        )}
      </div>

      {/* Tabla de operaciones a incluir */}
      {operacionesRelevantes.length > 0 && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">
              Operaciones a Incluir en el Reporte
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Folio</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Fecha</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">RFC</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Operación</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Monto USD</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Clasificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {operacionesRelevantes.map((op) => (
                  <tr key={op.operacion_id} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-300">{op.folio_interno}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">
                        {new Date(op.fecha_operacion).toLocaleDateString('es-MX')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white text-sm">{op.cliente_nombre}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">{op.cliente_rfc}</span>
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
                          op.clasificacion_pld === 'preocupante'
                            ? 'bg-red-500/20 text-red-400'
                            : op.clasificacion_pld === 'inusual'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-green-500/20 text-green-400'
                        }`}>
                          {op.clasificacion_pld.toUpperCase()}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historial de reportes enviados */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Historial de Reportes
          </h3>
        </div>

        <div className="p-6">
          {reportesHistoricos.length > 0 ? (
            <div className="space-y-3">
              {reportesHistoricos.map((reporte) => (
                <div
                  key={reporte.reporte_id}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-blue-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-white font-medium">
                          {reporte.tipo_reporte === 'mensual_relevantes' && 'Aviso Mensual'}
                          {reporte.tipo_reporte === 'aviso_24hrs' && 'Aviso 24 Horas'}
                          {reporte.tipo_reporte === 'informe_ausencia' && 'Informe Ausencia'}
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          reporte.estado === 'enviado'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {reporte.enviado_uif ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Enviado a UIF
                            </span>
                          ) : (
                            'Pendiente envío'
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Periodo:</span>
                          <p className="text-white">
                            {new Date(reporte.periodo_inicio).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">Operaciones:</span>
                          <p className="text-white">{reporte.num_operaciones}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Monto Total:</span>
                          <p className="text-white">${reporte.monto_total.toLocaleString()} USD</p>
                        </div>
                        {reporte.numero_operacion_uif && (
                          <div>
                            <span className="text-gray-400">Folio UIF:</span>
                            <p className="text-white font-mono text-xs">{reporte.numero_operacion_uif}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                        title="Descargar XML"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      {reporte.enviado_uif && (
                        <button
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                          title="Ver acuse de recibo"
                        >
                          <FileText className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay reportes en el historial</p>
            </div>
          )}
        </div>
      </div>

      {/* Información legal */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
        <h4 className="text-blue-400 font-medium mb-2">📋 Obligaciones LFPIORPI Art. 17</h4>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>• <strong>Aviso mensual:</strong> Operaciones ≥ $17,500 USD (debe enviarse antes del día 17 del mes siguiente)</li>
          <li>• <strong>Aviso 24 horas:</strong> Operaciones preocupantes o inusuales detectadas</li>
          <li>• <strong>Informe ausencia:</strong> Si no hubo operaciones relevantes en el mes (opcional según actividad)</li>
          <li>• <strong>Conservación:</strong> Expedientes y reportes deben conservarse 10 años desde 2025</li>
        </ul>
      </div>
    </div>
  );
};

export default UIFReportModule;
