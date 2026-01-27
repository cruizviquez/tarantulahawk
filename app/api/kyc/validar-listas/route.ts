import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '../../../lib/api-auth';
import { clasificarEBR } from '../validaciones/diarias/route';

/**
 * POST /api/kyc/validar-listas
 * Valida un cliente contra listas de sanciones: OFAC, CSNU (ONU), Lista 69B
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nombre, apellido_paterno, apellido_materno, rfc } = body;

    if (!nombre && !rfc) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Resultados de validación
    let validaciones = {
      ofac: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      csnu: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      uif: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      peps: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      lista_69b: { en_lista: false, advertencia: null as string | null, nota: null as string | null, error: null as string | null },
      // Listas recomendadas (próximamente)
      gafi: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      fgr: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      interpol: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null },
      fbi: { encontrado: false, total: 0, resultados: [] as any[], error: null as string | null }
    };

    let alertas: string[] = [];

    try {
      // 🆕 Validar OFAC
      const ofacResultado = await validarOFAC(nombre, apellido_paterno, apellido_materno);
      if (ofacResultado.encontrado) {
        validaciones.ofac = ofacResultado;
        alertas.push(`⚠️ OFAC: ${ofacResultado.total} coincidencia(s) encontrada(s)`);
      }
    } catch (err) {
      console.error('Error validando OFAC:', err);
      validaciones.ofac.error = `Error al validar OFAC: ${String(err)}`;
    }

    try {
      // 🆕 Validar CSNU/ONU
      const csnuResultado = await validarCSNU(nombre, apellido_paterno, apellido_materno);
      if (csnuResultado.encontrado) {
        validaciones.csnu = csnuResultado;
        alertas.push(`⚠️ CSNU/ONU: ${csnuResultado.total} coincidencia(s) encontrada(s)`);
      }
    } catch (err) {
      console.error('Error validando CSNU:', err);
      validaciones.csnu.error = `Error al validar CSNU: ${String(err)}`;
    }

    try {
      const uifResultado = await validarUIFPersonasBloqueadas(nombre, apellido_paterno, apellido_materno);
      if (uifResultado.encontrado) {
        validaciones.uif = uifResultado;
        alertas.push(`🚫 UIF Personas Bloqueadas: ${uifResultado.total} coincidencia(s) encontrada(s)`);
      }
    } catch (err) {
      console.error('Error validando UIF Personas Bloqueadas:', err);
      validaciones.uif.error = `Error al validar UIF: ${String(err)}`;
    }

    try {
      const pepsResultado = await validarPEPsMexico(nombre, apellido_paterno, apellido_materno);
      if (pepsResultado.encontrado) {
        validaciones.peps = pepsResultado;
        alertas.push(`⚠️ PEPs México: ${pepsResultado.total} coincidencia(s) encontrada(s)`);
      }
    } catch (err) {
      console.error('Error validando PEPs México:', err);
      validaciones.peps.error = `Error al validar PEPs: ${String(err)}`;
    }

    try {
      // 🆕 Validar Lista 69B
      if (rfc) {
        const lista69bResultado = await validarLista69B(rfc);
        validaciones.lista_69b = lista69bResultado;
        if (lista69bResultado.en_lista) {
          alertas.push(`🚫 Lista 69B: RFC encontrado en lista negra del SAT`);
        }
      }
    } catch (err) {
      console.error('Error validando Lista 69B:', err);
      validaciones.lista_69b.error = `Error al validar Lista 69B: ${String(err)}`;
    }

    // ==================== LISTAS RECOMENDADAS ====================
    // Estas son placeholders listos para integración

    try {
      // TODO: Integrar GAFI (Grupo de Acción Financiera Internacional)
      // Jurisdicciones de alto riesgo y no cooperadoras
      const gafiResultado = await validarGAFI(nombre);
      if (gafiResultado.encontrado) {
        validaciones.gafi = gafiResultado;
        alertas.push(`📋 GAFI: Jurisdicción/persona en lista gris o negra`);
      }
    } catch (err) {
      console.error('Error validando GAFI:', err);
      validaciones.gafi.error = `Error al validar GAFI: ${String(err)}`;
    }

    try {
      // TODO: Integrar FGR (Fiscalía General de la República)
      // Lista de personas sin permiso para realizar actividades
      const fgrResultado = await validarFGR(nombre, apellido_paterno, apellido_materno);
      if (fgrResultado.encontrado) {
        validaciones.fgr = fgrResultado;
        alertas.push(`📋 FGR: Persona en lista de la Fiscalía General`);
      }
    } catch (err) {
      console.error('Error validando FGR:', err);
      validaciones.fgr.error = `Error al validar FGR: ${String(err)}`;
    }

    try {
      // TODO: Integrar INTERPOL (Alertas Rojas Internacionales)
      // Personas buscadas por delitos internacionales
      const interpolResultado = await validarINTERPOL(nombre, apellido_paterno, apellido_materno);
      if (interpolResultado.encontrado) {
        validaciones.interpol = interpolResultado;
        alertas.push(`📋 INTERPOL: Alerta roja internacional`);
      }
    } catch (err) {
      console.error('Error validando INTERPOL:', err);
      validaciones.interpol.error = `Error al validar INTERPOL: ${String(err)}`;
    }

    try {
      // TODO: Integrar FBI Most Wanted
      // Lista de los criminales más buscados del FBI
      const fbiResultado = await validarFBIMostWanted(nombre, apellido_paterno, apellido_materno);
      if (fbiResultado.encontrado) {
        validaciones.fbi = fbiResultado;
        alertas.push(`📋 FBI: Persona en lista de más buscados`);
      }
    } catch (err) {
      console.error('Error validando FBI Most Wanted:', err);
      validaciones.fbi.error = `Error al validar FBI: ${String(err)}`;
    }

    // Calcular score de riesgo
    const scoreRiesgo = calcularScoreRiesgo(validaciones);

    // PASO 5: Clasificación EBR Automática
    const clasificacionEBR = clasificarEBR(scoreRiesgo, validaciones);

    // PASO 6: Decisión Automática
    const aprobado = !validaciones.ofac.encontrado && !validaciones.csnu.encontrado && !validaciones.uif.encontrado && !validaciones.peps.encontrado && !validaciones.lista_69b.en_lista;

    return NextResponse.json({
      validaciones,
      score_riesgo: scoreRiesgo,
      aprobado,
      clasificacion_ebr: clasificacionEBR,
      alertas,
      // Campos para UI
      nivel_riesgo: clasificacionEBR.nivel,
      decision: clasificacionEBR.decision,
      estado: clasificacionEBR.estado
    });
  } catch (error) {
    console.error('Error en validar-listas:', error);
    return NextResponse.json(
      { error: 'Error al validar en listas', detail: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Valida contra lista OFAC (US Treasury - Office of Foreign Assets Control)
 * OPTIMIZADO: Usa cache local descargado diariamente para búsquedas ultrarrápidas
 */
