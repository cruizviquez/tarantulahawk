# 🤖 AI Anomaly Detection System - Configuration Guide

## Overview
TarantulaHawk utiliza un sistema de AI para monitorear actividad inusual y detectar posibles ataques en tiempo real.

---

## ✅ Pasos de Configuración

### 1. **Configurar Magic Link a 10 Minutos en Supabase**

#### En Supabase Dashboard:
1. Ve a **Authentication → Settings**
2. Busca **"Mailer autoconfirm"** o **"Email settings"**
3. **OTP expiration**: Cambiar de `3600` segundos a `600` segundos (10 minutos)

```bash
# Configuración recomendada:
OTP Expiration: 600 segundos (10 minutos)
OTP Length: 6 dígitos (opcional para OTP numérico)
```

#### Configuración Avanzada (SQL):
Si necesitas configurarlo vía SQL:

```sql
-- Actualizar configuración de Supabase Auth
-- Nota: Esto requiere acceso directo a la base de datos de auth
UPDATE auth.config
SET otp_expiration = 600 -- 10 minutos
WHERE key = 'otp_expiration';
```

---

### 2. **Configurar Redirect URLs para Magic Link**

En **Supabase Dashboard → Authentication → URL Configuration**:

#### Development:
```
http://localhost:3000/auth/callback
```

#### Production:
```
https://tudominio.com/auth/callback
https://www.tudominio.com/auth/callback
```

#### Site URL:
```
Production: https://tudominio.com
Development: http://localhost:3000
```

---

### 3. **Personalizar Email Template para Magic Link**

En **Supabase Dashboard → Authentication → Email Templates → Magic Link**:

#### Subject:
```
Tu enlace de acceso seguro a TarantulaHawk ⏱️ (Expira en 10 min)
```

#### Body (HTML):
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #CC3300;">🔐 Acceso Seguro a TarantulaHawk</h2>
  
  <p>Hola,</p>
  
  <p>Haz clic en el siguiente botón para acceder a tu cuenta:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{ .ConfirmationURL }}" 
       style="background: linear-gradient(to right, #CC3300, #FF6B00); 
              color: white; 
              padding: 15px 30px; 
              text-decoration: none; 
              border-radius: 8px; 
              font-weight: bold;
              display: inline-block;">
      Acceder a mi Cuenta
    </a>
  </div>
  
  <div style="background-color: #FFF3CD; 
              border-left: 4px solid #FFC107; 
              padding: 15px; 
              margin: 20px 0;">
    <h3 style="margin: 0 0 10px 0; color: #856404;">⏱️ Seguridad Mejorada</h3>
    <ul style="margin: 0; padding-left: 20px; color: #856404;">
      <li><strong>Este enlace expira en 10 minutos</strong></li>
      <li>Solo puede usarse una vez</li>
      <li>No requiere contraseña</li>
      <li>Si no solicitaste este acceso, ignora este email</li>
    </ul>
  </div>
  
  <p style="color: #6c757d; font-size: 12px;">
    Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
    <a href="{{ .ConfirmationURL }}" style="color: #00CED1;">{{ .ConfirmationURL }}</a>
  </p>
  
  <hr style="border: 0; border-top: 1px solid #dee2e6; margin: 30px 0;">
  
  <p style="color: #6c757d; font-size: 11px;">
    Este email fue enviado por TarantulaHawk AML Platform.<br>
    Sistema de monitoreo AI detecta actividad inusual automáticamente.
  </p>
</div>
```

---

### 4. **Ejecutar Migración de AI Anomaly Detection**

En **Supabase SQL Editor**, ejecuta:

```sql
-- Archivo: supabase/migrations/20251026020000_ai_anomaly_detection.sql
-- (Copia y pega el contenido completo del archivo)
```

Esto creará:
- ✅ Tabla `audit_logs` mejorada
- ✅ Vista `anomaly_summary` para dashboard de admin
- ✅ Funciones AI: `get_user_activity_timeline()`, `get_suspicious_activity()`
- ✅ Trigger automático: `trigger_security_alert()` 

---

### 5. **Variables de Entorno**

Asegúrate de tener estas variables en `.env.local`:

```bash
# Supabase (requeridas)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # ⚠️ NUNCA exponer en cliente

# Session Timeout (opcional - default: 15 min)
SESSION_INACTIVITY_TIMEOUT=900000 # 15 minutos en milisegundos

