# 🎯 EBR Score - Justificación de Criterios de Negocio

**Documento:** Justificación de valores y metodología del Score EBR (Enhanced Based Risk)  
**Fecha:** Enero 2026  
**Sistema:** TarantulaHawk - Compliance LFPIORPI 2025  
**Versión:** 2.0 - Refactorización jerárquica

---

## ⚖️ Aclaración Legal Importante

**LOS VALORES DE SCORE Y RANGOS AQUÍ DEFINIDOS SON CRITERIOS DE NEGOCIO, NO REQUISITOS LEGALES.**

La LFPIORPI 2025 NO establece:
- ❌ Sistemas de puntos obligatorios
- ❌ Valores numéricos específicos de riesgo
- ❌ Rangos de clasificación mandatorios

**Lo que SÍ exige la ley:**
- ✅ Identificar y conocer al cliente (Art. 11-13)
- ✅ Determinar perfil de riesgo (Art. 15)
- ✅ Aplicar medidas reforzadas en casos de alto riesgo (Art. 16)
- ✅ Rechazar operaciones con personas en listas de sanciones (Art. 24)

**Este scoring es una herramienta interna para:**
1. Gestionar recursos de compliance eficientemente
2. Priorizar casos que requieren EDD (Enhanced Due Diligence)
3. Documentar criterios de decisión para auditorías
4. Facilitar explicabilidad de decisiones automatizadas

---

## 📊 Metodología: Enfoque Jerárquico con max()

### ❌ Problema del Sistema Anterior (Aditivo)

```python
# SISTEMA VIEJO (PROBLEMÁTICO):
if en_lista_ofac: score += 30
if en_lista_csnu: score += 30
if en_lista_uif: score += 30
# Total: 90 puntos si está en las 3

# PROBLEMA: Misma persona puede estar en OFAC, CSNU y UIF simultaneamente
# Resultado: Falso positivo (90 vs 30 puntos reales)
```

**Consecuencias:**
- 🚫 **Doble/triple conteo**: Misma sanción reportada 3x
- 🚫 **Inflación de score**: 90 puntos vs 30 puntos reales
- 🚫 **Sin diferenciación**: OFAC = 69B = UIF (conceptos distintos)

### ✅ Solución: Sistema Jerárquico con max()

```python
# SISTEMA NUEVO (JERÁRQUICO):
factor_1 = 0

# Categoría A: Sanciones críticas (30 puntos)
if (en_lista_ofac OR en_lista_csnu OR en_lista_uif_oficial_sat):
    factor_1 = max(factor_1, 30)  # Solo suma 30, no importa cuántas listas

# Categoría B: Riesgo fiscal 69B (25 puntos)
if en_lista_69b_sat:
    factor_1 = max(factor_1, 25)

# Categoría C: PEP (20 puntos)
if es_pep:
    factor_1 = max(factor_1, 20)
```

**Ventajas:**
- ✅ **Sin doble conteo**: Una persona = un puntaje máximo por categoría
- ✅ **Diferenciación clara**: Sanciones (30) > Fiscal (25) > PEP (20)
- ✅ **Jerárquica**: Usa el mayor riesgo aplicable, no suma
- ✅ **Auditable**: Razones[] documenta cuál lista activó el score

---

## 🔢 Justificación de Valores por Factor

## Factor 1: Sanciones y Listas (Máximo 30 puntos)

### Categoría A: Sanciones Críticas Internacionales (30 puntos)

**Listas incluidas:**
- OFAC (Office of Foreign Assets Control - EE.UU.)
- CSNU (Consejo de Seguridad de Naciones Unidas)
- UIF Oficial SAT (Lista de personas bloqueadas por autoridad financiera mexicana)

**Justificación del valor (30 puntos):**
1. **Impacto legal:** Prohibición absoluta de operar (Art. 24 LFPIORPI)
2. **Consecuencias:** Multas hasta $32 millones MXN (Art. 54)
3. **Severidad:** Bloqueo internacional de activos
4. **Respuesta:** Rechazo automático + EDD + Reporte a UIF

**Por qué NO sumamos:**
- Misma persona puede estar en OFAC (por narcotráfico) Y en CSNU (por terrorismo)
- Es LA MISMA sanción reportada por 2 organismos → NO es doble riesgo
- Usar max(30) evita inflación artificial del score