async function validarOFAC(nombre: string, apellido_paterno: string, apellido_materno: string) {
  const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
  const nombreNorm = normalizarTexto(nombreCompleto);
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Buscar en cache local primero (mucho más rápido)
    const cacheFile = path.join(process.cwd(), 'app', 'backend', 'data', 'ofac_cache', 'nombres_indexados.json');
    
    try {
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const listaOFAC = JSON.parse(cacheData);
      
      // Búsqueda optimizada en cache
      const coincidencias: any[] = [];
      const tokens = nombreNorm.split(' ').filter(t => t.length > 2);
      
      for (const entrada of listaOFAC) {
        const nombreEntrada = normalizarTexto(entrada.nombre_completo);
        
        // Verificar si todos los tokens están presentes
        const match = tokens.every(token => nombreEntrada.includes(token));
        
        if (match) {
          coincidencias.push({
            nombre: entrada.nombre_completo,
            uid: entrada.uid,
            tipo: entrada.tipo || 'OFAC SDN',
            fuente: 'US Treasury (cache local)',
            score: 100  // Match completo
          });
        }
      }
      
      return {
        encontrado: coincidencias.length > 0,
        total: coincidencias.length,
        resultados: coincidencias.slice(0, 10), // Limitar a 10 resultados
        error: null,
        fuente: 'Cache local OFAC',
        nota: coincidencias.length > 0 ? 'Validar con fuente oficial OFAC' : null
      };
      
    } catch (cacheError) {
      console.log('Cache OFAC no disponible, usando fallback');
      // Si no hay cache, usar lista de referencia
      return buscarEnListaLocal(nombreCompleto, 'OFAC');
    }
    
  } catch (err) {
    console.error('Error en validarOFAC:', err);
    return buscarEnListaLocal(nombreCompleto, 'OFAC');
  }
}

/**
 * Búsqueda en lista local (fallback)
 */
