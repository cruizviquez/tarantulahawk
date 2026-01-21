// components/kyc/KYCModule.tsx
import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, FileText, Shield, AlertTriangle, 
  CheckCircle, XCircle, Upload, Eye, Edit, Trash2, Download, AlertCircle, Info
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { formatDateES } from '../../lib/dateFormatter';
import {
  validarRFC,
  validarCURP,
  validarNombre,
  validarSector,
  validarOrigenRecursos,
  validarEmail,
  validarTelefono,
  validarDomicilio,
  validarFechaNacimiento,
  validarFechaConstitucion,
  validarGiroNegocio,
  validarFormularioCompleto,
  type FormDataToValidate
} from '../../lib/kyc-validators';

interface Cliente {
  cliente_id: string;
  nombre_completo: string;
  rfc: string;
  tipo_persona: 'fisica' | 'moral';
  sector_actividad: string;
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico' | 'pendiente';
  score_ebr: number;
  es_pep: boolean;
  en_lista_69b: boolean;
  en_lista_ofac: boolean;
  estado_expediente: string;
  created_at: string;
  num_operaciones?: number;
  monto_total?: number;
}

interface ClienteFormData {
  tipo_persona: 'fisica' | 'moral';
  nombre_completo: string;
  rfc: string;
  curp?: string;
  sector_actividad: string;
  origen_recursos: string;
}

