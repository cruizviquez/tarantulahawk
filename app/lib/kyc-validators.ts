/**
 * KYC Frontend Validators
 * Funciones de validación para RFC, CURP, nombres y otros campos
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validar formato de RFC
 * - Personas Físicas: 13 caracteres (formato: XXXXXX######XY#)
 * - Personas Morales: 12 caracteres (formato: XXXXXX#####YZ#)
 */
export function validarRFC(rfc: string, tipoPersona: 'fisica' | 'moral'): ValidationResult {
  const rfc_clean = rfc.trim().toUpperCase();
  
  if (!rfc_clean) {
    return { valid: false, error: 'RFC es requerido' };
  }

  const longitud_esperada = tipoPersona === 'fisica' ? 13 : 12;
  
  if (rfc_clean.length !== longitud_esperada) {
    return {
      valid: false,
      error: `RFC debe tener ${longitud_esperada} caracteres para persona ${tipoPersona === 'fisica' ? 'física' : 'moral'}`
    };
  }

  // Validar formato: letras y números
  const rfc_pattern = /^[A-ZÑ&]{4,6}\d{6}[A-Z0-9]{3}$/;
  if (!rfc_pattern.test(rfc_clean)) {
    return {
      valid: false,
      error: 'Formato de RFC inválido. Debe contener letras y números'
    };
  }

  return { valid: true };
}

/**
 * Validar formato de CURP
 * 18 caracteres: AAAA######H[EE]CCCHD (donde EE es estado de nacimiento)
 * Ejemplo: RUCF758728HDFZVS08
 *          0123456789012345678
 *          Posiciones: 4 letras + 6 dígitos + H/M + 2 letras estado + 3 letras + 2 caracteres
 */
export function validarCURP(curp: string): ValidationResult {
  const curp_clean = curp.trim().toUpperCase();

  if (!curp_clean) {
    return { valid: false, error: 'CURP es requerido' };
  }

  if (curp_clean.length !== 18) {
    return {
      valid: false,
      error: 'CURP debe tener exactamente 18 caracteres'
    };
  }

  // Validar formato: 4 letras + 6 dígitos + H/M + 2 letras estado + 3 letras consonantes + 1 carácter homoclave (letra o dígito) + 1 dígito de verificación
  // Formato: AAAA######H[EE]CCC[A-Z0-9]D
  const curp_pattern = /^[A-Z]{4}\d{6}[HM][A-Z]{2}[A-Z]{3}[A-Z0-9]{2}$/;
  if (!curp_pattern.test(curp_clean)) {
    return {
      valid: false,
      error: 'Formato de CURP inválido. Debe ser: 4 letras + 6 dígitos + H/M + 2 letras estado + 3 letras + 2 caracteres finales'
    };
  }

  // Validar código de estado (posiciones 11-12, índice 11-13 en 0-based substring)
  // RUCF758728HDFZVS08 → DF en posiciones 11-12
  // DF (Distrito Federal) es válido junto con CM (Ciudad de México)
  const estado = curp_clean.substring(11, 13);
  const estados_validos = [
    'AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG', 'GT', 'GR',
    'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC', 'PL', 'QT', 'QR', 'SP',
    'SL', 'SR', 'TC', 'TS', 'TL', 'VZ', 'YN', 'ZS', 'NE' // NE = Nacido en el Extranjero
  ];

  if (!estados_validos.includes(estado)) {
    return {
      valid: false,
      error: `Código de estado inválido: ${estado}. DF y CM son válidos para CDMX.`
    };
  }

  return { valid: true };
}

/**
 * Validar nombre completo
 */