**Requisito de fuente oficial:**
```python
# Debe especificarse la fuente y fecha:
"en_lista_uif_oficial_sat": True,
"en_lista_uif_metadata": {
    "fuente": "Portal SAT/UIF oficial - https://www.sat.gob.mx/...",
    "fecha_consulta": "2026-01-27T10:30:00Z",
    "version_lista": "2026-01",
    "tipo_lista": "personas_bloqueadas"  # Específico
}
```

**Outcome operativo:**
- ✅ Acción: RECHAZAR operación
- ✅ Proceso: EDD completo + Reporte a autoridad
- ✅ Plazo: Inmediato (antes de activar cuenta)

---

### Categoría B: Riesgo Fiscal - Lista 69-B SAT (25 puntos)

**Lista incluida:**
- 69-B SAT (Listado de operaciones presuntamente simuladas - EFOS)

**Justificación del valor (25 puntos):**

**¿Por qué 25 y NO 30 como las sanciones?**

1. **Naturaleza distinta:**
   - 69-B = Riesgo FISCAL (facturas falsas, operaciones simuladas)
   - OFAC/CSNU/UIF = Riesgo PLD/AML (lavado de dinero, terrorismo)
   
2. **Implicaciones diferentes:**
   - 69-B: Cliente puede tener CFDI apócrifos → Validar operación con EDD fiscal
   - Sanciones: Cliente vinculado a crimen organizado → RECHAZAR por ley
   
3. **Tratamiento regulatorio:**
   - LFPIORPI Art. 24: Sanciones = prohibición absoluta
   - 69-B: NO mencionado explícitamente en LFPIORPI → es criterio de riesgo adicional
   
4. **Outcome distinto:**
   - Sanciones (30 pts): Auto-rechazo
   - 69-B (25 pts): EDD fiscal reforzado + validación contraparte, pero NO auto-rechazo

**Por qué es categoría separada:**
- Un cliente puede estar en 69-B por emisión de facturas falsas en 2023
- Pero eso NO significa que esté lavando dinero en 2026
- Requiere análisis contextual, no rechazo automático

**Metadata requerida:**
```python
"en_lista_69b_sat": True,
"en_lista_69b_metadata": {
    "fuente": "Portal SAT - Listado 69B",
    "fecha_consulta": "2026-01-27T10:30:00Z",
    "numero_publicacion": "DOF 2025-07-15",
    "periodo_inclusion": "2023-Q3"  # Cuándo fue incluido
}
```

**Outcome operativo:**
- ✅ Acción: NO auto-rechazar, aplicar EDD fiscal
- ✅ Validaciones adicionales:
  - Verificar CFDI emitidos sean válidos en portal SAT
  - Validar contrapartes NO estén en 69-B
  - Solicitar documentación del origen de recursos
- ✅ Aprobación: Requiere comité de riesgos

---

### Categoría C: PEP - Persona Expuesta Políticamente (20 puntos)

**Justificación del valor (20 puntos):**

1. **Riesgo:** Acceso a recursos públicos, potencial conflicto de interés
2. **Ley:** LFPIORPI NO prohíbe operar con PEPs, pero exige EDD reforzado (Art. 16)
3. **Severidad:** Menor que sanciones (no hay prohibición) pero mayor que cliente normal
4. **Respuesta:** EDD extendido + aprobación gerencial

**Por qué 20 y NO 30:**
- PEP ≠ Criminal (es funcionario público legítimo)
- Requiere más escrutinio, pero NO es sanción
- Outcome: Procesar CON medidas reforzadas, NO rechazar

**Outcome operativo:**
- ✅ Acción: Procesar con EDD extendido
- ✅ Validaciones:
  - Solicitar declaración patrimonial
  - Validar congruencia ingresos vs patrimonio
  - Monitoreo continuo de operaciones
- ✅ Aprobación: Gerencia de compliance

---

## Factor 2: Actividad Económica (Máximo 25 puntos)

**Base legal:** Artículo 17 LFPIORPI - Actividades Vulnerables Designadas

| Actividad | Puntos | Fracción LFPIORPI | Justificación |
|-----------|--------|-------------------|---------------|
| **Casinos/Juegos** | 25 | Art. 17, fracc. III | Mayor incidencia lavado según GAFI |
| **Criptomonedas** | 25 | Art. 17, fracc. XIII | Anonimato, transfronterizo, volatilidad |
| **Préstamos** | 22 | Art. 17, fracc. XII | Estructuración, fronting |
| **Joyería/Metales** | 20 | Art. 17, fracc. IV | Alta liquidez, fácil transporte |
| **Vehículos** | 20 | Art. 17, fracc. VI | Aéreos/marítimos, alta transferibilidad |
| **Inmobiliario** | 18 | Art. 17, fracc. V | Inversión lavado tradicional |
| **Arte/Antigüedades** | 18 | Art. 17, fracc. VII | Valoración subjetiva, opacidad |
| **Comercio Exterior** | 15 | Art. 17, fracc. VIII | TBML (Trade-Based Money Laundering) |
| **Blindaje** | 15 | Art. 17, fracc. X | Potencial vínculo con inseguridad |
| **Otras** | 5 | N/A | Riesgo base |