const KYCModule = () => {
  const [view, setView] = useState<'lista' | 'nuevo' | 'detalle'>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState<string>('todos');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<ClienteFormData>({
    tipo_persona: 'fisica',
    nombre_completo: '',
    rfc: '',
    curp: '',
    sector_actividad: '',
    origen_recursos: ''
  });

  // Función para obtener el token de autenticación
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Cargar clientes al montar el componente
  useEffect(() => {
    if (view === 'lista') {
      cargarClientes();
    }
  }, [view]);

  const cargarClientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        // Usuario no autenticado - mostrar mensaje amigable
        setClientes([]);
        setLoading(false);
        setError('Por favor inicia sesión para acceder al módulo KYC');
        return;
      }

      const response = await fetch('/api/kyc/clientes', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar clientes');
      }

      const data = await response.json();
      setClientes(data.clientes || []);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Use mock data on error for now
      setClientes(mockClientes);
    } finally {
      setLoading(false);
    }
  };

  const crearCliente = async () => {
    // Validar formulario completo
    const validacion = validarFormularioCompleto({
      tipo_persona: formData.tipo_persona,
      nombre_completo: formData.nombre_completo,
      rfc: formData.rfc,
      curp: formData.curp,
      sector_actividad: formData.sector_actividad,
      origen_recursos: formData.origen_recursos
    } as FormDataToValidate);

    // Mostrar errores de validación
    if (!validacion.valido) {
      setFieldErrors(validacion.errores);
      setError('Por favor corrija los errores en el formulario');
      return;
    }

    // Mostrar advertencias pero permitir continuar
    if (Object.keys(validacion.advertencias).length > 0) {
      setFieldWarnings(validacion.advertencias);
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Por favor inicia sesión para crear clientes');
        return;
      }

      const response = await fetch('/api/kyc/clientes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al crear cliente');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`✅ Cliente creado exitosamente\nEstado: ${data.estado}\n${data.mensaje}`);
        setView('lista');
        cargarClientes();
        // Reset form
        setFormData({
          tipo_persona: 'fisica',
          nombre_completo: '',
          rfc: '',
          curp: '',
          sector_actividad: '',
          origen_recursos: ''
        });
        setFieldErrors({});
        setFieldWarnings({});
      } else {
        throw new Error(data.error || 'Error al crear cliente');
      }
    } catch (err) {
      console.error('Error creando cliente:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Mock data - En producción vendría de Supabase
  const mockClientes: Cliente[] = [
    {
      cliente_id: '1',
      nombre_completo: 'Juan Pérez García',
      rfc: 'PEGJ850515XY1',
      tipo_persona: 'fisica',
      sector_actividad: 'Construcción',
      nivel_riesgo: 'alto',
      score_ebr: 0.782,
      es_pep: false,
      en_lista_69b: false,
      en_lista_ofac: false,
      estado_expediente: 'aprobado',
      created_at: '2025-01-10T10:00:00Z',
      num_operaciones: 12,
      monto_total: 450000
    },
    {
      cliente_id: '2',
      nombre_completo: 'Constructora ABC S.A. de C.V.',
      rfc: 'CAB950101ABC',
      tipo_persona: 'moral',
      sector_actividad: 'Construcción',
      nivel_riesgo: 'medio',
      score_ebr: 0.456,
      es_pep: false,
      en_lista_69b: false,
      en_lista_ofac: false,
      estado_expediente: 'aprobado',
      created_at: '2025-01-08T14:30:00Z',
      num_operaciones: 5,
      monto_total: 180000
    }
  ];

  const getRiesgoColor = (nivel: string) => {
    switch (nivel) {
      case 'critico': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'alto': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'medio': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'bajo': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRiesgoIcon = (nivel: string) => {
    switch (nivel) {
      case 'critico': return '🔴';
      case 'alto': return '🟠';
      case 'medio': return '🟡';
      case 'bajo': return '🟢';
      default: return '⚪';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'aprobado': return 'bg-green-500/20 text-green-400';
      case 'pendiente_aprobacion': return 'bg-yellow-500/20 text-yellow-400';
      case 'rechazado': return 'bg-red-500/20 text-red-400';
      case 'suspendido': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  // ==================== VISTA: LISTA ====================
  if (view === 'lista') {
    return (
      <div className="space-y-6">
        {/* Header con acciones */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-emerald-400" />
              Clientes & KYC
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Gestión de expedientes y cumplimiento normativo
            </p>
          </div>
          <button
            onClick={() => setView('nuevo')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Clientes</span>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{clientes.length}</p>
          </div>

          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Riesgo Alto/Crítico</span>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-400">
              {clientes.filter(c => ['alto', 'critico'].includes(c.nivel_riesgo)).length}
            </p>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">PEPs</span>
              <Shield className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-2xl font-bold text-yellow-400">
              {clientes.filter(c => c.es_pep).length}
            </p>
          </div>

          <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">En Listas</span>
              <XCircle className="w-5 h-5 text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-orange-400">
              {clientes.filter(c => c.en_lista_69b || c.en_lista_ofac).length}
            </p>
          </div>
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, RFC o CURP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={filterRiesgo}
              onChange={(e) => setFilterRiesgo(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="todos">Todos los niveles</option>
              <option value="critico">Crítico</option>
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="bajo">Bajo</option>
              <option value="pendiente">Pendiente</option>
            </select>

            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>

        {/* Tabla de clientes */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">RFC</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tipo</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Sector</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Riesgo</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Alertas</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">Operaciones</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Estado</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {clientes.map((cliente) => (
                  <tr key={cliente.cliente_id} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{cliente.nombre_completo}</div>
                      <div className="text-xs text-gray-400">
                        Alta: {formatDateES(cliente.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-gray-300">{cliente.rfc}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300 capitalize">{cliente.tipo_persona}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">{cliente.sector_actividad}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiesgoColor(cliente.nivel_riesgo)}`}>
                          {getRiesgoIcon(cliente.nivel_riesgo)} {cliente.nivel_riesgo.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">EBR: {cliente.score_ebr.toFixed(3)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        {cliente.es_pep && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">PEP</span>
                        )}
                        {cliente.en_lista_69b && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">69B</span>
                        )}
                        {cliente.en_lista_ofac && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">OFAC</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-white font-medium">{cliente.num_operaciones || 0}</div>
                      <div className="text-xs text-gray-400">
                        ${(cliente.monto_total || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(cliente.estado_expediente)}`}>
                        {cliente.estado_expediente}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedCliente(cliente);
                            setView('detalle');
                          }}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Ver expediente"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
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
  }

  // ==================== VISTA: NUEVO CLIENTE ====================
  if (view === 'nuevo') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('lista')}
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
          >
            ← Volver
          </button>
          <h2 className="text-2xl font-bold text-white">Nuevo Cliente - Alta KYC</h2>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error en el formulario</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 text-green-300 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">¡Éxito!</p>
              <p className="text-sm mt-1">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <form onSubmit={(e) => { e.preventDefault(); crearCliente(); }} className="space-y-6">
            {/* Tipo de Persona */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Persona *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="fisica"
                    checked={formData.tipo_persona === 'fisica'}
                    onChange={(e) => setFormData({ ...formData, tipo_persona: 'fisica' })}
                    className="text-emerald-500"
                  />
                  <span className="text-white">Persona Física</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="moral"
                    checked={formData.tipo_persona === 'moral'}
                    onChange={(e) => setFormData({ ...formData, tipo_persona: 'moral' })}
                    className="text-emerald-500"
                  />
                  <span className="text-white">Persona Moral</span>
                </label>
              </div>
            </div>

            {/* Nombre Completo */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {formData.tipo_persona === 'fisica' ? 'Nombre Completo' : 'Razón Social'} *
              </label>
              <input
                type="text"
                required
                value={formData.nombre_completo}
                onChange={(e) => {
                  const valor = e.target.value;
                  setFormData({ ...formData, nombre_completo: valor });
                  // Validar en tiempo real
                  if (valor.length > 0) {
                    const resultado = validarNombre(valor, formData.tipo_persona === 'moral' ? 'razon_social' : 'completo');
                    if (!resultado.valid) {
                      setFieldErrors({ ...fieldErrors, nombre_completo: resultado.error || '' });
                      const { nombre_completo: _, ...rest } = fieldWarnings;
                      setFieldWarnings(rest);
                    } else if (resultado.warning) {
                      setFieldWarnings({ ...fieldWarnings, nombre_completo: resultado.warning });
                      const { nombre_completo: _, ...rest } = fieldErrors;
                      setFieldErrors(rest);
                    } else {
                      const { nombre_completo: _, ...rest } = fieldErrors;
                      setFieldErrors(rest);
                      const { nombre_completo: __, ...rest2 } = fieldWarnings;
                      setFieldWarnings(rest2);
                    }
                  }
                }}
                className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white focus:outline-none transition-colors ${
                  fieldErrors.nombre_completo
                    ? 'border-red-500 focus:border-red-500'
                    : fieldWarnings.nombre_completo
                    ? 'border-yellow-500 focus:border-yellow-500'
                    : 'border-gray-700 focus:border-emerald-500'
                }`}
                placeholder={formData.tipo_persona === 'fisica' ? 'Ej: Juan Pérez García' : 'Ej: Empresa S.A. de C.V.'}
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">{formData.nombre_completo.length}/100</p>
                {fieldErrors.nombre_completo && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.nombre_completo}
                  </p>
                )}
                {fieldWarnings.nombre_completo && !fieldErrors.nombre_completo && (
                  <p className="text-xs text-yellow-400 flex items-center gap-1">
                    <Info className="w-3 h-3" /> {fieldWarnings.nombre_completo}
                  </p>
                )}
              </div>
            </div>

            {/* RFC */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                RFC *
              </label>
              <input
                type="text"
                required
                value={formData.rfc}
                onChange={(e) => {
                  const valor = e.target.value.toUpperCase();
                  setFormData({ ...formData, rfc: valor });
                  // Validar en tiempo real
                  if (valor.length > 0) {
                    const resultado = validarRFC(valor, formData.tipo_persona);
                    if (!resultado.valid) {
                      setFieldErrors({ ...fieldErrors, rfc: resultado.error || '' });
                    } else {
                      const { rfc: _, ...rest } = fieldErrors;
                      setFieldErrors(rest);
                    }
                  }
                }}
                className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white font-mono focus:outline-none transition-colors ${
                  fieldErrors.rfc
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-700 focus:border-emerald-500'
                }`}
                placeholder="Ej: PEGJ850515XY1"
                maxLength={formData.tipo_persona === 'fisica' ? 13 : 12}
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">
                  {formData.tipo_persona === 'fisica' ? '13 caracteres' : '12 caracteres'}
                </p>
                {fieldErrors.rfc && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.rfc}
                  </p>
                )}
              </div>
            </div>

            {/* CURP - solo para personas físicas */}
            {formData.tipo_persona === 'fisica' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CURP *
                </label>
                <input
                  type="text"
                  required={formData.tipo_persona === 'fisica'}
                  value={formData.curp}
                  onChange={(e) => {
                    const valor = e.target.value.toUpperCase();
                    setFormData({ ...formData, curp: valor });
                    // Validar en tiempo real
                    if (valor.length > 0) {
                      const resultado = validarCURP(valor);
                      if (!resultado.valid) {
                        setFieldErrors({ ...fieldErrors, curp: resultado.error || '' });
                      } else {
                        const { curp: _, ...rest } = fieldErrors;
                        setFieldErrors(rest);
                      }
                    }
                  }}
                  className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white font-mono focus:outline-none transition-colors ${
                    fieldErrors.curp
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-gray-700 focus:border-emerald-500'
                  }`}
                  placeholder="Ej: PEGJ850515HDFLRN09"
                  maxLength={18}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-gray-500">18 caracteres</p>
                  {fieldErrors.curp && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {fieldErrors.curp}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Sector de Actividad */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sector de Actividad *
              </label>
              <select
                required
                value={formData.sector_actividad}
                onChange={(e) => {
                  const valor = e.target.value;
                  setFormData({ ...formData, sector_actividad: valor });
                  // Validar en tiempo real
                  if (valor) {
                    const resultado = validarSector(valor);
                    if (!resultado.valid) {
                      setFieldErrors({ ...fieldErrors, sector_actividad: resultado.error || '' });
                    } else {
                      const { sector_actividad: _, ...rest } = fieldErrors;
                      setFieldErrors(rest);
                    }
                  }
                }}
                className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white focus:outline-none transition-colors ${
                  fieldErrors.sector_actividad
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-700 focus:border-emerald-500'
                }`}
              >
                <option value="">Seleccionar...</option>
                <option value="Construcción">Construcción</option>
                <option value="Comercio">Comercio</option>
                <option value="Servicios Profesionales">Servicios Profesionales</option>
                <option value="Transporte">Transporte</option>
                <option value="Bienes Raíces">Bienes Raíces</option>
                <option value="Financiero">Financiero</option>
                <option value="Tecnología">Tecnología</option>
                <option value="Manufactura">Manufactura</option>
                <option value="Otro">Otro</option>
              </select>
              {fieldErrors.sector_actividad && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.sector_actividad}
                </p>
              )}
            </div>

            {/* Origen de Recursos */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Origen de Recursos *
              </label>
              <textarea
                required
                value={formData.origen_recursos}
                onChange={(e) => {
                  const valor = e.target.value;
                  setFormData({ ...formData, origen_recursos: valor });
                  // Validar en tiempo real
                  if (valor.length > 0) {
                    const resultado = validarOrigenRecursos(valor);
                    if (!resultado.valid) {
                      setFieldErrors({ ...fieldErrors, origen_recursos: resultado.error || '' });
                    } else {
                      const { origen_recursos: _, ...rest } = fieldErrors;
                      setFieldErrors(rest);
                    }
                  }
                }}
                className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white focus:outline-none transition-colors resize-none ${
                  fieldErrors.origen_recursos
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-700 focus:border-emerald-500'
                }`}
                placeholder="Ej: Ingresos por ventas, honorarios profesionales, etc."
                rows={3}
              />
              <div className="flex justify-between mt-1">
                <p className="text-xs text-gray-500">{formData.origen_recursos.length}/200</p>
                {fieldErrors.origen_recursos && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {fieldErrors.origen_recursos}
                  </p>
                )}
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Crear Cliente y Validar KYC
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setView('lista')}
                disabled={loading}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-sm">
                ℹ️ <strong>Validación Automática:</strong> Al crear el cliente se ejecutará automáticamente:
              </p>
              <ul className="text-blue-300 text-sm mt-2 ml-4 list-disc space-y-1">
                <li>Validación de formato RFC y CURP</li>
                <li>Búsqueda en Lista OFAC (US Treasury)</li>
                <li>Búsqueda en Lista CSNU (ONU)</li>
                <li>Búsqueda en Lista 69B SAT (empresas fantasma)</li>
                <li>Cálculo de score de riesgo</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ==================== VISTA: DETALLE ====================
  if (view === 'detalle' && selectedCliente) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('lista')}
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
            >
              ← Volver
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white">{selectedCliente.nombre_completo}</h2>
              <p className="text-gray-400 text-sm">RFC: {selectedCliente.rfc}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all">
              <FileText className="w-4 h-4" />
              Exportar Expediente
            </button>
          </div>
        </div>

        {/* Tabs del expediente */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <p className="text-gray-300">
            🚧 Vista de expediente completo en construcción...
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Incluirá: datos generales, documentos, validaciones, historial de búsquedas en listas, 
            operaciones del cliente, alertas, notas, timeline de actividad, etc.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default KYCModule;