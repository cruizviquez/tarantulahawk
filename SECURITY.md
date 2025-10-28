# Arquitectura de Seguridad - TarantulaHawk Portal

## 🔒 Capas de Seguridad

### 1. **Middleware de Autenticación** (Edge Layer)
**Archivo:** `/middleware.ts`

#### Protección de Rutas
- ✅ **Dashboard, Admin, Settings**: Requieren sesión válida
- ✅ **Rutas de Auth**: Permitidas sin interferencia (evita loops)
- ✅ **Token Expiration Check**: Valida que JWT no esté expirado
- ✅ **Admin Gate**: Solo usuarios con `role='admin'` acceden a `/admin`

#### Flujo de Validación
```typescript
1. Usuario intenta acceder a /dashboard
2. Middleware verifica cookies: sb-access-token + sb-refresh-token
3. Si NO hay cookies:
   - Verifica si viene de flujo de auth (referer de Supabase)
   - Si viene de auth → permite (para procesar hash tokens)
   - Si NO viene de auth → redirige a /?auth=required
4. Si HAY cookies:
   - Decodifica JWT y verifica expiración
   - Si expirado → redirige a /?auth=expired
   - Si válido → permite acceso
```

### 2. **Autenticación en APIs** (API Layer)
**Archivo:** `/app/lib/api-auth.ts`

#### Funciones de Seguridad

##### `getAuthenticatedUserId()`
- Verifica sesión de Supabase en server-side
- Retorna `userId` si autenticado, `null` si no
- **Uso:** Primera línea de defensa en todos los API routes

##### `checkUserBalance(userId, amount)`
- Verifica que el usuario tenga fondos suficientes
- Previene uso de servicios ML sin pago
- **Uso:** Antes de ejecutar análisis costosos

##### `deductBalance(userId, amount)`
- Deduce saldo de la cuenta del usuario
- Transacción atómica (verifica saldo antes de deducir)
- **Uso:** Después de análisis exitoso

##### `logAuditEvent(userId, action, metadata, ...)`
- Registra eventos en `audit_logs` table
- Cumplimiento LFPIORPI (regulatorio México)
- **Uso:** Registrar todas las acciones críticas

### 3. **Rate Limiting** (Request Layer)
**Archivo:** `/middleware.ts` (sección de rate limiting)

#### Límites por Tier
- **Free**: 10 requests/hora
- **Paid**: 100 requests/hora  
- **Enterprise**: 10,000 requests/hora

#### Implementación
- **Producción**: Upstash Redis (rate limiter distribuido)
- **Desarrollo**: Deshabilitado (NODE_ENV check)
- **Headers**: X-RateLimit-* en respuesta para transparencia

### 4. **Row-Level Security (RLS)** (Database Layer)
**Archivo:** `/supabase/migrations/20250129000000_security_infrastructure.sql`

#### Políticas de Acceso
```sql
-- Usuarios solo ven sus propios perfiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Usuarios solo ven sus propios audit logs
CREATE POLICY "Users can view own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Usuarios solo ven sus propias API keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 🛡️ Protección contra Amenazas

### Amenaza 1: **Uso No Autorizado de Modelos ML**
**Riesgo:** Usuarios sin cuenta o con cuentas falsas intentan usar el análisis

**Protección:**
1. ✅ Middleware bloquea acceso a `/dashboard` sin sesión válida
2. ✅ API routes verifican `getAuthenticatedUserId()` antes de procesar
3. ✅ `checkUserBalance()` previene análisis sin fondos
4. ✅ Rate limiting previene abuso masivo

**Ejemplo de API Protegida:**
```typescript
// /app/api/ml/analyze/route.ts
export async function POST(request: NextRequest) {
  // 1. Verificar autenticación
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verificar fondos
  const cost = calculateTieredCost(transactions); // from app/lib/pricing
  const hasBalance = await checkUserBalance(userId, cost);
  if (!hasBalance) {
    return NextResponse.json({ error: 'Insufficient Funds' }, { status: 402 });
  }

  // 3. Ejecutar análisis ML (solo si pasa validaciones)
  const results = await runMLAnalysis(data);

  // 4. Deducir saldo
  await deductBalance(userId, cost);

  // 5. Registrar auditoría
  await logAuditEvent(userId, 'ml_analysis', { cost, transactions });

  return NextResponse.json({ results });
}
```

### Amenaza 2: **Cuentas Falsas / Bots**
**Riesgo:** Registros masivos automatizados para obtener créditos gratis

**Protección:**
1. ✅ Cloudflare Turnstile CAPTCHA en registro
2. ✅ Email verification obligatoria (Magic Link)
3. ✅ Rate limiting por IP (10 requests/hora tier free)
4. ✅ Audit logs rastrean todos los registros

**Flujo de Registro Seguro:**
```
1. Usuario completa formulario con CAPTCHA
2. Cloudflare Turnstile valida (anti-bot)
3. Supabase envía Magic Link al email
4. Usuario debe confirmar email para activar cuenta
5. Profile se crea con $500 de crédito inicial
6. Audit log registra: IP, user agent, timestamp
```

### Amenaza 3: **Scraping / Data Exfiltration**
**Riesgo:** Extracción masiva de datos de análisis

**Protección:**
1. ✅ RLS en Supabase: Usuarios solo ven sus propios datos
2. ✅ Rate limiting previene requests masivos
3. ✅ API keys solo para tier Enterprise
4. ✅ Audit logs rastrean descargas de reportes

### Amenaza 4: **Session Hijacking**
**Riesgo:** Robo de tokens de sesión

**Protección:**
1. ✅ HTTPOnly cookies (no accesibles desde JavaScript)
2. ✅ Secure cookies (solo HTTPS en producción)
3. ✅ Session expiration (15 min de inactividad)
4. ✅ Token expiration check en middleware
5. ✅ Refresh token rotation automática (Supabase)

### Amenaza 5: **SQL Injection**
**Riesgo:** Inyección de SQL malicioso

**Protección:**
1. ✅ Supabase ORM (consultas parametrizadas)
2. ✅ RLS policies (no se puede bypass con SQL)
3. ✅ Service role key solo en server-side
4. ✅ Anon key con permisos limitados en client

---

## 📊 Auditoría y Compliance (LFPIORPI)

### Eventos Auditados
Todos los eventos se registran en la tabla `audit_logs`:

- ✅ **registration** - Nuevo usuario registrado
- ✅ **login_attempt** - Intento de login (éxito/fallo)
- ✅ **logout** - Usuario cerró sesión
- ✅ **ml_analysis_attempt** - Intento de análisis (con/sin fondos)
- ✅ **ml_analysis_completed** - Análisis completado exitosamente
- ✅ **ml_analysis_error** - Error en análisis
- ✅ **balance_deducted** - Saldo deducido
- ✅ **report_downloaded** - Reporte descargado
- ✅ **xml_generated** - XML para UIF generado
- ✅ **api_key_created** - API key generada (Enterprise)
- ✅ **api_key_revoked** - API key revocada

### Consulta de Auditoría
```sql
-- Ver todos los análisis de un usuario
SELECT * FROM audit_logs 
WHERE user_id = 'USER_UUID' 
  AND action LIKE 'ml_analysis%'
