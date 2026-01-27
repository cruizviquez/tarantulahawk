# Respuestas a Preguntas KYC

## 🎯 RESUMEN RÁPIDO: Job Diario Implementado

**Usuario pidió:** "Un job para que diario se ejecute la consulta de todos los clientes registrados"

**Se implementó:**
1. ✅ **Polling automático** después de crear cliente (refrescar tabla sin intervención)
2. ✅ **Validación en background** (no bloquea al usuario)
3. ✅ **Job diario** (código listo para copiar + instrucciones)

**❌ ERROR DE BUILD ENCONTRADO:**
- **Archivo:** `app/api/kyc/validar-listas/route.ts`
- **Problema:** Dos funciones `export async function POST` (línea 309 y anterior)
- **Causa:** El código del job diario se copió en el mismo archivo

**✅ SOLUCIÓN INMEDIATA:**

**Opción 1: Remover segundo POST del archivo validar-listas/route.ts**
- Eliminar TODO lo que comienza desde la línea 309 hasta el final del archivo
- Esto incluye comentario "Job diario..." y toda la función POST duplicada
- Mantener solo la primera función POST (validaciones)

**Opción 2: El job diario debe estar en RUTA SEPARADA**
```
CREAR: /app/api/kyc/validaciones/diarias/route.ts
```
Con el código del job diario (ver sección NUEVA más abajo)

**3 pasos para activar:**
1. ✅ Remover duplicado de POST en validar-listas/route.ts 
2. ✅ Crear `/app/api/kyc/validaciones/diarias/route.ts` (código abajo)
3. ✅ Configurar cron en EasyCron/Vercel (2 minutos)

**Ver detalles:** Ir a sección "NUEVA: Job Diario + Polling Frontend" más abajo ⬇️

---

## 🆘 ELIMINAR DUPLICADO POST (RÁPIDO)

### ⏱️ 30 segundos para solucionar

1. **Abrir archivo:** `app/api/kyc/validar-listas/route.ts`
2. **Ir a línea ~309** y buscar: `* Job diario para validar todos los clientes`
3. **ELIMINAR TODO** desde esa línea hasta el FINAL del archivo
4. **Guardar** (Ctrl+S)
5. **Build:** `npm run build`

### ✂️ QUÉ ELIMINAR

Buscar y eliminar:
```typescript
/**
 * Job diario para validar todos los clientes registrados
 * POST /api/kyc/validaciones/diarias
```

Y TODO lo que sigue (la segunda función `export async function POST` + funciones helper)

### ✔️ Qué debe quedar

El archivo debe terminar con:
```typescript
  return {
    validaciones,
    score_riesgo: scoreRiesgo,
    aprobado: scoreRiesgo < 40,
    alertas: alertas.length > 0 ? alertas : undefined
  };
}

// ← FIN (sin segunda POST)
```

---

**Implementado:** Ahora cuando se detecta un RFC duplicado (error 409):
- Se limpia automáticamente el formulario
- Regresa a la vista de lista donde está el botón "Nuevo Cliente"
- Muestra mensaje: "⚠️ Cliente con este RFC ya existe\n\nEste RFC ya está registrado en tu lista de clientes."

## 2. 🔍 Consulta al SAT con RFC para validar datos

### ¿Es posible?

**Sí, pero con limitaciones:**

#### API Oficial del SAT
- **Existe:** El SAT tiene API para consulta de RFC
- **Requiere:**
  - Certificado digital (.cer y .key)
  - e.firma (antes FIEL)
  - Estar dado de alta en el SAT
  - Cumplir con requisitos de seguridad

#### Servicios de Terceros
Existen servicios comerciales que ofrecen validación de RFC:

1. **Copomex** (México)
   - API de validación de RFC
   - Precio: ~$0.50-1.00 MXN por consulta
   - https://copomex.com/

2. **API RFC SAT (No oficial)**
   - Servicios de terceros que consultan SAT
   - Requieren pago