function buscarEnListaLocal(nombreCompleto: string, tipo: 'OFAC' | 'CSNU' = 'OFAC') {
  const listas = {
    'OFAC': [
      'vladimir putin',
      'sergey lavrov',
      'kim jong un',
      'nicolás maduro',
      'raúl castro',
      'bashar al-assad'
    ],
    'CSNU': [
      'osama bin laden',
      'ayman al-zawahiri',
      'hamás leader',
      'hezbollah members',
      'al-qaeda operatives'
    ]
  };

  const nombreBusqueda = nombreCompleto.toLowerCase();
  const coincidencias = (listas[tipo] || []).filter(item =>
    nombreBusqueda.includes(item.toLowerCase()) || item.toLowerCase().includes(nombreBusqueda)
  );

  return {
    encontrado: coincidencias.length > 0,
    total: coincidencias.length,
    resultados: coincidencias.map(item => ({ nombre: item, tipo: tipo === 'OFAC' ? 'OFAC SDN' : 'CSNU' })),
    error: null
  };
}

/**
 * Valida contra lista CSNU (Consejo de Seguridad de Naciones Unidas)
 * OPTIMIZADO: Usa cache local descargado diariamente
 */
async function validarCSNU(nombre: string, apellido_paterno: string, apellido_materno: string) {
  const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
  const nombreNorm = normalizarTexto(nombreCompleto);
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Buscar en cache local
    const cacheFile = path.join(process.cwd(), 'app', 'backend', 'data', 'csnu_cache', 'nombres_indexados.json');
    
    try {
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const listaCSNU = JSON.parse(cacheData);
      
      const coincidencias: any[] = [];
      const tokens = nombreNorm.split(' ').filter(t => t.length > 2);
      
      for (const entrada of listaCSNU) {
        const nombreEntrada = normalizarTexto(entrada.nombre_completo);
        
        const match = tokens.every(token => nombreEntrada.includes(token));
        
        if (match) {
          coincidencias.push({
            nombre: entrada.nombre_completo,
            tipo: entrada.tipo_lista || 'CSNU',
            fuente: 'United Nations (cache local)'
          });
        }
      }
      
      return {
        encontrado: coincidencias.length > 0,
        total: coincidencias.length,
        resultados: coincidencias.slice(0, 10),
        error: null,
        fuente: 'Cache local CSNU'
      };
      
    } catch (cacheError) {
      console.log('Cache CSNU no disponible, usando fallback');
      return buscarEnListaLocal(nombreCompleto, 'CSNU');
    }
    
  } catch (err) {
    console.error('Error en validarCSNU:', err);
    return buscarEnListaLocal(nombreCompleto, 'CSNU');
  }
}

async function validarUIFPersonasBloqueadas(nombre: string, apellido_paterno: string, apellido_materno: string) {
  try {
    const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
    const nombreNorm = normalizarTexto(nombreCompleto);
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Buscar en cache local UIF
    const cacheFile = path.join(process.cwd(), 'app', 'backend', 'data', 'uif_bloqueados', 'personas_bloqueadas.json');
    
    try {
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const listaUIF = JSON.parse(cacheData);
      
      const coincidencias: any[] = [];
      const tokens = nombreNorm.split(' ').filter(t => t.length > 2);
      
      for (const entrada of listaUIF) {
        const nombreEntrada = normalizarTexto(entrada.nombre_completo);
        
        const match = tokens.every(token => nombreEntrada.includes(token));
        
        if (match) {
          coincidencias.push({
            nombre: entrada.nombre_completo,
            tipo: 'UIF Bloqueada',
            fuente: entrada.fuente || 'UIF (cache local)',
            fecha_inclusion: entrada.fecha_inclusion
          });
        }
      }
      
      return {
        encontrado: coincidencias.length > 0,
        total: coincidencias.length,
        resultados: coincidencias,
        error: null,
        fuente: 'Cache local UIF',
        nota: coincidencias.length > 0 ? 'CRÍTICO - Verificar con UIF oficial' : null
      };
      
    } catch (cacheError) {
      console.log('Cache UIF no disponible, usando lista de referencia');
      
      // Fallback a lista de referencia
      const listaLocal = ['ejemplo persona bloqueada'];
      const encontrado = listaLocal.some(item => nombreNorm.includes(normalizarTexto(item)));
      
      return {
        encontrado,
        total: encontrado ? 1 : 0,
        resultados: encontrado ? [{ nombre: nombreCompleto, tipo: 'UIF', fuente: 'Lista de referencia' }] : [],
        error: null,
        advertencia: 'Ejecutar: python actualizar_listas_todas.py para actualizar'
      };
    }
  } catch (err) {
    return { encontrado: false, total: 0, resultados: [], error: String(err) };
  }
}