**Metodología:**
- Valores basados en reportes GAFI (Grupo de Acción Financiera Internacional)
- Priorización según incidencia histórica en reportes UIF México
- Revisión anual según estadísticas de la institución

---

## Factor 3: Tipo de Persona (Máximo 15 puntos)

| Escenario | Puntos | Justificación |
|-----------|--------|---------------|
| **Persona Moral SIN beneficiario controlador** | 15 | Opacidad máxima, incumple Art. 13 LFPIORPI |
| **Persona Moral CON beneficiario controlador** | 8 | Estructura corporativa = mayor complejidad |
| **Persona Física** | 3 | Trazabilidad directa, menor opacidad |

**Razón del delta (15 vs 8 vs 3):**
- **Art. 13 LFPIORPI:** Obliga a identificar beneficiario controlador final
- Sin beneficiario = incumplimiento regulatorio + riesgo shell company
- Con beneficiario = cumplimiento pero aún más complejo que persona física

---

## Factor 4: Origen de Recursos (Máximo 20 puntos)

| Origen | Puntos | Justificación |
|--------|--------|---------------|
| **Desconocido** | 20 | Sin documentación, imposible validar licitud |
| **Efectivo de negocio** | 15 | Difícil trazabilidad, común en esquemas de lavado |
| **Préstamo tercero** | 12 | Requiere verificar contraparte y finalidad |
| **Herencia** | 8 | Documentable pero requiere validación testamentaria |
| **Actividad profesional** | 5 | Comprobable con declaraciones fiscales |
| **Salario** | 3 | Trazabilidad alta (nómina, CFDI) |

**Por qué importa:**
- Origen no documentado = imposible cumplir EDD
- Efectivo dificulta rastreo (structuring risk)
- Criterio alineado con Art. 11 LFPIORPI: "conocer al cliente"

---

## Factor 5: Ubicación Geográfica (Máximo 10 puntos)

| Ubicación | Puntos | Justificación |
|-----------|--------|---------------|
| **Estados alto riesgo** | 10 | Sinaloa, Michoacán, Guerrero, Tamaulipas, Jalisco |
| **Otros estados** | 2 | Riesgo base nacional |

**Fuentes:**
- Reporte Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP)
- Mapa de incidencia delictiva relacionada con delitos federales
- Actualización trimestral según cambios en incidencia

**No es discriminación geográfica:**
- NO se rechaza por estado
- Solo se incrementa nivel de escrutinio documental
- Alineado con enfoque basado en riesgo (Art. 15 LFPIORPI)

---

## Factor 6: Monto Mensual (Máximo 10 puntos)

| Rango | Puntos | Justificación |
|-------|--------|---------------|
| **≥ $500,000 MXN** | 10 | Alto impacto potencial, requiere validación reforzada |
| **$200,000 - $499,999** | 7 | Monto significativo, EDD básico |
| **$100,000 - $199,999** | 5 | Monitoreo estándar reforzado |
| **< $100,000** | 2 | Riesgo bajo por impacto |

**Criterio:**
- NO es umbral de aviso (esos están en Art. 23)
- Es estimación de **monto mensual acumulado**
- A mayor monto, mayor impacto si hay problema → mayor recursos de compliance

---

## 🎯 Rangos de Clasificación y Outcomes Operativos

### Score 0-29: RIESGO BAJO
**Acción:** Procesar normal - Monitoreo estándar
- ✅ Onboarding: Documentación básica (INE, comprobante domicilio)
- ✅ Monitoreo: Alertas automáticas estándar
- ✅ Revisión: Anual
- ⏱️ Plazo: Sin demoras adicionales

**Ejemplo:** Persona física, salario, Ciudad de México, $50K mensual, sin listas

---