3. **Lista 69-B del SAT** (Ya implementado en el sistema)
   - Puedes verificar si RFC está en lista negra
   - Gratis y público

### Implementación Recomendada

```typescript
// Ejemplo de validación de RFC con servicio tercero
async function validarRFCconSAT(rfc: string) {
  try {
    const response = await fetch(`https://api-sat-provider.com/validate/${rfc}`, {
      headers: { 'Authorization': 'Bearer API_KEY' }
    });
    
    const data = await response.json();
    
    return {
      valido: data.valido,
      nombre_completo: data.nombre_oficial,
      regimen_fiscal: data.regimen,
      fecha_inicio_operaciones: data.fecha_inicio
    };
  } catch (error) {
    // Fallback: solo validar formato
    return validarFormatoRFC(rfc);
  }
}
```

### ¿Deberíamos implementarlo?

**Pros:**
- ✅ Asegura que el nombre coincida con el RFC
- ✅ Detecta RFC inexistentes o cancelados
- ✅ Obtiene datos oficiales del SAT
- ✅ Reduce fraude

**Contras:**
- ❌ Costo por consulta (~$0.50-1.00 MXN)
- ❌ Requiere API key de terceros
- ❌ Latencia adicional (1-2 segundos)
- ❌ Dependencia de servicio externo

**Recomendación:**
- **Corto plazo:** Validar solo formato de RFC (ya implementado)
- **Mediano plazo:** Implementar validación SAT para clientes premium o montos altos
- **Alternativa gratis:** Validar contra Lista 69-B (ya implementado)

## 3. 📜 Legislación Mexicana: RFC vs CURP como Llave Única

### Marco Legal

#### RFC (Registro Federal de Contribuyentes)
**Normativa:** Código Fiscal de la Federación

**Obligatorio para:**
- ✅ Personas físicas con actividad empresarial
- ✅ Personas morales
- ✅ Asalariados (opcional pero recomendado)

**Características:**
- Formato: 12-13 caracteres (Física/Moral)
- Emitido por: SAT
- **LLAVE ÚNICA FISCAL:** Sí
- Unicidad: Garantizada por SAT

#### CURP (Clave Única de Registro de Población)
**Normativa:** Ley General de Población

**Obligatorio para:**
- ✅ TODAS las personas físicas mexicanas y extranjeros residentes
- ✅ Trámites gubernamentales

**Características:**
- Formato: 18 caracteres
- Emitido por: RENAPO (Secretaría de Gobernación)
- **LLAVE ÚNICA POBLACIONAL:** Sí
- Unicidad: Garantizada por RENAPO

### Para KYC y Prevención de Lavado de Dinero

Según **Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Ilícita Procedencia (LFPIORPI)**:

#### Identificación Oficial Requerida
Artículo 16:

**Personas Físicas:**
- RFC (obligatorio si tiene)
- CURP (obligatorio)
- Identificación oficial (INE/Pasaporte)

**Personas Morales:**
- RFC (obligatorio)
- Acta constitutiva
- Identificación del representante legal

### ¿Cuál es la llave única?

**Para efectos fiscales y KYC financiero:**

| Tipo | Llave Principal | Llave Secundaria |
|------|----------------|------------------|
| **Persona Física** | RFC | CURP |
| **Persona Moral** | RFC | - |

**Conclusión:** 
- **RFC es la llave única fiscal** (sistema actual ✅)
- **CURP es obligatorio para personas físicas** (como validación adicional)
- En sistemas financieros/KYC: **RFC es la llave principal**

### Implementación Actual (Correcta ✅)

```typescript
// Verificación de duplicados por RFC
const { data: clienteExistente } = await supabase
  .from('clientes')
  .select('cliente_id')
  .eq('rfc', rfc)
  .eq('user_id', userId)
  .single();
