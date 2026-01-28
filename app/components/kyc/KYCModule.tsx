// components/kyc/KYCModule.tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, Plus, FileText, Shield, AlertTriangle, 
  CheckCircle, XCircle, Upload, Eye, Edit, Trash2, Download, AlertCircle, Info,
  RefreshCcw, TrendingUp, AlertOctagon, Clock, DollarSign
} from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabaseBrowser';
import { formatDateES } from '../../lib/dateFormatter';
import { getTimeCDMX } from '../../lib/timezoneHelper';
import { daysSince, formatDateShortCDMX, formatTimeCDMX } from '../../lib/dateHelpers';
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
  curp?: string;
  tipo_persona: 'fisica' | 'moral';
  sector_actividad: string;
  origen_recursos?: string;
  actividad_vulnerable?: string; // Art. 17 LFPIORPI - Default para operaciones
  multi_actividad_habilitada?: boolean; // Bandera admin para permitir cambio de actividad
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico' | 'pendiente';
  score_ebr: number | null;
  es_pep: boolean;
  en_lista_69b: boolean;
  en_lista_ofac: boolean;
  en_lista_uif?: boolean;
  en_lista_peps?: boolean;
  en_lista_csnu?: boolean;
  estado_expediente: string;
  created_at: string;
  updated_at?: string;
  fecha_ultima_busqueda_listas?: string;
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
  actividad_vulnerable?: string; // Art. 17 LFPIORPI
}

interface Operacion {
  operacion_id?: string;
  folio_interno: string;
  fecha_operacion: string;
  hora_operacion: string;
  tipo_operacion: string;
  monto: number;
  moneda: string;
  monto_usd?: number;
  metodo_pago: string;
  clasificacion_pld: string;
  alertas?: string[];
  descripcion?: string;
  referencia_factura?: string;
  actividad_vulnerable?: string; // Art. 17 LFPIORPI (reemplaza producto_servicio)
  producto_servicio?: string; // Legacy - mantener para compatibilidad con datos existentes
  banco_origen?: string;
  numero_cuenta?: string;
  notas_internas?: string;
  ubicacion_operacion?: string; // Ubicación/localidad donde se registra (factor EBR)
}

interface ResumenOperaciones {
  total_operaciones: number;
  monto_total_mxn: number;
  monto_total_usd: number;
  monto_6meses_mxn: number;
  clasificaciones: {
    relevante: number;
    preocupante: number;
    normal: number;
  };
  ultima_operacion?: {
    folio: string;
    fecha: string;
    hora: string;
    monto: number;
    moneda: string;
  };
}

interface ValidacionListasResult {
  validaciones: {
    ofac?: { encontrado?: boolean; total?: number; error?: string };
    csnu?: { encontrado?: boolean; total?: number; error?: string };
    lista_69b?: { en_lista?: boolean | null; advertencia?: string; nota?: string; error?: string };
    uif?: { encontrado?: boolean; total?: number; error?: string };
    peps_mexico?: { encontrado?: boolean; total?: number; error?: string };
    gafi?: { encontrado?: boolean; total?: number; error?: string };
    fgr?: { encontrado?: boolean; total?: number; error?: string };
    interpol?: { encontrado?: boolean; total?: number; error?: string };
    fbi?: { encontrado?: boolean; total?: number; error?: string };
  };
  score_riesgo: number;
  nivel_riesgo?: string;
  aprobado: boolean;
  alertas: string[];
  timestamp?: string;
}

// Opciones de campos según normativa PLD/LFPIORPI
const SECTORES_ACTIVIDAD = [
  'Tecnología',
  'Financiero/Seguros',
  'Construcción',
  'Retail/Comercio',
  'Inmobiliario',
  'Automotriz',
  'Joyería/Metales Preciosos',
  'Casinos/Juegos de Azar',
  'Servicios Profesionales',
  'Salud',
  'Educación',
  'Turismo/Hotelería',
  'Transporte',
  'Agricultura/Ganadería',
  'Manufactura',
  'Minería',
  'Energía',
  'Otro'
];

const ORIGENES_RECURSOS = [
  'Nómina/Sueldo',
  'Negocio Propio/Actividad Empresarial',
  'Honorarios Profesionales',
  'Arrendamiento',
  'Inversiones/Rendimientos',
  'Pensión/Jubilación',
  'Herencia/Donación',
  'Venta de Activos',
  'Premios/Sorteos',
  'Ahorro Previo',
  'Otro'
];