async function validarPEPsMexico(nombre: string, apellido_paterno: string, apellido_materno: string) {
  try {
    const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
    const nombreNorm = normalizarTexto(nombreCompleto);
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Buscar en cache local PEPs
    const cacheFile = path.join(process.cwd(), 'app', 'backend', 'data', 'peps_mexico', 'peps_mexico.json');
    
    try {
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const listaPEPs = JSON.parse(cacheData);
      
      const coincidencias: any[] = [];
      const tokens = nombreNorm.split(' ').filter(t => t.length > 2);
      
      for (const entrada of listaPEPs) {
        const nombreEntrada = normalizarTexto(entrada.nombre_completo);
        
        const match = tokens.every(token => nombreEntrada.includes(token));
        
        if (match) {
          coincidencias.push({
            nombre: entrada.nombre_completo,
            cargo: entrada.cargo,
            institucion: entrada.institucion,
            tipo: 'PEP',
            fuente: entrada.fuente || 'PEPs México (cache local)',
            nivel: entrada.nivel
          });
        }
      }
      
      return {
        encontrado: coincidencias.length > 0,
        total: coincidencias.length,
        resultados: coincidencias,
        error: null,
        fuente: 'Cache local PEPs',
        nota: coincidencias.length > 0 ? 'OBLIGATORIO - Realizar debida diligencia reforzada' : null
      };
      
    } catch (cacheError) {
      console.log('Cache PEPs no disponible, usando lista de referencia');
      
      const pepsLocal = ['funcionario publico ejemplo'];
      const encontrado = pepsLocal.some(item => nombreNorm.includes(normalizarTexto(item)));
      
      return {
        encontrado,
        total: encontrado ? 1 : 0,
        resultados: encontrado ? [{ nombre: nombreCompleto, tipo: 'PEP', fuente: 'Lista de referencia' }] : [],
        error: null,
        advertencia: 'Ejecutar: python actualizar_listas_todas.py para actualizar'
      };
    }
  } catch (err) {
    return { encontrado: false, total: 0, resultados: [], error: String(err) };
  }
}

/**
 * Valida contra Lista 69B del SAT (Empresas fantasma)
 * OPTIMIZADO: Usa archivo local actualizado diariamente por cron
 */
async function validarLista69B(rfc: string) {
  try {
    const rfcUppercase = rfc.toUpperCase();

    // Validar formato RFC
    if (!validarFormatoRFC(rfcUppercase)) {
      return {
        en_lista: false,
        advertencia: '⚠️ RFC con formato inválido',
        nota: 'Revisa el formato del RFC ingresado',
        error: null
      };
    }

    // Buscar en archivo local (mucho más rápido que API)
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const listaFile = path.join(process.cwd(), 'app', 'backend', 'data', 'lista_69b', 'lista_69b.json');
    
    try {
      const listaData = await fs.readFile(listaFile, 'utf-8');
      const lista69B = JSON.parse(listaData);
      
      // Buscar RFC en lista
      const encontrado = lista69B.find((entrada: any) => entrada.rfc === rfcUppercase);
      
      if (encontrado) {
        return {
          en_lista: true,
          advertencia: '🚫 RFC en Lista 69B del SAT',
          nota: 'Esta empresa está catalogada como fantasma. Requiere revisión manual.',
          tipo: encontrado.tipo || 'definitivos',
          fecha_descarga: encontrado.fecha_descarga,
          fuente: 'SAT México - Lista 69B (cache local)',
          error: null
        };
      }
      
      // No encontrado
      return {
        en_lista: false,
        advertencia: null,
        nota: 'RFC no encontrado en Lista 69B',
        fuente: 'SAT México - Lista 69B (cache local)',
        error: null
      };
      
    } catch (fileError) {
      console.log('Archivo Lista 69B no disponible, usando validación básica');
      
      // Fallback a validación local básica
      return validarLista69BLocal(rfcUppercase);
    }
    
  } catch (err) {
    console.error('Error en validarLista69B:', err);
    return validarLista69BLocal(rfc.toUpperCase());
  }
}

/**
 * Validación local de Lista 69B (fallback)
 */
function validarLista69BLocal(rfc: string) {
  // Lista de patrones/RFCs conocidos como fantasmas (ejemplo)
  const lista69BMock = [
    'AAA010101AAA',
    'BBB020202BBB',
    'CCC030303CCC',
    'XXX000000XXX'
  ];

  const encontrado = lista69BMock.includes(rfc);

  return {
    en_lista: encontrado,
    advertencia: encontrado ? '🚫 RFC en Lista 69B del SAT (empresas fantasma)' : null,
    nota: encontrado ? 'Requiere validación adicional antes de aprobar' : null,
    error: null
  };
}

/**
 * Valida formato básico de RFC (sin checksum)
 */