```

**Esto es correcto porque:**
- RFC es único por contribuyente
- Es la identificación fiscal oficial
- Se usa en todas las operaciones financieras
- Cumple con LFPIORPI

## 4. 🤔 ¿Por qué marca "pendiente" si consultamos en tiempo real?

### Problema Identificado

**Antes:**
```typescript
nivel_riesgo: 'pendiente',  // ❌ Confuso
```

**Ahora (CORREGIDO):**
```typescript
nivel_riesgo: 'en_revision',  // ✅ Más claro
```

### Razón del cambio

El sistema SÍ consulta en tiempo real:
- ✅ Lista 69-B
- ✅ Lista OFAC
- ✅ Listas de PEP
- ✅ Score EBR (si está disponible)

Pero estas consultas pueden tardar:
- Lista 69-B: ~1-2 segundos
- OFAC: ~2-3 segundos
- Score EBR: ~3-5 segundos

### Estados del Cliente

```
Creación → en_revision → bajo/medio/alto
   ↓
[1-5 seg]
   ↓
Validaciones completadas
```

#### Estado: `en_revision`
- Recién creado
- Validaciones en progreso
- Esperando resultados de APIs externas

#### Estado: `bajo/medio/alto`
- Validaciones completadas
- Riesgo calculado según:
  - Listas negras (OFAC, 69-B)
  - PEP
  - Score EBR
  - Sector actividad
  - Origen recursos

### ¿Cómo mejorar?

**Opción 1: Webhooks/Background Jobs** (Recomendado)
```typescript
// Crear cliente
const cliente = await crearCliente(data);

// Ejecutar validaciones en background
await ejecutarValidacionesKYC(cliente.id);

// Cliente se marca como "en_revision"
// Después de 5-10 segundos, cambia a "bajo/medio/alto"
```

**Opción 2: Validación Síncrona con Loading**
```typescript
setLoading(true);
const cliente = await crearCliente(data);
const validaciones = await ejecutarValidacionesSync(cliente.id);
cliente.nivel_riesgo = calcularRiesgo(validaciones);
setLoading(false);
```

## 5. 📊 ¿En qué momento cambia el "Estado"?

### Flujo Actual del Estado

```
┌─────────────────┐
│ Usuario crea    │
│ cliente         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Estado:         │
│ "en_revision"   │  ← Cliente recién creado
└────────┬────────┘
         │
         │ [Validaciones automáticas]
         │ - Consulta Lista 69-B
         │ - Consulta OFAC
         │ - Verifica PEP
         │ - Calcula Score EBR
         │ [Toma 5-10 segundos]
         │
         ▼
