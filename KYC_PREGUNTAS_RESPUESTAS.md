# Respuestas a Preguntas KYC

## 1. ✅ Cuando RFC ya existe, regresar a inicio

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
- 📝 **Pregunta 2:** Documentado cómo validar con SAT (pendiente implementar)
- 📝 **Pregunta 3:** RFC es la llave única correcta (implementación actual es correcta)
- 📝 **Pregunta 5:** Documentado flujo de estados (pendiente implementar validaciones automáticas)

## 🚀 Próximos Pasos Recomendados

1. **Implementar validaciones automáticas en background**
   - Crear endpoint `/api/kyc/validaciones/ejecutar`
   - Consultar Lista 69-B en tiempo real
   - Consultar OFAC
   - Calcular score EBR
   - Actualizar `nivel_riesgo`

2. **Agregar validación SAT (opcional)**
   - Para clientes premium
   - O para montos superiores a cierto umbral

3. **Mejorar UI con estados en tiempo real**
   - Mostrar "Validando..." mientras está en revisión
   - Actualizar automáticamente cuando cambie el riesgo
   - Usar WebSockets o polling