# AI Alert Settings (opcional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/... # Para alertas en Slack
ADMIN_EMAIL=admin@tudominio.com # Para alertas por email
```

---

## 🤖 Cómo Funciona el AI Anomaly Detection

### **Reglas de Detección:**

#### 1. **Excessive Activity (Bot Detection)**
```
Trigger: > 30 acciones en 15 minutos
Action: Auto-alerta a admins + log en audit_logs con status='warning'
Risk Score: +30 puntos
```

#### 2. **Multiple IPs (Account Compromise)**
```
Trigger: > 3 IPs diferentes en 15 minutos
Action: Auto-alerta + posible suspensión temporal
Risk Score: +30 puntos
```

#### 3. **Rapid-Fire Actions (Automated Attack)**
```
Trigger: Acciones < 500ms de diferencia
Action: Auto-alerta + CAPTCHA adicional en próximo login
Risk Score: +20 puntos
```

#### 4. **Unusual Hours Activity**
```
Trigger: > 10 acciones entre 2 AM - 5 AM
Action: Log como sospechoso (puede ser legítimo para usuarios internacionales)
Risk Score: +10 puntos
```

### **Risk Score Calculation:**
```
0-20:   ✅ Normal
21-50:  ⚠️ Suspicious (monitor)
51-70:  🚨 High Risk (alert admins)
71-100: 🔥 Critical (auto-suspend + admin alert)
```

---

## 📊 Dashboard de Admin - Monitoreo AI

### **Ver Actividad Sospechosa:**

```sql
-- Query para admins en Supabase:
SELECT * FROM get_suspicious_activity();
```

Retorna:
- `user_id`: Usuario sospechoso
- `email`: Email del usuario
- `total_actions_24h`: Cantidad de acciones en 24 horas
- `unique_ips_24h`: IPs únicas usadas
- `warnings_24h`: Alertas generadas
- `risk_score`: Puntaje de riesgo (0-100)

### **Ver Timeline de Usuario:**

```sql
SELECT * FROM get_user_activity_timeline('user-uuid-here', 24);
```

Retorna:
- `action`: Tipo de acción
- `ip_address`: IP usada
- `created_at`: Timestamp
- `time_since_last_action`: Tiempo desde acción anterior (detecta rapid-fire)

---

## 🔔 Alertas Automáticas

### **Integración con Slack (Opcional):**

Crear endpoint en `/api/alerts/slack/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { user_id, action, risk_score, metadata } = await request.json();
  
  const slackMessage = {
    text: `🚨 Security Alert - Risk Score: ${risk_score}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*User:* ${user_id}\n*Action:* ${action}\n*Risk:* ${risk_score}/100`
        }
      }
    ]
  };

  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackMessage)
  });

  return NextResponse.json({ success: true });
}
```

---

## 🧪 Testing del Sistema

### **Test 1: Simular Bot (Excessive Activity)**
```bash
# En terminal, hacer 40 requests rápidos:
for i in {1..40}; do
  curl -X POST http://localhost:3000/api/audit/activity \
    -H "Content-Type: application/json" \
    -d '{"user_id":"test-user","action":"test_bot","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","path":"/dashboard","user_agent":"curl/7.0"}' &
done
```

**Esperado**: Alerta automática generada después de 30 requests

### **Test 2: Inactividad y Auto-Logout**
1. Login al dashboard
2. No mover mouse ni teclado por 13 minutos
3. Modal de warning debe aparecer a los 13 minutos
4. Auto-logout a los 15 minutos si no hay interacción

### **Test 3: Magic Link Expiration**
1. Solicitar Magic Link
2. Esperar 11 minutos
3. Intentar usar el enlace
4. **Esperado**: "El enlace ha expirado" error

---

## 📈 Métricas Recomendadas

### **Dashboard de Admin debe mostrar:**

1. **Usuarios Activos Ahora**: COUNT de sesiones en últimos 15 min
2. **Alertas Hoy**: COUNT de `status='warning'` en últimas 24h
3. **Top 10 Usuarios por Actividad**: Ordenados por total_actions
4. **Gráfico de Actividad**: Por hora, últimas 24h
5. **Mapa de IPs**: Geographic distribution (con API de GeoIP)

---

## ✅ Checklist Final

- [ ] Magic Link configurado a 10 minutos en Supabase
- [ ] Redirect URLs agregadas en Supabase
- [ ] Email template personalizado con advertencia de 10 min
- [ ] Migración `20251026020000_ai_anomaly_detection.sql` ejecutada
- [ ] `SessionMonitor` component agregado al dashboard
- [ ] Variables de entorno configuradas
- [ ] Test de inactividad (15 min auto-logout) validado
- [ ] Test de Magic Link expiration (10 min) validado
- [ ] Dashboard de admin puede ver `get_suspicious_activity()`
- [ ] (Opcional) Slack webhook configurado para alertas

---

## 🚨 Respuesta a Incidentes

### **Si el AI detecta anomalía:**

1. **Auto-generado**: Log en `audit_logs` con `status='warning'`
2. **Notification**: Admin recibe alerta (Slack/Email)
3. **Action**: Admin revisa dashboard y decide:
   - ✅ **Falso Positivo**: Ignorar o whitelistear usuario
   - 🚨 **Ataque Real**: Suspender cuenta temporalmente
   - 🔥 **Crítico**: Suspender permanentemente + reportar

### **Comandos SQL de Emergencia:**

```sql
-- Suspender usuario sospechoso
UPDATE public.profiles
SET api_access_enabled = false,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{suspended}',
      'true'::jsonb
    )
WHERE id = 'user-uuid-here';

-- Ver todas las alertas del usuario
SELECT * FROM public.audit_logs
WHERE user_id = 'user-uuid-here'
  AND status IN ('warning', 'error')
ORDER BY created_at DESC;
```

---

## 🎯 Próximos Pasos (Mejoras Futuras)

1. **Machine Learning Avanzado**: Entrenar modelo con TensorFlow.js para detectar patrones más complejos
2. **Geographic Anomaly Detection**: Detectar logins desde países imposibles en corto tiempo
3. **Behavioral Biometrics**: Analizar patrones de tipeo y movimiento de mouse
4. **2FA Adaptativo**: Requerir 2FA cuando risk_score > 50
5. **Rate Limiting Dinámico**: Ajustar límites según risk score del usuario

---

**¿Dudas?** Revisa `SECURITY_CHECKLIST.md` para más detalles de seguridad.