const KYCModule = () => {
  const supabase = getSupabaseBrowserClient();
  const [view, setView] = useState<'lista' | 'nuevo' | 'detalle' | 'operaciones'>('lista');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRiesgo, setFilterRiesgo] = useState<string>('todos');
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [validacionListas, setValidacionListas] = useState<ValidacionListasResult | null>(null);
  const [validandoListas, setValidandoListas] = useState(false);
  const [lastValidations, setLastValidations] = useState<Record<string, string>>({});
  const [lastValidationInfo, setLastValidationInfo] = useState<{ label: string; ts: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editedCliente, setEditedCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<ClienteFormData>({
    tipo_persona: 'fisica',
    nombre_completo: '',
    rfc: '',
    curp: '',
    sector_actividad: '',
    origen_recursos: '',
    actividad_vulnerable: ''
  });

  // TAB DETALLE: Control de pestaña
  const [detailTab, setDetailTab] = useState<'datosGenerales' | 'operaciones' | 'documentos' | 'validaciones'>('datosGenerales');
  
  // MODAL BLOQUEO: Cuando cliente está en listas
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockModalMessage, setBlockModalMessage] = useState('');
  
  // MODAL eliminar documento/operación con RAZÓN DE AUDITORÍA
  const [showDeleteReasonModal, setShowDeleteReasonModal] = useState(false);
  const [deleteReasonType, setDeleteReasonType] = useState<'documento' | 'operacion' | null>(null);
  const [deleteReasonText, setDeleteReasonText] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; folio?: string; nombre?: string } | null>(null);
  const [editingOperacionId, setEditingOperacionId] = useState<string | null>(null);
  
  // CHECKBOXES para seleccionar documentos/operaciones a eliminar
  const [selectedDocumentsToDelete, setSelectedDocumentsToDelete] = useState<string[]>([]);
  const [selectedOperacionesToDelete, setSelectedOperacionesToDelete] = useState<string[]>([]);
  
  // OPERACIONES: Historial y resumen
  const [operacionesDelCliente, setOperacionesDelCliente] = useState<Operacion[]>([]);
  const [resumenOps, setResumenOps] = useState<ResumenOperaciones | null>(null);
  const [cargandoOps, setCargandoOps] = useState(false);

  // DOCUMENTOS: Listado de documentos cargados
  const [documentosDelCliente, setDocumentosDelCliente] = useState<Array<{
    documento_id: string;
    nombre: string;
    tipo: string;
    archivo_url: string;
    fecha_carga: string;
  }>>([]);
  const [subiendoDocumento, setSubiendoDocumento] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Formulario de nueva operación
  const [operacionForm, setOperacionForm] = useState(() => {
    const timeCDMX = getTimeCDMX();
    return {
      fecha_operacion: timeCDMX.date,
      hora_operacion: timeCDMX.time,
      folio_interno: '', // Auto-generado en el servidor
      tipo_operacion: 'venta',
      monto: '',
      moneda: 'MXN',
      metodo_pago: 'transferencia',
      descripcion: '',
      referencia_factura: '',
      actividad_vulnerable: '', // Campo obligatorio - Producto/Servicio Art. 17 LFPIORPI
      ubicacion_operacion: '', // Ubicación/localidad donde se registra la operación (EBR)
      banco_origen: '',
      numero_cuenta: '',
      notas_internas: ''
    };
  });
  const [actividadesVulnerables, setActividadesVulnerables] = useState<Array<{
    id: string;
    nombre: string;
    aviso_uma: number;
    efectivo_max_uma: number;
  }>>([]);
  const [cargandoActividades, setCargandoActividades] = useState(false);
  const [creandoOperacion, setCreandoOperacion] = useState(false);
  const [operacionResultado, setOperacionResultado] = useState<{ folio?: string; clasificacion?: string; alertas?: string[] } | null>(null);

  // Cargar opciones de actividades vulnerables al montar el componente
  useEffect(() => {
    const cargarActividades = async () => {
      try {
        setCargandoActividades(true);
        console.log('[ACTIVIDADES] Fetching from /api/operaciones/opciones-actividades...');
        const response = await fetch('/api/operaciones/opciones-actividades');
        console.log('[ACTIVIDADES] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ACTIVIDADES] Error response:', errorText);
          throw new Error(`Error al cargar opciones: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[ACTIVIDADES] Data received:', data);
        setActividadesVulnerables(data.opciones || []);
        console.log('[ACTIVIDADES] Successfully loaded', data.opciones?.length || 0, 'activities');
      } catch (error) {
        console.error('[ACTIVIDADES] Error cargando actividades:', error);
        setActividadesVulnerables([]);
      } finally {
        setCargandoActividades(false);
      }
    };
    cargarActividades();
  }, []);

  // Función para obtener el token de autenticación
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Helper: separar nombre completo en partes
  const splitNombreCompleto = (nombreCompleto: string) => {
    const partes = (nombreCompleto || '').trim().split(/\s+/);
    const nombre = partes[0] || '';
    const apellido_paterno = partes[1] || '';
    const apellido_materno = partes.slice(2).join(' ');
    return { nombre, apellido_paterno, apellido_materno };
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('es-MX', { hour12: false });
    } catch {
      return iso;
    }
  };

  // Cargar clientes al montar el componente
  useEffect(() => {
    if (view === 'lista') {
      cargarClientes();
    }
  }, [view]);

  // Cargar operaciones cuando se abre la vista de detalle
  useEffect(() => {
    if (view === 'detalle' && selectedCliente) {
      cargarOperacionesDelCliente(selectedCliente.cliente_id);
    }
  }, [view, selectedCliente]);

  // Cargar documentos cuando se abre la pestaña de documentos
  useEffect(() => {
    if (view === 'detalle' && detailTab === 'documentos' && selectedCliente) {
      cargarDocumentosDelCliente(selectedCliente.cliente_id);
    }
  }, [view, detailTab, selectedCliente]);

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

      const requestUrl = '/api/kyc/clientes';
      console.log('GET /api/kyc/clientes');

      const response = await fetch(requestUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).catch((fetchError) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'window unavailable';
        const errorWithResponse = fetchError as { response?: Response };
        const responseInfo = errorWithResponse.response ? {
          url: errorWithResponse.response.url,
          status: errorWithResponse.response.status,
        } : null;
        console.error('Fetch error:', fetchError, { origin, responseInfo });
        throw new Error(`Error de conexión: ${fetchError.message}`);
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const isHtml = contentType.includes('text/html');

      if (!response.ok || isHtml) {
        const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);
        const payloadStr = typeof payload === 'string' ? payload : null;
        const looksHtml = isHtml || (payloadStr ? payloadStr.trim().toLowerCase().startsWith('<!doctype') || payloadStr.trim().toLowerCase().startsWith('<html') : false);
        const msg =
          (payload && typeof payload === 'object' && (payload.detail || payload.error)) ||
          (looksHtml ? `El servidor devolvió HTML (posible error ${response.status || '500'}). Puede ser backend caído o configuración Supabase/env faltante. Revisa logs de Next.` : null) ||
          (payloadStr ? payloadStr.slice(0, 200) : null) ||
          `Error HTTP ${response.status}`;
        throw new Error(msg);
      }

      const data = isJson ? await response.json() : null;
      setClientes(data?.clientes || []);
    } catch (err) {
      console.error('Error cargando clientes:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Use mock data on error for now
      setClientes(mockClientes);
    } finally {
      setLoading(false);
    }
  };

  const validarListas = async (datos: ClienteFormData, clienteId?: string) => {
    setValidandoListas(true);
    setValidacionListas(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Por favor inicia sesión para validar en listas');
        return null;
      }

      const { nombre, apellido_paterno, apellido_materno } = splitNombreCompleto(datos.nombre_completo);

      const response = await fetch('/api/kyc/validar-listas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nombre, apellido_paterno, apellido_materno, rfc: datos.rfc })
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

      if (!response.ok) {
        const msg =
          (payload && typeof payload === 'object' && (payload.detail || payload.error)) ||
          (typeof payload === 'string' && payload.slice(0, 200)) ||
          `Error HTTP ${response.status}`;
        setError(`No se pudo validar en listas: ${msg}`);
        return null;
      }

      const resultado = payload as ValidacionListasResult;
      setValidacionListas(resultado);

      // Si se proporciona un cliente_id, guardar los resultados en la BD
      if (clienteId) {
        await guardarValidacionesEnDB(clienteId, resultado, token);
      }

      return resultado;
    } catch (e) {
      setError('No se pudo validar en listas (conexión)');
      return null;
    } finally {
      setValidandoListas(false);
    }
  };

  const guardarValidacionesEnDB = async (clienteId: string, validacionListas: ValidacionListasResult, token: string) => {
    try {
      // Normalizar nivel de riesgo a valores permitidos: bajo, medio, alto, critico, pendiente
      const normalizarNivelRiesgo = (nivel?: string): string => {
        if (!nivel) return 'pendiente';
        const nivelLower = nivel.toLowerCase().trim();
        
        // Mapeo de posibles valores
        const mapeo: Record<string, string> = {
          'bajo': 'bajo',
          'low': 'bajo',
          'medio': 'medio',
          'medium': 'medio',
          'moderado': 'medio',
          'alto': 'alto',
          'high': 'alto',
          'critico': 'critico',
          'crítico': 'critico',
          'critical': 'critico',
          'pendiente': 'pendiente',
          'pending': 'pendiente'
        };
        
        return mapeo[nivelLower] || 'pendiente';
      };

      const mapeoValidaciones = {
        nivel_riesgo: normalizarNivelRiesgo(validacionListas.nivel_riesgo),
        score_ebr: validacionListas.score_riesgo !== undefined ? validacionListas.score_riesgo / 100 : null,
        en_lista_ofac: validacionListas.validaciones?.ofac?.encontrado || false,
        en_lista_69b: validacionListas.validaciones?.lista_69b?.en_lista || false,
        en_lista_uif: validacionListas.validaciones?.uif?.encontrado || false,
        en_lista_peps: validacionListas.validaciones?.peps_mexico?.encontrado || false,
        en_lista_csnu: validacionListas.validaciones?.csnu?.encontrado || false,
        es_pep: validacionListas.validaciones?.peps_mexico?.encontrado || false,
        estado_expediente: validacionListas.aprobado ? 'aprobado' : 'pendiente_aprobacion',
        fecha_ultima_busqueda_listas: new Date().toISOString(),
        validaciones: validacionListas.validaciones
      };

      console.log('📤 Actualizando validaciones del cliente:', clienteId);
      console.log('🎯 Nivel de riesgo original:', validacionListas.nivel_riesgo);
      console.log('🎯 Nivel de riesgo normalizado:', normalizarNivelRiesgo(validacionListas.nivel_riesgo));
      console.log('📋 Datos a enviar:', JSON.stringify(mapeoValidaciones, null, 2));
      console.log('🔑 Token presente:', !!token);

      // Usar endpoint más directo
      const url = `/api/kyc/clientes/${clienteId}?action=validaciones`;
      console.log('🌐 URL:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mapeoValidaciones)
      });
      
      console.log('📡 Response status:', response.status, response.statusText);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        let errorMsg = 'Error al guardar validaciones';
        console.error('❌ Response no OK. Status:', response.status);
        console.error('❌ Content-Type:', contentType);
        
        if (isJson) {
          try {
            const errorData = await response.json();
            console.error('❌ Error del servidor (completo):', JSON.stringify(errorData, null, 2));
            
            // Detectar error de columna faltante
            if (errorData.code === 'PGRST204' || errorData.detail?.includes('column')) {
              errorMsg = '⚠️ Base de datos desactualizada. Por favor, aplica la migración de columnas. Ver: FIX_COLUMNAS_LISTAS.md';
              console.error('');
              console.error('═══════════════════════════════════════════════════════════');
              console.error('🔧 SOLUCIÓN: Ejecuta este SQL en Supabase Dashboard:');
              console.error('═══════════════════════════════════════════════════════════');
              console.error('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS en_lista_uif BOOLEAN DEFAULT false;');
              console.error('ALTER TABLE clientes ADD COLUMN IF NOT EXISTS en_lista_peps BOOLEAN DEFAULT false;');
              console.error('═══════════════════════════════════════════════════════════');
              console.error('Ver instrucciones completas en: FIX_COLUMNAS_LISTAS.md');
              console.error('');
            } else {
              errorMsg = errorData.error || errorData.detail || errorData.message || errorMsg;
            }
            
            // Si el objeto está vacío, usar un mensaje más descriptivo
            if (Object.keys(errorData).length === 0) {
              errorMsg = `Error ${response.status}: Respuesta vacía del servidor`;
            }
          } catch (parseErr) {
            console.error('❌ No se pudo parsear error JSON:', parseErr);
            errorMsg = `Error ${response.status}: No se pudo leer el error`;
          }
        } else {
          const text = await response.text();
          console.error('❌ Error (text):', text);
          errorMsg = text || `Error ${response.status}: Sin mensaje`;
        }
        setError(`${errorMsg} (${response.status})`);
        return;
      }

      const data = isJson ? await response.json() : null;
      console.log('✅ Validaciones guardadas en BD:', data);
      
      // Recargar cliente actualizado desde la BD
      if (data?.cliente) {
        // Si hay un cliente seleccionado y es el mismo que se actualizó, actualizarlo
        if (selectedCliente && selectedCliente.cliente_id === clienteId) {
          setSelectedCliente(data.cliente);
        }
      }
    } catch (err) {
      console.error('❌ Error conectando con BD:', err);
      setError(`Error de conexión: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const validarListasCliente = async (cliente: Cliente) => {
    const ts = new Date().toISOString();
    setValidandoListas(true);
    try {
      const resultado = await validarListas(
        {
          tipo_persona: cliente.tipo_persona,
          nombre_completo: cliente.nombre_completo,
          rfc: cliente.rfc,
          curp: cliente.curp,
          sector_actividad: cliente.sector_actividad,
          origen_recursos: cliente.origen_recursos || ''
        },
        cliente.cliente_id // Pasar cliente_id para guardar en DB
      );

      if (resultado) {
        // Actualizar cliente seleccionado en la UI
        if (selectedCliente && selectedCliente.cliente_id === cliente.cliente_id) {
          setSelectedCliente({
            ...selectedCliente,
            fecha_ultima_busqueda_listas: ts,
            // Actualizar con los nuevos datos de validación
            en_lista_ofac: resultado.validaciones?.ofac?.encontrado || false,
            en_lista_69b: resultado.validaciones?.lista_69b?.en_lista || false,
            en_lista_uif: resultado.validaciones?.uif?.encontrado || false,
            en_lista_peps: resultado.validaciones?.peps_mexico?.encontrado || false,
            en_lista_csnu: resultado.validaciones?.csnu?.encontrado || false,
            es_pep: resultado.validaciones?.peps_mexico?.encontrado || false,
            nivel_riesgo: (resultado.nivel_riesgo || 'pendiente') as any,
            score_ebr: resultado.score_riesgo !== undefined ? resultado.score_riesgo / 100 : null,
            estado_expediente: resultado.aprobado ? 'aprobado' : 'pendiente_aprobacion'
          });
        }

        setLastValidations((prev) => ({ ...prev, [cliente.cliente_id]: ts }));
        setLastValidationInfo({ label: cliente.nombre_completo, ts });
      }
    } catch (err) {
      console.error('Error validando listas del cliente:', err);
    } finally {
      setValidandoListas(false);
      // Refrescar lista de clientes después de validar
      setTimeout(() => cargarClientes(), 1000);
    }
  };

  const handleEditarCliente = () => {
    setIsEditing(true);
    setEditedCliente(selectedCliente ? { ...selectedCliente } : null);
  };

  const handleCancelarEdicion = () => {
    setIsEditing(false);
    setEditedCliente(null);
  };

  const handleGuardarEdicion = async () => {
    if (!editedCliente || !selectedCliente) return;

    try {
      setLoading(true);
      const { error: updateError } = await supabase
        .from('clientes')
        .update({
          sector_actividad: editedCliente.sector_actividad,
          origen_recursos: editedCliente.origen_recursos,
          updated_at: new Date().toISOString()
        })
        .eq('cliente_id', selectedCliente.cliente_id);

      if (updateError) throw updateError;

      setSelectedCliente(editedCliente);
      setIsEditing(false);
      setSuccess('Cliente actualizado correctamente');
      await cargarClientes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error actualizando cliente:', err);
      setError(err.message || 'Error al actualizar el cliente');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarCliente = async () => {
    if (!selectedCliente) return;
    
    if (!confirm('¿Está seguro de eliminar este cliente? El registro quedará marcado como eliminado para auditoría.')) {
      return;
    }

    try {
      setLoading(true);
      // Soft delete - marcar como eliminado pero mantener registro
      const { error: deleteError } = await supabase
        .from('clientes')
        .update({
          estado_expediente: 'eliminado',
          updated_at: new Date().toISOString()
        })
        .eq('cliente_id', selectedCliente.cliente_id);

      if (deleteError) throw deleteError;

      setSuccess('Cliente eliminado correctamente (registro preservado para auditoría)');
      setTimeout(() => {
        setView('lista');
        setSuccess(null);
      }, 2000);
      await cargarClientes();
    } catch (err: any) {
      console.error('Error eliminando cliente:', err);
      setError(err.message || 'Error al eliminar el cliente');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleAdministrarExpediente = () => {
    fileInputRef.current?.click();
  };

  const onDuplicateAccept = () => {
    setDuplicateNotice(null);
    setError(null);
    setFieldErrors({});
    setFieldWarnings({});
    setFormData({
      tipo_persona: 'fisica',
      nombre_completo: '',
      rfc: '',
      curp: '',
      sector_actividad: '',
      origen_recursos: ''
    });
    setView('lista');
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
      }).catch((fetchError) => {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'window unavailable';
        const errorWithResponse = fetchError as { response?: Response };
        const responseInfo = errorWithResponse.response ? {
          url: errorWithResponse.response.url,
          status: errorWithResponse.response.status,
        } : null;
        console.error('Fetch error:', fetchError, { origin, responseInfo });
        throw new Error(`Error de conexión: ${fetchError.message}`);
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);
        const msg =
          (payload && typeof payload === 'object' && (payload.detail || payload.error)) ||
          (typeof payload === 'string' && payload.slice(0, 200)) ||
          `Error HTTP ${response.status}`;
        
        // Manejo especial para error de duplicado (409)
        if (response.status === 409) {
          setError(null);
          setDuplicateNotice(`⚠️ ${msg}\n\nEste RFC ya está registrado en tu lista de clientes.`);
          return;
        }
        
        // Para otros errores, lanzar excepción que será capturada por el catch
        throw new Error(msg);
      }

      const data = isJson ? await response.json() : null;
      
      if (data.success) {
        setSuccess(`✅ Cliente creado exitosamente\nEstado: ${data.estado}\n${data.mensaje}`);
        // Validar en listas y guardar resultados en BD
        await validarListas(formData, data.cliente?.cliente_id);
        setView('lista');
        cargarClientes();
        // Reset form
        setFormData({
          tipo_persona: 'fisica',
          nombre_completo: '',
          rfc: '',
          curp: '',
          sector_actividad: '',
          origen_recursos: '',
          actividad_vulnerable: ''
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

  const crearOperacionCliente = async () => {
    if (!selectedCliente) return;
    setCreandoOperacion(true);
    setError(null);
    setSuccess(null);
    setOperacionResultado(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Por favor inicia sesión para registrar operaciones');
        return;
      }

      if (!operacionForm.monto || Number(operacionForm.monto) <= 0) {
        setError('Ingresa un monto mayor a 0');
        setCreandoOperacion(false);
        return;
      }

      if (!operacionForm.actividad_vulnerable) {
        setError('Debes seleccionar una actividad vulnerable (Art. 17 LFPIORPI)');
        setCreandoOperacion(false);
        return;
      }

      const payload = {
        cliente_id: selectedCliente.cliente_id,
        fecha_operacion: operacionForm.fecha_operacion,
        hora_operacion: operacionForm.hora_operacion,
        tipo_operacion: operacionForm.tipo_operacion,
        monto: Number(operacionForm.monto),
        moneda: operacionForm.moneda,
        metodo_pago: operacionForm.metodo_pago,
        actividad_vulnerable: operacionForm.actividad_vulnerable, // Campo obligatorio Art. 17 LFPIORPI
        ubicacion_operacion: operacionForm.ubicacion_operacion || null,
        descripcion: operacionForm.descripcion || null,
        referencia_factura: operacionForm.referencia_factura || null,
        banco_origen: operacionForm.banco_origen || null,
        numero_cuenta: operacionForm.numero_cuenta || null,
        notas_internas: operacionForm.notas_internas || null
      };

      const isEdit = Boolean(editingOperacionId);
      const url = isEdit ? `/api/operaciones/${editingOperacionId}` : '/api/operaciones';
      const method = isEdit ? 'PATCH' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const isJson = (resp.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await resp.json() : null;
      if (!resp.ok) {
        throw new Error(data?.error || `Error HTTP ${resp.status}`);
      }

      const folio = data?.operacion?.folio_interno as string | undefined;
      const clasif = data?.operacion?.clasificacion_pld as string | undefined;
      const alertas = data?.operacion?.alertas as string[] | undefined;
      setOperacionResultado({ folio, clasificacion: clasif, alertas });
      
      // Recargar operaciones del cliente y lista de clientes para actualizar contador
      await cargarOperacionesDelCliente(selectedCliente.cliente_id);
      await cargarClientes(); // Actualizar contador en lista
      
      // NO resetear formulario - se muestra modal con resultados
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear la operación');
    } finally {
      setCreandoOperacion(false);
    }
  };

  // ==================== ELIMINAR DOCUMENTOS U OPERACIONES CON AUDITORÍA ====================
  const handleConfirmDelete = async () => {
    if (!selectedCliente || !deleteReasonText.trim()) {
      setError('Razón de eliminación es requerida');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Sesión expirada. Por favor inicia sesión nuevamente');
        return;
      }

      if (deleteReasonType === 'operacion') {
        // Eliminar operaciones BATCH
        for (const opId of selectedOperacionesToDelete) {
          const resp = await fetch(`/api/operaciones/${opId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razon_eliminacion: deleteReasonText,
              cliente_id: selectedCliente.cliente_id
            })
          });

          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data?.error || `Error al eliminar operación ${opId}`);
          }
        }

        setSuccess(`${selectedOperacionesToDelete.length} operación(es) eliminada(s). Registro de auditoría guardado.`);
        setSelectedOperacionesToDelete([]);

        // Recargar operaciones y lista de clientes para actualizar contador
        await cargarOperacionesDelCliente(selectedCliente.cliente_id);
        await cargarClientes();
      } else if (deleteReasonType === 'documento') {
        // Eliminar documentos BATCH
        for (const docId of selectedDocumentsToDelete) {
          const resp = await fetch(`/api/clientes/${selectedCliente.cliente_id}/documentos/${docId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              razon_eliminacion: deleteReasonText
            })
          });

          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data?.error || `Error al eliminar documento ${docId}`);
          }
        }

        setSuccess(`${selectedDocumentsToDelete.length} documento(s) eliminado(s). Registro de auditoría guardado.`);
        setSelectedDocumentsToDelete([]);

        // Recargar documentos
        await cargarDocumentosDelCliente(selectedCliente.cliente_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Error durante la eliminación');
    } finally {
      setLoading(false);
      setShowDeleteReasonModal(false);
      setDeleteReasonText('');
      setItemToDelete(null);
      setDeleteReasonType(null);
    }
  };

  // ==================== NUEVA OPERACIÓN: Flujo con verificación de listas ====================
  const handleNuevaOperacion = async () => {
    if (!selectedCliente) return;

    // 1. Verificar edad de última búsqueda en listas
    const ultimaBusqueda = selectedCliente.fecha_ultima_busqueda_listas;
    const diasDesdeUltima = daysSince(ultimaBusqueda);

    setError(null);
    setSuccess(null);

    // 2. Si > 30 días, re-verificar AUTOMÁTICAMENTE
    if (diasDesdeUltima > 30) {
      setLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          setError('Por favor inicia sesión');
          setLoading(false);
          return;
        }

        // Llamar endpoint de actualización de listas
        const respActualizar = await fetch(
          `/api/clientes/${selectedCliente.cliente_id}/actualizar-listas`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const dataAct = await respActualizar.json();

        // Si encuentra en listas CRÍTICAS, BLOQUEAR
        if (dataAct.encontrado_en_listas) {
          setShowBlockModal(true);
          setBlockModalMessage(
            `⛔ CLIENTE BLOQUEADO\n\nEste cliente fue encontrado en listas negras:\n\n${
              dataAct.alertas?.join('\n') || 'Listas críticas'
            }\n\nNO SE PUEDEN REGISTRAR OPERACIONES.\nContacte al oficial de cumplimiento.`
          );
          setLoading(false);
          return;
        }

        // Actualizar cliente seleccionado con nuevos datos
        if (selectedCliente) {
          setSelectedCliente({
            ...selectedCliente,
            fecha_ultima_busqueda_listas: dataAct.timestamp,
            en_lista_ofac: dataAct.validaciones?.ofac?.encontrado || false,
            en_lista_69b: dataAct.validaciones?.lista_69b?.en_lista || false,
            en_lista_uif: dataAct.validaciones?.uif?.encontrado || false,
            en_lista_peps: dataAct.validaciones?.peps_mexico?.encontrado || false,
            en_lista_csnu: dataAct.validaciones?.csnu?.encontrado || false
          });
        }

        setSuccess('✅ Listas actualizadas - Cliente limpio');
      } catch (err: any) {
        setError(`Error verificando listas: ${err?.message}`);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    // 3. Abrir formulario de nueva operación (si no está bloqueado)
    setOperacionResultado(null);
    setError(null);
    setSuccess(null);
    const timeCDMX = getTimeCDMX();
    setOperacionForm({
      fecha_operacion: timeCDMX.date,
      hora_operacion: timeCDMX.time,
      folio_interno: '',
      tipo_operacion: 'venta',
      monto: '',
      moneda: 'MXN',
      metodo_pago: 'transferencia',
      descripcion: '',
      referencia_factura: '',
      // 🔒 Usar actividad vulnerable del cliente como default (bloqueada si no hay multi-actividad)
      actividad_vulnerable: selectedCliente?.actividad_vulnerable || '',
      banco_origen: '',
      numero_cuenta: '',
      notas_internas: '',
      ubicacion_operacion: ''
    });
    setView('operaciones');
  };

  // ==================== CARGAR OPERACIONES DEL CLIENTE ====================
  const cargarOperacionesDelCliente = async (clienteId: string) => {
    setCargandoOps(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const resp = await fetch(`/api/clientes/${clienteId}/operaciones`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        setOperacionesDelCliente(data.operaciones || []);
        setResumenOps(data.resumen);
      }
    } catch (err) {
      console.error('Error cargando operaciones:', err);
    } finally {
      setCargandoOps(false);
    }
  };

  // ==================== SUBIR DOCUMENTO ====================
  const manejarUploadDocumento = async (file: File) => {
    if (!selectedCliente) return;
    setSubiendoDocumento(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Por favor inicia sesión para subir documentos');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('nombre', file.name);
      formData.append('tipo', file.type || 'desconocido');

      const resp = await fetch(`/api/clientes/${selectedCliente.cliente_id}/documentos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const isJson = (resp.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await resp.json() : null;
      if (!resp.ok) {
        throw new Error(data?.error || 'Error al subir documento');
      }

      setSuccess(`Documento "${data?.documento?.nombre || file.name}" cargado`);
      await cargarDocumentosDelCliente(selectedCliente.cliente_id);
    } catch (err: any) {
      console.error('Upload documento error:', err);
      setError(err?.message || 'No se pudo subir el documento');
    } finally {
      setSubiendoDocumento(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      manejarUploadDocumento(file);
    }
  };

  // ==================== CARGAR DOCUMENTOS DEL CLIENTE ====================
  const cargarDocumentosDelCliente = async (clienteId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const resp = await fetch(`/api/clientes/${clienteId}/documentos`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const isJson = (resp.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await resp.json() : null;
      if (!resp.ok) {
        throw new Error(data?.error || 'Error al cargar documentos');
      }

      setDocumentosDelCliente(data?.documentos || []);
    } catch (err) {
      console.error('Error cargando documentos:', err);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar documentos');
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
      en_lista_uif: false,
      en_lista_peps: false,
      en_lista_csnu: false,
      estado_expediente: 'aprobado',
      created_at: '2025-01-10T10:00:00Z',
      fecha_ultima_busqueda_listas: '2025-01-26T16:35:52Z',
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
      en_lista_uif: false,
      en_lista_peps: false,
      en_lista_csnu: false,
      estado_expediente: 'aprobado',
      created_at: '2025-01-08T14:30:00Z',
      fecha_ultima_busqueda_listas: '2025-01-26T09:29:32Z',
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
      case 'pendiente': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRiesgoIcon = (nivel: string) => {
    switch (nivel) {
      case 'critico': return '🔴';
      case 'alto': return '🟠';
      case 'medio': return '🟡';
      case 'bajo': return '🟢';
      case 'pendiente': return '⏳';
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
          <div className="flex gap-2">
            <button
              onClick={() => { 
                setError(null); 
                setValidandoListas(true);
                // Validar todos los clientes
                const validarTodos = async () => {
                  try {
                    for (const cliente of clientes) {
                      if (cliente.estado_expediente !== 'eliminado') {
                        await validarListasCliente(cliente);
                      }
                    }
                    setValidandoListas(false);
                  } catch (err) {
                    console.error('Error validando todos:', err);
                    setError('Error al validar clientes');
                    setValidandoListas(false);
                  }
                };
                validarTodos();
              }}
              disabled={validandoListas}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                validandoListas
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
              }`}
              title="Actualizar validaciones en listas para todos los clientes"
            >
              {validandoListas ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-400 border-t-transparent"></div>
                  Validando...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-5 h-5" />
                  Actualizar Listas
                </>
              )}
            </button>
            <button
              onClick={() => { setValidacionListas(null); setDuplicateNotice(null); setError(null); setView('nuevo'); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all"
            >
              <Plus className="w-5 h-5" />
              Nuevo Cliente
            </button>
          </div>
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
                        <span className="text-xs text-gray-500">
                          EBR: {cliente.score_ebr !== null ? cliente.score_ebr.toFixed(3) : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1 flex-wrap">
                        {cliente.es_pep && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">PEP</span>
                        )}
                        {cliente.en_lista_peps && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">PEPS</span>
                        )}
                        {cliente.en_lista_uif && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">UIF</span>
                        )}
                        {cliente.en_lista_69b && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">69B</span>
                        )}
                        {cliente.en_lista_ofac && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">OFAC</span>
                        )}
                        {cliente.en_lista_csnu && (
                          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded">ONU</span>
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
                      <div className="flex justify-end gap-3 items-center">
                        {cliente.fecha_ultima_busqueda_listas && (
                          <div className="text-right text-[11px] leading-tight text-gray-500">
                            <div className="text-gray-400">Últ. validación</div>
                            <div className="text-gray-300">{formatDateTime(cliente.fecha_ultima_busqueda_listas)}</div>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setSelectedCliente(cliente);
                            setIsEditing(false);
                            setEditedCliente(null);
                            setView('detalle');
                          }}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Ver expediente"
                        >
                          <Eye className="w-4 h-4" />
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
    // Si hay éxito o duplicado, mostrar modal centrado
    if (success || duplicateNotice) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 max-w-md w-full mx-4 space-y-6">
            {success && (
              <>
                <div className="flex justify-center">
                  <div className="p-3 bg-green-500/20 rounded-full">
                    <CheckCircle className="w-12 h-12 text-green-400" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white">¡Cliente creado exitosamente!</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-line">{success}</p>
                </div>
                <button
                  onClick={() => {
                    setSuccess(null);
                    setView('lista');
                    cargarClientes();
                  }}
                  className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                >
                  Aceptar
                </button>
              </>
            )}

            {duplicateNotice && (
              <>
                <div className="flex justify-center">
                  <div className="p-3 bg-orange-500/20 rounded-full">
                    <AlertTriangle className="w-12 h-12 text-orange-400" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white">Cliente ya existente</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-line">{duplicateNotice}</p>
                </div>
                <button
                  onClick={onDuplicateAccept}
                  className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                  Aceptar
                </button>
              </>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setValidacionListas(null); setDuplicateNotice(null); setError(null); setView('lista'); }}
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
                {SECTORES_ACTIVIDAD.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
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
              <select
                required
                value={formData.origen_recursos}
                onChange={(e) => {
                  const valor = e.target.value;
                  setFormData({ ...formData, origen_recursos: valor });
                  // Validar en tiempo real
                  if (valor) {
                    const resultado = validarOrigenRecursos(valor);
                    if (!resultado.valid) {
                      setFieldErrors({ ...fieldErrors, origen_recursos: resultado.error || '' });
                    } else {
                      const { origen_recursos: _, ...rest } = fieldErrors;
                      setFieldErrors(rest);
                    }
                  }
                }}
                className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white focus:outline-none transition-colors ${
                  fieldErrors.origen_recursos
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-gray-700 focus:border-emerald-500'
                }`}
              >
                <option value="">Seleccionar...</option>
                {ORIGENES_RECURSOS.map(origen => (
                  <option key={origen} value={origen}>{origen}</option>
                ))}
              </select>
              {fieldErrors.origen_recursos && (
                <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" /> {fieldErrors.origen_recursos}
                </p>
              )}
            </div>

            {/* Actividad Vulnerable (Art. 17 LFPIORPI) - Default para todas las operaciones del cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Actividad Vulnerable (Art. 17 LFPIORPI)
                <span className="text-xs text-amber-300 ml-2">Default para todas las operaciones</span>
              </label>
              <select
                value={formData.actividad_vulnerable || ''}
                onChange={(e) => setFormData({ ...formData, actividad_vulnerable: e.target.value })}
                disabled={cargandoActividades}
                className={`w-full bg-gray-900/50 border rounded-lg px-4 py-2 text-white focus:outline-none transition-colors ${
                  cargandoActividades
                    ? 'border-gray-600 opacity-50 cursor-not-allowed'
                    : 'border-gray-700 focus:border-emerald-500'
                }`}
              >
                <option value="">
                  {cargandoActividades ? 'Cargando opciones...' : actividadesVulnerables.length === 0 ? 'No disponible (agregar después)' : 'Selecciona la actividad vulnerable principal'}
                </option>
                {actividadesVulnerables.map(actividad => (
                  <option key={actividad.id} value={actividad.id}>
                    {actividad.nombre}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                {actividadesVulnerables.length === 0 ? (
                  <>⚠️ Opciones no disponibles. Puedes crear el cliente y especificar la actividad vulnerable después desde el panel de edición.</>
                ) : (
                  <>ℹ️ Esta actividad será el valor por defecto en todas las operaciones. Solo admin puede permitir cambios.</>
                )}
              </p>
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
        </div>

        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6 space-y-6">
          {/* Mensajes de éxito/error */}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* TABS NAVIGATION */}
          <div className="flex gap-2 border-b border-gray-700 -mx-6 px-6 pt-0">
            <button
              onClick={() => setDetailTab('datosGenerales')}
              className={`px-4 py-3 font-medium text-sm transition-all border-b-2 ${
                detailTab === 'datosGenerales'
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              📋 Datos Generales
            </button>
            <button
              onClick={() => setDetailTab('operaciones')}
              className={`px-4 py-3 font-medium text-sm transition-all border-b-2 ${
                detailTab === 'operaciones'
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              📊 Operaciones ({resumenOps?.total_operaciones || 0})
            </button>
            <button
              onClick={() => setDetailTab('documentos')}
              className={`px-4 py-3 font-medium text-sm transition-all border-b-2 ${
                detailTab === 'documentos'
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              📁 Documentos
            </button>
            <button
              onClick={() => setDetailTab('validaciones')}
              className={`px-4 py-3 font-medium text-sm transition-all border-b-2 ${
                detailTab === 'validaciones'
                  ? 'text-emerald-400 border-emerald-500'
                  : 'text-gray-400 border-transparent hover:text-gray-300'
              }`}
            >
              ✅ Validaciones en Listas
            </button>
          </div>

          {/* TAB 1: DATOS GENERALES */}
          {detailTab === 'datosGenerales' && (
            <div className="space-y-6">
              {/* Datos generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre - NO EDITABLE (dato básico obligatorio PLD) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                Nombre completo / Razón social
                <span className="text-xs text-gray-500">(No editable)</span>
              </label>
              <input 
                type="text" 
                className="w-full bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed" 
                value={selectedCliente.nombre_completo} 
                disabled 
              />
            </div>
            
            {/* RFC - NO EDITABLE (dato básico obligatorio PLD) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                RFC
                <span className="text-xs text-gray-500">(No editable)</span>
              </label>
              <input 
                type="text" 
                className="w-full bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed" 
                value={selectedCliente.rfc} 
                disabled 
              />
            </div>
            
            {/* CURP - NO EDITABLE (dato básico obligatorio PLD) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                CURP
                <span className="text-xs text-gray-500">(No editable)</span>
              </label>
              <input 
                type="text" 
                className="w-full bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed" 
                value={selectedCliente.curp || 'N/A'} 
                disabled 
              />
            </div>
            
            {/* Tipo de persona - NO EDITABLE */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                Tipo de persona
                <span className="text-xs text-gray-500">(No editable)</span>
              </label>
              <input 
                type="text" 
                className="w-full bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed" 
                value={selectedCliente.tipo_persona === 'fisica' ? 'Física' : 'Moral'} 
                disabled 
              />
            </div>
            
            {/* Sector - EDITABLE con combobox */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Sector de actividad</label>
              {isEditing && editedCliente ? (
                <select
                  value={editedCliente.sector_actividad}
                  onChange={(e) => setEditedCliente({ ...editedCliente, sector_actividad: e.target.value })}
                  className="w-full bg-gray-900/50 border border-emerald-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {SECTORES_ACTIVIDAD.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white" 
                  value={selectedCliente.sector_actividad} 
                  readOnly 
                />
              )}
            </div>
            
            {/* Origen de recursos - EDITABLE con combobox */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Origen de recursos</label>
              {isEditing && editedCliente ? (
                <select
                  value={editedCliente.origen_recursos || ''}
                  onChange={(e) => setEditedCliente({ ...editedCliente, origen_recursos: e.target.value })}
                  className="w-full bg-gray-900/50 border border-emerald-500 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ORIGENES_RECURSOS.map(origen => (
                    <option key={origen} value={origen}>{origen}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white" 
                  value={selectedCliente.origen_recursos || 'N/A'} 
                  readOnly 
                />
              )}
            </div>
          </div>

          {/* Estado y score */}
          <div className="flex flex-wrap gap-4 items-center mt-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiesgoColor(selectedCliente.nivel_riesgo)}`}>{getRiesgoIcon(selectedCliente.nivel_riesgo)} {selectedCliente.nivel_riesgo.toUpperCase()}</span>
            <span className="text-xs text-gray-400">EBR: {selectedCliente.score_ebr !== null ? selectedCliente.score_ebr.toFixed(3) : 'N/A'}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEstadoColor(selectedCliente.estado_expediente)}`}>{selectedCliente.estado_expediente}</span>
          </div>
            </div>
          )}

          {/* TAB 2: OPERACIONES DEL CLIENTE */}
          {detailTab === 'operaciones' && (
            <div className="space-y-6">
              {cargandoOps ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-400 border-t-transparent"></div>
                  <span className="ml-3 text-gray-400">Cargando operaciones...</span>
                </div>
              ) : (
                <>
                  {/* RESUMEN DE OPERACIONES */}
                  {resumenOps && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">📊 Resumen</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-amber-400" />
                            <div>
                              <p className="text-xs text-gray-400">Total operaciones</p>
                              <p className="text-2xl font-bold text-white">{resumenOps.total_operaciones}</p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-3">
                            <DollarSign className="w-6 h-6 text-emerald-400" />
                            <div>
                              <p className="text-xs text-gray-400">Monto acumulado 6m</p>
                              <p className="text-2xl font-bold text-white">${resumenOps.monto_6meses_mxn?.toLocaleString('es-MX')}</p>
                            </div>
                          </div>
                        </div>
                        {resumenOps.ultima_operacion && (
                          <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                            <div className="flex items-center gap-3">
                              <Clock className="w-6 h-6 text-blue-400" />
                              <div>
                                <p className="text-xs text-gray-400">Última operación</p>
                                <p className="text-sm font-bold text-white">{formatDateShortCDMX(resumenOps.ultima_operacion.fecha)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-2">Clasificación PLD</p>
                            <div className="flex gap-2 flex-wrap">
                              {resumenOps.clasificaciones.normal > 0 && (
                                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded border border-emerald-500/30">
                                  ✅ Normal: {resumenOps.clasificaciones.normal}
                                </span>
                              )}
                              {resumenOps.clasificaciones.relevante > 0 && (
                                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded border border-yellow-500/30">
                                  ⚠️ Relevante: {resumenOps.clasificaciones.relevante}
                                </span>
                              )}
                              {resumenOps.clasificaciones.preocupante > 0 && (
                                <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded border border-red-500/30">
                                  🚨 Preocupante: {resumenOps.clasificaciones.preocupante}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HISTORIAL DE OPERACIONES */}
                  {operacionesDelCliente.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">Historial de Operaciones</h3>
                      </div>
                      <div className="space-y-3">
                        {operacionesDelCliente.map((op) => (
                          <div 
                            key={op.folio_interno} 
                            className="bg-gray-900/40 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-6"
                          >

                            <div className="flex-1 grid grid-cols-2 md:grid-cols-6 items-center gap-2 md:gap-4">
                              <div>
                                <p className="text-xs text-gray-400">Folio</p>
                                <p className="font-mono text-sm text-emerald-400 font-bold">{op.folio_interno}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Fecha</p>
                                <p className="text-sm text-white">{formatDateShortCDMX(op.fecha_operacion)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Monto</p>
                                <p className="text-sm font-bold text-white">
                                  ${(op.monto || 0).toLocaleString('es-MX')} {op.moneda}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Tipo</p>
                                <p className="text-sm text-white capitalize">{op.tipo_operacion}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400">Método Pago</p>
                                <p className="text-sm text-white capitalize">
                                  {op.metodo_pago === 'transferencia' ? '🏦 Transfer' :
                                   op.metodo_pago === 'efectivo' ? '💵 Efectivo' :
                                   op.metodo_pago === 'cheque' ? '📝 Cheque' :
                                   op.metodo_pago === 'tarjeta_credito' ? '💳 T.Créd' :
                                   op.metodo_pago === 'tarjeta_debito' ? '💳 T.Déb' :
                                   op.metodo_pago || 'N/A'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-400">PLD</p>
                                <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${
                                  op.clasificacion_pld === 'normal' ? 'bg-emerald-500/20 text-emerald-300' :
                                  op.clasificacion_pld === 'relevante' ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-red-500/20 text-red-300'
                                }`}>
                                  {op.clasificacion_pld?.toUpperCase() || 'N/A'}
                                </span>
                              </div>
                            </div>
                            
                            {/* Acciones por línea */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const timeCDMX = getTimeCDMX();
                                  setOperacionForm({
                                    fecha_operacion: op.fecha_operacion,
                                    hora_operacion: timeCDMX.time, // Actualizar hora actual del sistema
                                    folio_interno: op.folio_interno,
                                    tipo_operacion: op.tipo_operacion,
                                    monto: String(op.monto),
                                    moneda: op.moneda,
                                    metodo_pago: op.metodo_pago || 'transferencia',
                                    descripcion: op.descripcion || '',
                                    referencia_factura: op.referencia_factura || '',
                                    actividad_vulnerable: op.actividad_vulnerable || '',
                                    ubicacion_operacion: (op as any).ubicacion_operacion || '',
                                    banco_origen: op.banco_origen || '',
                                    numero_cuenta: op.numero_cuenta || '',
                                    notas_internas: op.notas_internas || ''
                                  });
                                  setEditingOperacionId(op.operacion_id || op.folio_interno);
                                  setView('operaciones');
                                }}
                                className="p-2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                                title="Editar operación"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOperacionesToDelete([op.operacion_id || op.folio_interno]);
                                  setDeleteReasonType('operacion');
                                  setShowDeleteReasonModal(true);
                                }}
                                className="p-2 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                                title="Eliminar operación"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No hay operaciones registradas</p>
                    </div>
                  )}

                  {/* Se movió el botón Nueva Operación a la sección de botones finales */}
                </>
              )}
            </div>
          )}

          {/* TAB 3: DOCUMENTOS */}
          {detailTab === 'documentos' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white mb-4">📁 Documentos del Cliente</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={onFileSelected}
              />
              
              {/* Instrucción para cargar documentos */}
              <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm">Cargue documentos, identidades, comprobantes de domicilio y otros archivos requeridos por normativa. El botón de carga aparece en la zona de botones inferiores.</p>
              </div>
              
              {/* Listado de documentos */}
              {documentosDelCliente.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white">Archivos Cargados ({documentosDelCliente.length})</h4>
                  </div>
                  {documentosDelCliente.map((doc) => (
                    <div
                      key={doc.documento_id}
                      className="bg-gray-900/40 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all flex items-start gap-3"
                    >
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-bold text-white">{doc.nombre}</span>
                          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">{doc.tipo || 'archivo'}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          Cargado: {formatDateShortCDMX(doc.fecha_carga)}
                        </p>
                      </div>
                      
                      {/* Acciones por línea */}
                      <div className="flex items-center gap-2">
                        <a
                          href={doc.archivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                          title="Ver documento"
                        >
                          📥
                        </a>
                        <button
                          onClick={() => {
                            setSelectedDocumentsToDelete([doc.documento_id]);
                            setDeleteReasonType('documento');
                            setShowDeleteReasonModal(true);
                          }}
                          className="p-2 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                          title="Eliminar documento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                  <p className="text-gray-400 text-sm text-center py-8">No hay documentos cargados aún</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: VALIDACIONES EN LISTAS */}
          {detailTab === 'validaciones' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white mb-4">Resultados de Verificación en Listas</h3>
              
              {/* Grid de listas críticas y obligatorias */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* OFAC */}
                  <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">🔴 OFAC (US Treasury)</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCliente.en_lista_ofac ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {selectedCliente.en_lista_ofac ? 'En Lista' : 'Limpio'}
                      </span>
                    </div>
                  </div>

                  {/* ONU/CSNU */}
                  <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">🟡 ONU/CSNU</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCliente.en_lista_csnu ? 'bg-orange-500/20 text-orange-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {selectedCliente.en_lista_csnu ? 'En Lista' : 'Limpio'}
                      </span>
                    </div>
                  </div>

                  {/* Lista 69-B */}
                  <div className="bg-gray-900/30 border border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">🟠 Lista 69-B (SAT)</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCliente.en_lista_69b ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {selectedCliente.en_lista_69b ? 'En Lista' : 'No encontrado'}
                      </span>
                    </div>
                  </div>

                  {/* UIF Personas Bloqueadas - CRÍTICO */}
                  <div className="bg-gray-900/30 border border-red-700/40 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">🔴 UIF Personas Bloqueadas</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCliente.en_lista_uif ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {selectedCliente.en_lista_uif === undefined ? 'Pendiente' : selectedCliente.en_lista_uif ? 'En Lista' : 'Limpio'}
                      </span>
                    </div>
                  </div>

                  {/* PEPs México - OBLIGATORIO */}
                  <div className="bg-gray-900/30 border border-yellow-700/40 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">⚠️ PEPs México</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCliente.en_lista_peps ? 'bg-yellow-500/20 text-yellow-400' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {selectedCliente.en_lista_peps === undefined ? 'Pendiente' : selectedCliente.en_lista_peps ? 'PEP' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Listas recomendadas */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-700/30 rounded-lg">
                  <p className="text-xs font-medium text-blue-300 mb-2">📋 Listas Recomendadas (Próximamente):</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-blue-200">
                    <span>• GAFI (Jurisdicciones alto riesgo)</span>
                    <span>• FGR (Fiscalía General República)</span>
                    <span>• INTERPOL (Alertas rojas)</span>
                    <span>• FBI Most Wanted</span>
                  </div>
                </div>
              </div>

              {/* Información de última validación */}
              <div className="mt-4 p-4 bg-gray-900/40 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Última actualización:</span>
                  <span className="text-sm font-mono text-gray-200">
                    {selectedCliente.fecha_ultima_busqueda_listas 
                      ? formatDateTime(selectedCliente.fecha_ultima_busqueda_listas)
                      : 'Nunca'}
                  </span>
                </div>
              </div>
            </div>
          )}

            {/* Botones de acción del cliente - GLOBAL & CONTEXTUALES */}
            <div className="mt-6 flex flex-wrap gap-2 justify-start border-t border-gray-700 pt-6">
              {isEditing ? (
                <>
                  <button
                    onClick={handleGuardarEdicion}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all text-sm disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Guardar Cambios
                  </button>
                  <button
                    onClick={handleCancelarEdicion}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  {/* Botones generales - solo en pestañas que lo permiten */}
                  {detailTab === 'datosGenerales' && (
                    <>
                      <button
                        onClick={handleEditarCliente}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all text-sm"
                        title="Editar campos permitidos"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        onClick={handleEliminarCliente}
                        className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all text-sm"
                        title="Eliminar cliente (soft delete)"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </>
                  )}

                  {/* Botones contextuales por pestaña */}
                  {detailTab === 'operaciones' && (
                    <button
                      onClick={handleNuevaOperacion}
                      className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-all text-sm"
                      disabled={loading}
                      title="Registrar nueva operación"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Operación
                    </button>
                  )}

                  {/* Botones de operaciones removidos - acciones ahora en cada línea */}

                  {detailTab === 'documentos' && (
                    <button
                      onClick={handleAdministrarExpediente}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all text-sm"
                      title="Cargar nuevos documentos"
                      disabled={subiendoDocumento}
                    >
                      <Upload className="w-4 h-4" />
                      {subiendoDocumento ? 'Subiendo...' : 'Agregar Documento'}
                    </button>
                  )}

                  {/* Botón de eliminar documentos removido - acción ahora en cada línea */}
                  {detailTab === 'documentos' && false && (
                    <button
                      onClick={() => {
                        setDeleteReasonType('documento');
                        setShowDeleteReasonModal(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all text-sm"
                      title={`Eliminar ${selectedDocumentsToDelete.length} documento(s) seleccionado(s)`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar Seleccionados ({selectedDocumentsToDelete.length})
                    </button>
                  )}

                  {detailTab === 'validaciones' && (
                    <button
                      onClick={() => validarListasCliente(selectedCliente)}
                      disabled={validandoListas}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                        validandoListas
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                      }`}
                    >
                      {validandoListas ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-400 border-t-transparent"></div>
                          Actualizando...
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="w-4 h-4" />
                          Actualizar Listas
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
        </div>

        {/* MODAL BLOQUEO: Cuando cliente está en listas negras */}
        {showBlockModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-red-500/50 rounded-lg p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertOctagon className="w-8 h-8 text-red-500" />
                <h3 className="text-xl font-bold text-white">CLIENTE BLOQUEADO</h3>
              </div>
              <div className="space-y-4">
                <p className="text-red-200 whitespace-pre-wrap text-sm leading-relaxed">
                  {blockModalMessage}
                </p>
                <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                  <p className="text-xs text-red-300 font-mono">
                    Status: BLOQUEADO | PLD: CRÍTICO
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBlockModal(false)}
                className="w-full mt-6 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all font-medium"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {/* MODAL RAZÓN DE ELIMINACIÓN: Para documentos y operaciones */}
        {showDeleteReasonModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-orange-500/50 rounded-lg p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertOctagon className="w-8 h-8 text-orange-500" />
                <h3 className="text-xl font-bold text-white">
                  Eliminar {deleteReasonType === 'documento' ? 'Documento' : 'Operación'}
                </h3>
              </div>
              <div className="space-y-4">
                <p className="text-gray-300 text-sm">
                  {deleteReasonType === 'documento' 
                    ? `¿Está seguro de que desea eliminar este documento? Se mantendrá un registro en la base de datos para auditoría.`
                    : `¿Está seguro de que desea eliminar esta operación (${itemToDelete?.folio})? Se mantendrá un registro en la base de datos para auditoría.`}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Razón de eliminación *
                  </label>
                  <textarea
                    value={deleteReasonText}
                    onChange={(e) => setDeleteReasonText(e.target.value)}
                    placeholder="Ej: Error de carga, datos incorrectos, solicitud del cliente, etc."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm"
                    rows={3}
                  />
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3">
                  <p className="text-xs text-orange-300 font-mono">
                    ⚠️ AUDITORÍA: Esta acción será registrada
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteReasonModal(false);
                    setDeleteReasonText('');
                    setItemToDelete(null);
                    setDeleteReasonType(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-600 transition-all font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={!deleteReasonText.trim() || loading}
                  className="flex-1 px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-400 border-t-transparent"></div>
                      Eliminando...
                    </>
                  ) : (
                    'Confirmar Eliminación'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== VISTA: OPERACIONES ====================
  if (view === 'operaciones' && selectedCliente) {
    const operacionContent = (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('detalle')}
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
          >
            ← Volver al Expediente
          </button>
          <h2 className="text-2xl font-bold text-white">
            {editingOperacionId ? 'Editar Operación' : 'Nueva Operación'}
          </h2>
          <div className="ml-auto text-sm text-gray-400">
            {selectedCliente.nombre_completo}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <form onSubmit={(e) => { e.preventDefault(); crearOperacionCliente(); }} className="space-y-6">
            {/* SECCIÓN 1: CAMPOS MÍNIMOS (LFPIORPI) */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Campos Mínimos (LFPIORPI)
              </h3>

              {/* Folio Interno (auto-generado, readonly) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Folio Interno (auto-generado)</label>
                  <input
                    type="text"
                    readOnly
                    value={operacionResultado?.folio || operacionForm.folio_interno || 'Se generará al guardar'}
                    className="w-full bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">Ej: OP-2026-001</p>
                </div>
              </div>

              {/* Fecha, Hora, Tipo de Operación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de Operación *</label>
                  <input
                    type="date"
                    required
                    value={operacionForm.fecha_operacion}
                    onChange={(e) => setOperacionForm({ ...operacionForm, fecha_operacion: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Hora *</label>
                  <input
                    type="time"
                    required
                    value={operacionForm.hora_operacion}
                    onChange={(e) => setOperacionForm({ ...operacionForm, hora_operacion: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo de Operación *</label>
                  <select
                    required
                    value={operacionForm.tipo_operacion}
                    onChange={(e) => setOperacionForm({ ...operacionForm, tipo_operacion: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="venta">Venta</option>
                    <option value="compra">Compra</option>
                    <option value="servicio">Servicio</option>
                    <option value="arrendamiento">Arrendamiento</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Monto, Moneda, Método de Pago */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Monto *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={operacionForm.monto ?? ''}
                    onChange={(e) => setOperacionForm({ ...operacionForm, monto: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Moneda *</label>
                  <select
                    required
                    value={operacionForm.moneda}
                    onChange={(e) => setOperacionForm({ ...operacionForm, moneda: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="MXN">MXN (Pesos Mexicanos)</option>
                    <option value="USD">USD (Dólares)</option>
                    <option value="EUR">EUR (Euros)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Método de Pago *</label>
                  <select
                    required
                    value={operacionForm.metodo_pago}
                    onChange={(e) => setOperacionForm({ ...operacionForm, metodo_pago: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cheque">Cheque</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Actividad Vulnerable (Producto/Servicio) - CAMPO OBLIGATORIO Art. 17 LFPIORPI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Actividad Vulnerable (Producto/Servicio) * 
                    <span className="text-xs text-amber-400 ml-2">(Art. 17 LFPIORPI)</span>
                  </label>
                  <select
                    required
                    value={operacionForm.actividad_vulnerable}
                    onChange={(e) => {
                      setOperacionForm({ ...operacionForm, actividad_vulnerable: e.target.value });
                    }}
                    disabled={cargandoActividades}
                    className={`w-full rounded-lg px-4 py-2 text-white bg-gray-900/50 border border-gray-700 focus:border-emerald-500 focus:outline-none transition-colors ${
                      cargandoActividades ? 'cursor-not-allowed opacity-75' : ''
                    }`}
                  >
                    <option value="">{cargandoActividades ? 'Cargando opciones...' : 'Seleccionar actividad vulnerable...'}</option>
                    {actividadesVulnerables.map((actividad) => (
                      <option key={actividad.id} value={actividad.id}>
                        {actividad.nombre}
                      </option>
                    ))}
                  </select>
                  {operacionForm.actividad_vulnerable && (
                    <p className="text-xs text-amber-300 mt-1">
                      ⚙️ MODO PRUEBAS: Campo editable temporalmente (normalmente bloqueado por cliente)
                    </p>
                  )}
                  {!operacionForm.actividad_vulnerable && (
                    <p className="text-xs text-red-300 mt-1">
                      ⚠️ Selecciona una actividad vulnerable del catálogo Art. 17 LFPIORPI
                    </p>
                  )}
                  {operacionForm.actividad_vulnerable && actividadesVulnerables.length > 0 && (
                    <p className="text-xs text-emerald-400 mt-1">
                      {actividadesVulnerables.find(a => a.id === operacionForm.actividad_vulnerable)?.aviso_uma && 
                        `⚠️ Umbral de aviso: ${actividadesVulnerables.find(a => a.id === operacionForm.actividad_vulnerable)?.aviso_uma?.toLocaleString('es-MX')} UMA`
                      }
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: CAMPOS OPCIONALES/ADICIONALES */}
            <div className="border-b border-gray-700 pb-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Campos Opcionales
              </h3>

              {/* Descripción */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={operacionForm.descripcion}
                  onChange={(e) => setOperacionForm({ ...operacionForm, descripcion: e.target.value })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  rows={3}
                  placeholder="Detalles of the transaction..."
                />
              </div>

              {/* Referencia/Factura y Ubicación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Referencia / Factura</label>
                  <input
                    type="text"
                    value={operacionForm.referencia_factura}
                    onChange={(e) => setOperacionForm({ ...operacionForm, referencia_factura: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Ej: INV-2026-001, CFDI..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Ubicación / Localidad
                    <span className="text-xs text-gray-400 ml-2">(Factor EBR)</span>
                  </label>
                  <input
                    type="text"
                    value={operacionForm.ubicacion_operacion}
                    onChange={(e) => setOperacionForm({ ...operacionForm, ubicacion_operacion: e.target.value })}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    placeholder="Ej: CDMX, Monterrey, Guadalajara..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    📍 Ubicación donde se registra la operación (afecta clasificación de riesgo)
                  </p>
                </div>
              </div>

              {/* Campos de Transferencia (condicional) */}
              {operacionForm.metodo_pago === 'transferencia' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Banco Origen</label>
                      <input
                        type="text"
                        value={operacionForm.banco_origen}
                        onChange={(e) => setOperacionForm({ ...operacionForm, banco_origen: e.target.value })}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Ej: BBVA, Santander, Banorte..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Número de Cuenta</label>
                      <input
                        type="text"
                        value={operacionForm.numero_cuenta}
                        onChange={(e) => setOperacionForm({ ...operacionForm, numero_cuenta: e.target.value })}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                        placeholder="Últimos 4 dígitos o CLABE..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notas Internas */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notas Internas</label>
                <textarea
                  value={operacionForm.notas_internas}
                  onChange={(e) => setOperacionForm({ ...operacionForm, notas_internas: e.target.value })}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  rows={2}
                  placeholder="Notas para el cumplimiento normativo..."
                />
              </div>
            </div>

            {/* BOTONES */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={creandoOperacion}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all disabled:opacity-50 font-medium"
              >
                {creandoOperacion ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Guardar Operación
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setView('detalle')}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>

            {/* RESULTADO */}
            {/* Resultado del Análisis - ahora en modal */}
          </form>
        </div>
      </div>
    );

    return (
      <>
        {/* MODAL: RESULTADO ANÁLISIS LFPIORPI */}
        {operacionResultado && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-emerald-500/50 rounded-lg p-8 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {editingOperacionId ? 'Operación Actualizada' : 'Operación Creada Exitosamente'}
                </h3>
                <p className="text-gray-400 text-sm">Análisis LFPIORPI (Art. 17) completado</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Folio */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Folio Interno:</span>
                  <span className="text-emerald-400 font-mono text-lg font-bold">
                    {operacionResultado.folio || 'Pendiente'}
                  </span>
                </div>
              </div>

              {/* Clasificación PLD */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Clasificación PLD:</span>
                  <span className={`font-bold text-lg uppercase px-4 py-2 rounded-lg ${
                    operacionResultado.clasificacion === 'relevante' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    operacionResultado.clasificacion === 'preocupante' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    operacionResultado.clasificacion === 'inusual' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {operacionResultado.clasificacion?.toUpperCase() || 'NORMAL'}
                  </span>
                </div>
              </div>

              {/* Alertas */}
              {operacionResultado.alertas && operacionResultado.alertas.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertOctagon className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-400 font-semibold">Alertas Detectadas:</span>
                  </div>
                  <ul className="space-y-2">
                    {operacionResultado.alertas.map((alerta, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-amber-200 text-sm">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{alerta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resumen normativo */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  📋 <strong>Nota:</strong> Esta operación ha sido registrada y clasificada según normativa LFPIORPI.
                  {operacionResultado.clasificacion === 'relevante' && (
                    <span className="block mt-2 text-yellow-300">
                      ⚠️ Requiere aviso a la UIF dentro del mes calendario.
                    </span>
                  )}
                  {operacionResultado.clasificacion === 'preocupante' && (
                    <span className="block mt-2 text-red-300">
                      🚨 Requiere aviso a la UIF en plazo de 24 horas.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Botón Aceptar */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  // Resetear formulario y volver al expediente
                  const timeCDMX = getTimeCDMX();
                  setOperacionForm({
                    fecha_operacion: timeCDMX.date,
                    hora_operacion: timeCDMX.time,
                    folio_interno: '',
                    tipo_operacion: 'venta',
                    monto: '',
                    moneda: 'MXN',
                    metodo_pago: 'transferencia',
                    descripcion: '',
                    referencia_factura: '',
                    actividad_vulnerable: selectedCliente?.actividad_vulnerable || '',
                    ubicacion_operacion: '',
                    banco_origen: '',
                    numero_cuenta: '',
                    notas_internas: ''
                  });
                  setEditingOperacionId(null);
                  setOperacionResultado(null);
                  setView('detalle'); // Volver al expediente
                  setDetailTab('operaciones'); // Ir a pestaña operaciones
                }}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all font-medium text-lg"
              >
                <CheckCircle className="w-5 h-5" />
                Aceptar y Volver al Expediente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      {operacionContent}
    </>
  );
  }

  return null;
};

export default KYCModule;