ORDER BY created_at DESC;

-- Ver intentos de acceso no autorizado
SELECT * FROM audit_logs 
WHERE action = 'ml_analysis_attempt'
  AND status = 'failure'
  AND metadata->>'reason' = 'unauthenticated'
ORDER BY created_at DESC;
```

---

## 🚀 Deployment Checklist

### Antes de Producción

- [ ] **Revertir Supabase Site URL** de Codespaces a producción
- [ ] **Configurar Upstash Redis** (rate limiting en prod)
- [ ] **Habilitar HTTPS only** en cookies
- [ ] **Configurar CORS** restrictivo (solo dominio propio)
- [ ] **Revisar RLS policies** en Supabase
- [ ] **Habilitar email confirmations** obligatorias
- [ ] **Configurar Cloudflare Turnstile** keys de producción
- [ ] **Limitar IP por región** (opcional: solo México)
- [ ] **Configurar monitoring** (Sentry, LogRocket, etc.)
- [ ] **Backup de base de datos** automatizado

### Variables de Entorno Críticas

```bash
# Supabase (autenticación)
NEXT_PUBLIC_SUPABASE_URL=https://XXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJXXX...
SUPABASE_SERVICE_ROLE_KEY=eyJXXX... # Solo server-side!

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://XXX.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXX...

# Cloudflare Turnstile (CAPTCHA)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAXXXXXXXX
TURNSTILE_SECRET_KEY=0x4BBXXXXXXXX

# PayPal (pagos)
NEXT_PUBLIC_PAYPAL_CLIENT_ID=AXX...
PAYPAL_SECRET=EXX... # Solo server-side!

# Backend de ML (Python)
NEXT_PUBLIC_BACKEND_API_URL=https://api.tarantulahawk.ai
```

---

## 🧪 Testing de Seguridad

### Test 1: Acceso No Autorizado
```bash
# Intentar acceder a dashboard sin sesión
curl -I https://tarantulahawk.ai/dashboard
# Debe redirigir a /?auth=required
```

### Test 2: API sin Autenticación
```bash
# Intentar usar API de ML sin token
curl -X POST https://tarantulahawk.ai/api/ml/analyze \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.csv"
# Debe retornar 401 Unauthorized
```

### Test 3: Rate Limiting
```bash
# Hacer 11 requests consecutivos
for i in {1..11}; do
  curl -I https://tarantulahawk.ai/api/usage
done
# Request 11 debe retornar 429 Rate Limit Exceeded
```

### Test 4: Token Expirado
```bash
# Usar un token expirado en cookie
curl -b "sb-access-token=EXPIRED_TOKEN" \
  https://tarantulahawk.ai/dashboard
# Debe redirigir a /?auth=expired
```

---

## 📚 Recursos

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [LFPIORPI Compliance Guide](https://www.cnbv.gob.mx/)
- [Next.js Middleware Security](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

**Última actualización:** 2025-10-27  
**Versión:** 1.0  
**Mantenedor:** TarantulaHawk Security Team