export function validarNombre(nombre: string, tipo: 'completo' | 'razon_social' = 'completo'): ValidationResult {
  const nombre_clean = nombre.trim();

  if (!nombre_clean) {
    return {
      valid: false,
      error: tipo === 'completo' ? 'Nombre completo es requerido' : 'Razón social es requerida'
    };
  }

  if (nombre_clean.length < 3) {
    return {
      valid: false,
      error: 'El nombre debe tener al menos 3 caracteres'
    };
  }

  if (nombre_clean.length > 100) {
    return {
      valid: false,
      error: 'El nombre no puede exceder 100 caracteres'
    };
  }

  // Validar que contenga letras
  if (!/[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(nombre_clean)) {
    return {
      valid: false,
      error: 'El nombre debe contener al menos letras válidas'
    };
  }

  // Advertencia si no tiene espacios (probablemente incompleto)
  if (!nombre_clean.includes(' ') && tipo === 'completo') {
    return {
      valid: true,
      warning: 'Parece que es un nombre incompleto. Verifique que incluya nombre y apellidos.'
    };
  }

  return { valid: true };
}

/**
 * Validar sector de actividad
 */
export function validarSector(sector: string): ValidationResult {
  if (!sector || sector === '') {
    return { valid: false, error: 'Sector de actividad es requerido' };
  }

  const sectores_validos = [
    'Construcción',
    'Comercio',
    'Servicios Profesionales',
    'Transporte',
    'Bienes Raíces',
    'Financiero',
    'Tecnología',
    'Manufactura',
    'Otro'
  ];

  if (!sectores_validos.includes(sector)) {
    return { valid: false, error: 'Seleccione un sector válido' };
  }

  return { valid: true };
}

/**
 * Validar origen de recursos
 */
export function validarOrigenRecursos(origen: string): ValidationResult {
  const origen_clean = origen.trim();

  if (!origen_clean) {
    return { valid: false, error: 'Origen de recursos es requerido' };
  }

  if (origen_clean.length < 5) {
    return {
      valid: false,
      error: 'Describa el origen de recursos con más detalle (mínimo 5 caracteres)'
    };
  }

  if (origen_clean.length > 200) {
    return {
      valid: false,
      error: 'Descripción demasiado larga (máximo 200 caracteres)'
    };
  }

  return { valid: true };
}

/**
 * Validar email (opcional)
 */
export function validarEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: true }; // Email es opcional
  }

  const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email_pattern.test(email)) {
    return { valid: false, error: 'Formato de email inválido' };
  }

  return { valid: true };
}

/**
 * Validar teléfono
 */
export function validarTelefono(telefono: string): ValidationResult {
  if (!telefono) {
    return { valid: true }; // Teléfono es opcional
  }

  const telefono_clean = telefono.replace(/\D/g, '');

  if (telefono_clean.length < 10) {
    return {
      valid: false,
      error: 'Teléfono debe tener al menos 10 dígitos'
    };
  }

  if (telefono_clean.length > 15) {
    return {
      valid: false,
      error: 'Teléfono demasiado largo'
    };
  }

  return { valid: true };
}

/**
 * Validar domicilio
 */
export function validarDomicilio(domicilio: string): ValidationResult {
  if (!domicilio) {
    return { valid: true }; // Domicilio es opcional
  }

  const domicilio_clean = domicilio.trim();

  if (domicilio_clean.length < 10) {
    return {
      valid: false,
      error: 'Domicilio debe tener más detalles'
    };
  }

  if (domicilio_clean.length > 200) {
    return {
      valid: false,
      error: 'Domicilio demasiado largo'
    };
  }

  return { valid: true };
}

/**
 * Validar fecha de nacimiento (YYYY-MM-DD)
 */
export function validarFechaNacimiento(fecha: string): ValidationResult {
  if (!fecha) {
    return { valid: true }; // Es opcional
  }

  const fecha_date = new Date(fecha);
  const hoy = new Date();
  const edad = hoy.getFullYear() - fecha_date.getFullYear();

  if (isNaN(fecha_date.getTime())) {
    return { valid: false, error: 'Formato de fecha inválido' };
  }

  if (edad < 18) {
    return { valid: false, error: 'Debe ser mayor de 18 años' };
  }

  if (edad > 120) {
    return { valid: false, error: 'Verifique la fecha de nacimiento' };
  }

  return { valid: true };
}

/**
 * Validar fecha de constitución (personas morales)
 */
export function validarFechaConstitucion(fecha: string): ValidationResult {
  if (!fecha) {
    return { valid: true }; // Es opcional
  }

  const fecha_date = new Date(fecha);
  const hoy = new Date();

  if (isNaN(fecha_date.getTime())) {
    return { valid: false, error: 'Formato de fecha inválido' };
  }

  if (fecha_date > hoy) {
    return { valid: false, error: 'Fecha no puede ser en el futuro' };
  }

  const años_antiguedad = hoy.getFullYear() - fecha_date.getFullYear();
  if (años_antiguedad < 1) {
    return {
      valid: true,
      warning: 'Empresa muy reciente. Verifique que tenga al menos 1 año de constitución.'
    };
  }

  return { valid: true };
}

/**
 * Validar giro de negocio
 */