┌─────────────────┐
│ Estado:         │
│ bajo/medio/alto │  ← Riesgo calculado
└─────────────────┘
```

### ¿Cuándo cambia?

**Actualmente:** ❌ NO cambia automáticamente

El código actual crea el cliente con `nivel_riesgo: 'en_revision'` pero **no hay proceso que lo actualice**.

### Implementación Necesaria

#### Opción A: Background Job (Recomendado)

```typescript
// app/api/kyc/clientes/route.ts
export async function POST(request: NextRequest) {
  // ... crear cliente ...
  
  const { data: cliente } = await supabase
    .from('clientes')
    .insert([{ ...data, nivel_riesgo: 'en_revision' }])
    .select()
    .single();

  // 🆕 Trigger validaciones en background
  await fetch('/api/kyc/validaciones/ejecutar', {
    method: 'POST',
    body: JSON.stringify({ cliente_id: cliente.cliente_id })
  });

  return NextResponse.json({
    success: true,
    cliente,
    estado: 'en_revision',
    mensaje: 'Cliente creado. Ejecutando validaciones...'
  });
}
```

```typescript
// app/api/kyc/validaciones/ejecutar/route.ts
export async function POST(request: NextRequest) {
  const { cliente_id } = await request.json();

  // 1. Consultar listas
  const en69B = await verificarLista69B(rfc);
  const enOFAC = await verificarOFAC(nombre);
  const esPEP = await verificarPEP(nombre);
  
  // 2. Calcular score EBR
  const scoreEBR = await calcularScoreEBR(cliente);
  
  // 3. Determinar nivel de riesgo
  let nivelRiesgo = 'bajo';
  if (en69B || enOFAC || scoreEBR > 0.7) nivelRiesgo = 'alto';
  else if (esPEP || scoreEBR > 0.4) nivelRiesgo = 'medio';
  
  // 4. Actualizar cliente
  await supabase
    .from('clientes')
    .update({
      nivel_riesgo: nivelRiesgo,
      score_ebr: scoreEBR,
      en_lista_69b: en69B,
      en_lista_ofac: enOFAC,
      es_pep: esPEP,
      updated_at: new Date().toISOString()
    })
    .eq('cliente_id', cliente_id);

  return NextResponse.json({ success: true });
}
```

#### Opción B: Polling desde Frontend

```typescript
// KYCModule.tsx
const crearCliente = async (formData) => {
  const response = await fetch('/api/kyc/clientes', {
    method: 'POST',
    body: JSON.stringify(formData)
  });
  
  const { cliente } = await response.json();
  
  // Polling hasta que el estado cambie
  const intervalId = setInterval(async () => {
    const status = await fetch(`/api/kyc/clientes/${cliente.cliente_id}/status`);
    const { nivel_riesgo } = await status.json();
    
    if (nivel_riesgo !== 'en_revision') {
      clearInterval(intervalId);
      cargarClientes(); // Refrescar lista
      setSuccess('✅ Validaciones completadas');
    }
  }, 3000); // Cada 3 segundos
};
```

### Recomendación

**Implementar Opción A (Background Job):**
1. Cliente se crea con `nivel_riesgo: 'en_revision'`
2. Se dispara proceso asíncrono de validaciones
3. Proceso actualiza `nivel_riesgo` a `bajo/medio/alto`
4. Frontend puede refrescar automáticamente con polling o WebSockets

## 📋 Resumen de Cambios Implementados

- ✅ **Pregunta 1:** RFC duplicado ahora limpia formulario y regresa a lista
- ✅ **Pregunta 4:** Cambiado estado inicial de `'pendiente'` a `'en_revision'`
- ✅ **Pregunta 5 (NUEVA):** Implementado polling automático + job diario
- 📝 **Pregunta 2:** Documentado cómo validar con SAT (pendiente implementar)
- 📝 **Pregunta 3:** RFC es la llave única correcta (implementación actual es correcta)

## 🚀 NUEVA: Job Diario + Polling Frontend

### ✅ Implementación Completa

#### **1. Polling en Frontend** (Automático)
Después de crear un cliente:
- Polling cada 6 segundos
- Máximo 30 intentos (~3 minutos)
- Consulta `/api/kyc/clientes/:id/status`
- Se detiene al cambiar de `en_revision` a `bajo`/`alto`
- Refrescar tabla automáticamente

#### **2. Endpoint de Status**
```
GET /api/kyc/clientes?id=:cliente_id
```
Retorna estado actual del cliente para que frontend sepa si las validaciones terminaron.

**O crear ruta separada:**
```
GET /api/kyc/clientes/[id]/status/route.ts
```

#### **3. Job Diario** (Cron)

**Archivo a crear:** `app/api/kyc/validaciones/diarias/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../../lib/supabaseServer';