### Score 30-49: RIESGO MEDIO
**Acción:** EDD básico - Revisión documental reforzada
- ✅ Onboarding: + Comprobante ingresos, declaración fiscal
- ✅ Monitoreo: Alertas sensibilizadas (umbral más bajo)
- ✅ Revisión: Semestral
- ⏱️ Plazo: +1-2 días para validación

**Ejemplo:** Persona moral con beneficiario, comercio exterior, $150K mensual, sin listas

---

### Score 50-79: RIESGO ALTO
**Acción:** EDD extendido - Aprobación gerencial requerida
- ✅ Onboarding: + Estados financieros, validación contrapartes, visita domiciliaria
- ✅ Monitoreo: Revisión manual periódica
- ✅ Aprobación: Gerencia de compliance (firma requerida)
- ✅ Revisión: Trimestral
- ⏱️ Plazo: +3-5 días para análisis

**Ejemplo:** PEP, actividad vulnerable (joyería), Sinaloa, $300K mensual

---

### Score 80-100: RIESGO CRÍTICO
**Acción:** Pausar/Rechazar - Análisis especializado + Comité de riesgos
- ✅ Onboarding: Congelado hasta dictamen de comité
- ✅ Análisis: Especialista AML + Legal + Riesgos
- ✅ Aprobación: Comité de riesgos (C-Level)
- ✅ Monitoreo: Manual continuo si se aprueba
- ⏱️ Plazo: +7-15 días para dictamen

**Ejemplo:** En lista 69B, persona moral sin beneficiario, efectivo, Tamaulipas, $600K mensual

---

### Score = 30 por Factor 1 (Sanciones): RECHAZO AUTOMÁTICO
**Acción:** RECHAZAR - Match en sanciones OFAC/CSNU/UIF + EDD + Reporte regulador
- ❌ **NO procesar** bajo ninguna circunstancia (Art. 24 LFPIORPI)
- ✅ **Reportar a UIF:** Aviso inmediato (24h) por Art. 24
- ✅ **EDD forense:** Investigar si hay más vínculos
- ✅ **Documentar:** Razones del rechazo para auditoría
- ⚖️ **Base legal:** Prohibición absoluta, multa hasta $32M MXN

**Ejemplo:** Match en OFAC por narcotráfico

---

## 🔍 Explicabilidad y Auditoría

### Array de Razones (razones_explicabilidad)

Cada cliente tiene un array de strings explicando por qué tiene ese score:

```json
{
  "score_ebr": 68,
  "nivel_riesgo": "alto",
  "razones_explicabilidad": [
    "Factor 1 (25 pts): Lista 69-B SAT - EFOS (riesgo fiscal, pub: DOF 2025-07-15)",
    "Factor 2 (22 pts): Actividad vulnerable - prestamos",
    "Factor 3 (15 pts): Persona moral SIN beneficiario controlador identificado",
    "Factor 4 (8 pts): Origen recursos - herencia"
  ]
}
```

**Uso de razones:**
1. **Auditoría interna:** Por qué se clasificó así
2. **Reguladores:** Demostrar criterios objetivos
3. **LLMs/AI:** Contexto para decisiones automatizadas
4. **Cliente (si aplica):** Transparencia en proceso

---

## 📋 Trazabilidad y Metadata Requerida

### Para Listas Oficiales

Cada flag de lista DEBE acompañarse de metadata:

```python
{
  "en_lista_uif_oficial_sat": True,
  "en_lista_uif_metadata": {
    "fuente": "Portal SAT/UIF - https://www.sat.gob.mx/aplicacion/operacion/31274/...",
    "fecha_consulta": "2026-01-27T10:30:00Z",
    "version_lista": "2026-01",
    "tipo_lista": "personas_bloqueadas",
    "match_score": 0.98,  # Nivel de confianza del match
    "match_campo": "curp"  # Campo que matcheó (RFC, CURP, nombre)
  },
  
  "en_lista_69b_sat": True,
  "en_lista_69b_metadata": {
    "fuente": "Portal SAT - Listado 69B Definitivo",
    "url_publicacion": "https://www.sat.gob.mx/...",
    "fecha_consulta": "2026-01-27T10:30:00Z",
    "numero_publicacion": "DOF 2025-07-15",
    "periodo_inclusion": "2023-Q3",
    "rfc_publicado": "AAA010101AAA"
  }
}
```

**Por qué es crítico:**
1. **Auditoría:** Demostrar fecha y versión de lista consultada
2. **Reproducibilidad:** Poder verificar match en momento histórico
3. **Defensibilidad:** Si cliente alega falso positivo
4. **Regulatorio:** Cumplir estándares de documentación