export function validarGiroNegocio(giro: string): ValidationResult {
  if (!giro) {
    return { valid: true }; // Es opcional
  }

  const giro_clean = giro.trim();

  if (giro_clean.length < 3) {
    return { valid: false, error: 'Giro debe tener más detalle' };
  }

  if (giro_clean.length > 100) {
    return { valid: false, error: 'Giro demasiado largo' };
  }

  return { valid: true };
}

/**
 * Validar todo el formulario
 */
export interface FormDataToValidate {
  tipo_persona: 'fisica' | 'moral';
  nombre_completo: string;
  rfc: string;
  curp?: string;
  fecha_nacimiento?: string;
  razon_social?: string;
  fecha_constitucion?: string;
  telefono?: string;
  email?: string;
  domicilio_completo?: string;
  sector_actividad: string;
  giro_negocio?: string;
  origen_recursos: string;
}

export function validarFormularioCompleto(datos: FormDataToValidate): {
  valido: boolean;
  errores: Record<string, string>;
  advertencias: Record<string, string>;
} {
  const errores: Record<string, string> = {};
  const advertencias: Record<string, string> = {};

  // Validar tipo persona
  if (!['fisica', 'moral'].includes(datos.tipo_persona)) {
    errores.tipo_persona = 'Tipo de persona inválido';
  }

  // Validar nombre
  const resultado_nombre = validarNombre(
    datos.nombre_completo,
    datos.tipo_persona === 'moral' ? 'razon_social' : 'completo'
  );
  if (!resultado_nombre.valid) {
    errores.nombre_completo = resultado_nombre.error || '';
  } else if (resultado_nombre.warning) {
    advertencias.nombre_completo = resultado_nombre.warning;
  }

  // Validar RFC
  const resultado_rfc = validarRFC(datos.rfc, datos.tipo_persona);
  if (!resultado_rfc.valid) {
    errores.rfc = resultado_rfc.error || '';
  }

  // Validar CURP (solo personas físicas)
  if (datos.tipo_persona === 'fisica') {
    const resultado_curp = validarCURP(datos.curp || '');
    if (!resultado_curp.valid) {
      errores.curp = resultado_curp.error || '';
    }
  }

  // Validar sector
  const resultado_sector = validarSector(datos.sector_actividad);
  if (!resultado_sector.valid) {
    errores.sector_actividad = resultado_sector.error || '';
  }

  // Validar origen de recursos
  const resultado_origen = validarOrigenRecursos(datos.origen_recursos);
  if (!resultado_origen.valid) {
    errores.origen_recursos = resultado_origen.error || '';
  }

  // Validar email si está presente
  if (datos.email) {
    const resultado_email = validarEmail(datos.email);
    if (!resultado_email.valid) {
      errores.email = resultado_email.error || '';
    }
  }

  // Validar teléfono si está presente
  if (datos.telefono) {
    const resultado_tel = validarTelefono(datos.telefono);
    if (!resultado_tel.valid) {
      errores.telefono = resultado_tel.error || '';
    }
  }

  // Validar domicilio si está presente
  if (datos.domicilio_completo) {
    const resultado_dom = validarDomicilio(datos.domicilio_completo);
    if (!resultado_dom.valid) {
      errores.domicilio_completo = resultado_dom.error || '';
    }
  }

  // Validar fecha nacimiento si está presente (personas físicas)
  if (datos.tipo_persona === 'fisica' && datos.fecha_nacimiento) {
    const resultado_fecha = validarFechaNacimiento(datos.fecha_nacimiento);
    if (!resultado_fecha.valid) {
      errores.fecha_nacimiento = resultado_fecha.error || '';
    }
  }

  // Validar fecha constitución si está presente (personas morales)
  if (datos.tipo_persona === 'moral' && datos.fecha_constitucion) {
    const resultado_fecha = validarFechaConstitucion(datos.fecha_constitucion);
    if (!resultado_fecha.valid) {
      errores.fecha_constitucion = resultado_fecha.error || '';
    } else if (resultado_fecha.warning) {
      advertencias.fecha_constitucion = resultado_fecha.warning;
    }
  }

  // Validar giro de negocio si está presente
  if (datos.giro_negocio) {
    const resultado_giro = validarGiroNegocio(datos.giro_negocio);
    if (!resultado_giro.valid) {
      errores.giro_negocio = resultado_giro.error || '';
    }
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
    advertencias
  };
}