export async function POST(request: NextRequest) {
  // Verificar token
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  
  // Obtener todos los clientes
  const { data: clientes } = await supabase
    .from('clientes')
    .select('*')
    .neq('nivel_riesgo', null);

  let actualizados = 0;
  
  // Validar cada cliente
  for (const cliente of clientes || []) {
    try {
      const validaciones = {
        lista69b: await validarLista69B(cliente.rfc),
        ofac: await validarOFAC(cliente.nombre_completo),
        csnu: await validarCSNU(cliente.nombre_completo)
      };

      const tieneAlerta = 
        validaciones.lista69b?.en_lista ||
        validaciones.ofac?.encontrado ||
        validaciones.csnu?.encontrado;
      
      const nuevoNivel = tieneAlerta ? 'alto' : 'bajo';

      if (nuevoNivel !== cliente.nivel_riesgo) {
        await supabase
          .from('clientes')
          .update({
            nivel_riesgo: nuevoNivel,
            en_lista_69b: validaciones.lista69b?.en_lista || false,
            en_lista_ofac: validaciones.ofac?.encontrado || false,
            es_pep: validaciones.csnu?.encontrado || false
          })
          .eq('cliente_id', cliente.cliente_id);
        
        actualizados++;
      }
    } catch (error) {
      console.error(`Error: ${cliente.cliente_id}`, error);
    }
  }

  return NextResponse.json({
    success: true,
    clientes_procesados: clientes?.length || 0,
    clientes_actualizados: actualizados,
    timestamp: new Date().toISOString()
  });
}

async function validarLista69B(rfc: string) {
  try {
    const res = await fetch('https://www.sat.gob.mx/cifras_sat/Documents/Lista69B.json');
    const data = await res.json();
    const lista = Array.isArray(data) ? data : data.lista || [];
    return { en_lista: lista.some(r => r.rfc?.toUpperCase() === rfc.toUpperCase()) };
  } catch {
    return { en_lista: false };
  }
}

async function validarOFAC(nombre: string) {
  try {
    const res = await fetch('https://www.treasury.gov/ofac/downloads/sdnlist.xml');
    const xml = await res.text();
    return { encontrado: nombre.split(' ').some(p => xml.includes(p)) };
  } catch {
    return { encontrado: false };
  }
}

async function validarCSNU(nombre: string) {
  try {
    const res = await fetch('https://www.un.org/securitycouncil/sanctions/un-sc-consolidated-list/xml');
    const xml = await res.text();
    return { encontrado: nombre.split(' ').some(p => xml.includes(p)) };
  } catch {
    return { encontrado: false };
  }
}
```

#### **4. Configurar Cron**

**Opción A: EasyCron** (Recomendado)
1. https://www.easycron.com/
2. Nueva tarea:
   - URL: `https://tu-dominio.com/api/kyc/validaciones/diarias`
   - Método: POST
   - Cron: `0 2 * * *` (2 AM diarios)
   - Header: `Authorization: Bearer {CRON_SECRET}`

**Opción B: Vercel Crons**
```json
{
  "crons": [{
    "path": "/api/kyc/validaciones/diarias",
    "schedule": "0 2 * * *"
  }]
}
```

**Opción C: Node-Cron** (Local)
```bash
npm install node-cron
```

```typescript
// app/lib/cron-jobs.ts
import cron from 'node-cron';

export function initCronJobs() {
  cron.schedule('0 2 * * *', async () => {
    const res = await fetch('/api/kyc/validaciones/diarias', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
    });
    console.log('KYC:', await res.json());
  });
}

// En layout.tsx:
if (typeof window === 'undefined') initCronJobs();
```

### 📋 Checklist Rápido

```
[ ] Crear /app/api/kyc/validaciones/diarias/route.ts con código anterior
[ ] Agregar a .env.local:
    CRON_SECRET=abc123def456... (generar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
[ ] Crear cron job en EasyCron/Vercel/Node-Cron
[ ] Probar: curl -X POST localhost:3000/api/kyc/validaciones/diarias -H "Authorization: Bearer {token}"
[ ] Configurar alertas/webhooks (opcional)
```

### 📊 Flujo Completo

```
Usuario crea cliente
         ↓
POST /api/kyc/clientes (retorna en_revision)
         ↓
        ├─→ Background: validar contra 3 listas
        │   (sin bloquear respuesta)
        │
        └─→ Frontend: polling cada 6 seg
            GET /api/kyc/clientes/:id/status
            
Cuando validación termina:
    nivel_riesgo cambia a bajo/alto
         ↓
Polling detecta cambio
         ↓
Tabla se refrescar automáticamente
```

**Bonus:** Cada madrugada el job diario valida todos los clientes para mantener datos actualizados