---

## 🚨 Casos Especiales y Excepciones

### Caso 1: Match en OFAC pero cliente insiste es error

**Proceso:**
1. ❌ **NO procesar** hasta resolver (prohibición legal)
2. ✅ **Solicitar al cliente:** Evidencia de NO ser la persona sancionada
3. ✅ **Validar:** Comparar fecha nacimiento, lugar, alias
4. ✅ **Consultar:** Proveedor de listas (World-Check, Dow Jones) para detalles
5. ✅ **Documentar:** Análisis completo incluso si se descarta match
6. ✅ **Decisión:** Solo comité C-Level puede aprobar si hay duda razonable

**Conservador:** Ante duda, NO procesar

---

### Caso 2: Match en 69-B pero cliente salió del listado hace 6 meses

**Proceso:**
1. ✅ **Verificar:** Consultar SAT para confirmar exclusión
2. ✅ **Metadata:** Actualizar con fecha de exclusión
```python
"en_lista_69b_sat": False,
"en_lista_69b_metadata": {
  "fuente": "Portal SAT",
  "fecha_consulta": "2026-01-27T10:30:00Z",
  "estuvo_en_lista": True,
  "fecha_inclusion": "2023-07-15",
  "fecha_exclusion": "2025-07-20",  # Salió hace 6 meses
  "razon_exclusion": "Desvirtuó presunción ante SAT"
}
```
3. ✅ **Score:** NO aplica los 25 puntos (ya no está en lista)
4. ✅ **EDD adicional:** Validar resolución favorable de SAT
5. ✅ **Monitoreo:** Semestral para verificar que no regrese a lista

**Criterio:** Lista vigente = riesgo actual. Exclusión = riesgo resuelto.

---

### Caso 3: PEP de bajo nivel (regidor municipal)

**Debate:** ¿20 puntos es excesivo para un regidor?

**Respuesta:**
- Score NO diferencia nivel de PEP (por simplicidad operativa)
- Pero outcome SÍ:
  - Regidor municipal → EDD básico (solicitar declaración patrimonial)
  - Secretario de Estado → EDD extendido + comité
- **Criterio:** El score pone "bandera roja", el análisis humano ajusta profundidad

**Recomendación futura:** Subdividir PEP en niveles (nacional/estatal/municipal)

---

## 📌 Resumen Ejecutivo - Tabla de Decisión Rápida

| Factor | Max Pts | Criterio Máximo | Outcome |
|--------|---------|-----------------|---------|
| **Factor 1: Sanciones** | 30 | OFAC/CSNU/UIF oficial | ❌ RECHAZAR |
| **Factor 1: Fiscal** | 25 | Lista 69-B SAT | ⚠️ EDD fiscal |
| **Factor 1: PEP** | 20 | Funcionario público | ⚠️ EDD extendido |
| **Factor 2** | 25 | Casino/Cripto | ⚠️ Validación actividad |
| **Factor 3** | 15 | PM sin beneficiario | ⚠️ EDD corporativo |
| **Factor 4** | 20 | Origen desconocido | ⚠️ Solicitar documentación |
| **Factor 5** | 10 | Estado alto riesgo | ⚠️ Validación local |
| **Factor 6** | 10 | ≥ $500K mensual | ⚠️ Monitoreo reforzado |

**Total máximo teórico:** 100 puntos (cap automático)

---

## 📝 Documento de Soporte

Este documento debe leerse junto con:
- **REGLAS_LFPIORPI_EXPLICABILIDAD.md:** Reglas legales (Art. 23, 24, 32)
- **Código fuente:** `validador_lfpiorpi_2025.py` - método `calcular_ebr_cliente()`
- **LFPIORPI 2025:** Texto oficial del Diario Oficial de la Federación

---

## 🔄 Control de Cambios

| Versión | Fecha | Cambio | Justificación |
|---------|-------|--------|---------------|
| 1.0 | 2025-07 | Sistema aditivo inicial | Primera implementación |
| **2.0** | **2026-01-27** | **Refactorización jerárquica con max()** | Eliminar doble conteo, diferenciar categorías, añadir explicabilidad |

---

## ✅ Validación y Aprobación

**Elaboró:** Equipo de Compliance y Tecnología  
**Revisó:** Gerencia de Riesgos  
**Aprobó:** [Pendiente] Comité de Riesgos C-Level  

**Próxima revisión:** Julio 2026 (semestral)

---

**FIN DEL DOCUMENTO**