function validarFormatoRFC(rfc: string): boolean {
  // RFC Persona Física: 13 caracteres (ej: PEGJ850515XY1)
  // RFC Persona Moral: 12 caracteres (ej: CAB950101ABC)
  const regexRFC = /^[A-ZÑ&]{3,4}\d{6}(?:[A-V0-9]){3}[0-9]$/;
  return regexRFC.test(rfc);
}

/**
 * Calcula un score de riesgo (0-100) basado en validaciones
 */
function calcularScoreRiesgo(validaciones: any): number {
  let score = 0;

  // OFAC encontrado = 40 puntos
  if (validaciones.ofac.encontrado) {
    score += 40;
  }

  // CSNU encontrado = 40 puntos
  if (validaciones.csnu.encontrado) {
    score += 40;
  }

  // UIF Personas Bloqueadas = 70 puntos
  if (validaciones.uif.encontrado) {
    score += 70;
  }

  // PEPs México = 30 puntos
  if (validaciones.peps.encontrado) {
    score += 30;
  }

  // Lista 69B = 50 puntos (empresas fantasma = muy alto riesgo)
  if (validaciones.lista_69b.en_lista) {
    score += 50;
  }

  // Máximo 100
  return Math.min(score, 100);
}

// Normaliza texto: minúsculas, quita acentos/diacríticos, colapsa espacios
function normalizarTexto(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Valida formato básico de CURP (18 caracteres)
function validarFormatoCURP(curp: string): boolean {
  const regexCURP = /^[A-Z][AEIOU][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM][A-Z]{2}[BCDFGHJKLMNPQRSTVWXYZ]{3}[A-Z0-9]\d$/i;
  return regexCURP.test(curp || '');
}

// ==================== LISTAS RECOMENDADAS - PLACEHOLDERS ====================

/**
 * Validar contra GAFI (Grupo de Acción Financiera Internacional)
 * Jurisdicciones de alto riesgo financiero
 * TODO: Integrar con API oficial del GAFI o fuente de datos
 */
async function validarGAFI(nombre: string) {
  try {
    // Placeholder: implementar cuando se tenga acceso a datos GAFI
    const nombreNorm = normalizarTexto(nombre);
    
    // TODO: Llamar a API GAFI o base de datos
    // const response = await fetch(process.env.GAFI_API_URL, {...});
    
    return {
      encontrado: false,
      total: 0,
      resultados: [],
      error: null
    };
  } catch (err) {
    return { encontrado: false, total: 0, resultados: [], error: String(err) };
  }
}

/**
 * Validar contra FGR (Fiscalía General de la República - México)
 * TODO: Integrar con plataforma FGR cuando esté disponible
 */
async function validarFGR(nombre: string, apellido_paterno: string, apellido_materno: string) {
  try {
    const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
    
    // Placeholder: implementar cuando se tenga acceso a datos FGR
    // TODO: Llamar a API FGR o plataforma de consulta
    // const response = await fetch(process.env.FGR_API_URL, {...});
    
    return {
      encontrado: false,
      total: 0,
      resultados: [],
      error: null
    };
  } catch (err) {
    return { encontrado: false, total: 0, resultados: [], error: String(err) };
  }
}

/**
 * Validar contra INTERPOL (Alertas Rojas Internacionales)
 * TODO: Integrar con API pública de INTERPOL cuando esté disponible
 */
async function validarINTERPOL(nombre: string, apellido_paterno: string, apellido_materno: string) {
  try {
    const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
    
    // Placeholder: implementar cuando se tenga acceso a datos INTERPOL
    // TODO: Llamar a API INTERPOL o fuente de alertas rojas
    // const response = await fetch('https://www.interpol.int/...', {...});
    
    return {
      encontrado: false,
      total: 0,
      resultados: [],
      error: null
    };
  } catch (err) {
    return { encontrado: false, total: 0, resultados: [], error: String(err) };
  }
}

/**
 * Validar contra FBI Most Wanted
 * TODO: Integrar con API pública del FBI
 */
async function validarFBIMostWanted(nombre: string, apellido_paterno: string, apellido_materno: string) {
  try {
    const nombreCompleto = `${nombre} ${apellido_paterno} ${apellido_materno}`.trim();
    const nombreNorm = normalizarTexto(nombreCompleto);
    
    // Placeholder: implementar cuando se tenga acceso a datos FBI
    // TODO: Llamar a API FBI Most Wanted o fuente de datos
    // const response = await fetch('https://api.fbi.gov/...', {...});
    
    return {
      encontrado: false,
      total: 0,
      resultados: [],
      error: null
    };
  } catch (err) {
    return { encontrado: false, total: 0, resultados: [], error: String(err) };
  }
}
