# Supabase Configuration Guide - TarantulaHawk

## 🚀 PASOS PARA IMPLEMENTAR EN SUPABASE

### 1. CONFIGURAR TABLAS Y FUNCIONES

#### Paso 1: Ejecutar el Script SQL
1. Ve a tu **Supabase Dashboard**
2. Navega a **SQL Editor**
3. Copia y pega todo el contenido de `supabase-setup.sql`
4. Ejecuta el script completo

#### Paso 2: Verificar que las tablas se crearon
```sql
-- Verifica que las tablas existen
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_profiles', 'user_activity');

-- Verifica que las funciones existen
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('is_trial_active', 'extend_trial', 'log_user_activity');
```

### 2. CONFIGURAR POLÍTICAS DE CONTRASEÑAS

#### En Supabase Dashboard → Authentication → Settings:

**Password Requirements:**
- Minimum Password Length: `8`
- Require Uppercase: `✅ Enabled`
- Require Lowercase: `✅ Enabled` 
- Require Numbers: `✅ Enabled`
- Require Special Characters: `✅ Enabled`

**Security Settings:**
- Enable Captcha: `✅ Enabled`
- Enable Email Confirmations: `✅ Enabled`
- Enable Phone Confirmations: `❌ Disabled`

### 3. CONFIGURAR EMAIL TEMPLATES

#### Confirmation Email Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirma tu cuenta TarantulaHawk</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0f0f0f; color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #ea580c); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #1a1a1a; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 10px 0 0 0; color: white; font-size: 28px;">TarantulaHawk</h1>
            <p style="margin: 5px 0 0 0; color: #ffedd5;">AI-Powered AML Detection</p>
        </div>
        <div class="content">
            <h2 style="color: #ea580c;">¡Bienvenido a TarantulaHawk!</h2>
            <p>Hola <strong>{{ .Email }}</strong>,</p>
            <p>Gracias por registrarte para tu trial gratuito de nuestra plataforma de detección AML con IA.</p>
            <p>Para activar tu cuenta y comenzar tu prueba gratuita, haz clic en el siguiente botón:</p>
            
            <a href="{{ .ConfirmationURL }}" class="button">Confirmar Cuenta</a>
            
            <p><strong>¿Qué incluye tu trial gratuito?</strong></p>
            <ul>
                <li>✅ Acceso completo por 14 días</li>
                <li>✅ Análisis de hasta 1,000 transacciones</li>
                <li>✅ API de detección en tiempo real</li>
                <li>✅ Soporte técnico dedicado</li>
            </ul>
            
            <p>Si no solicitaste esta cuenta, puedes ignorar este email.</p>
            
            <hr style="border: 1px solid #333; margin: 30px 0;">
            
            <p><strong>¿Necesitas ayuda?</strong><br>
            Contacta nuestro equipo de soporte: <a href="mailto:support@tarantulahawk.com" style="color: #ea580c;">support@tarantulahawk.com</a></p>
        </div>
        <div class="footer">
            <p>&copy; 2025 TarantulaHawk. Todos los derechos reservados.</p>
            <p>Plataforma de detección AML con inteligencia artificial</p>
        </div>
    </div>
</body>
</html>
```

#### Password Reset Email Template:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Restablecer contraseña - TarantulaHawk</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0f0f0f; color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #ea580c); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #1a1a1a; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
        .warning { background: #1f2937; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 10px 0 0 0; color: white; font-size: 28px;">TarantulaHawk</h1>
            <p style="margin: 5px 0 0 0; color: #ffedd5;">Restablecer Contraseña</p>
        </div>
        <div class="content">
            <h2 style="color: #ea580c;">Solicitud de Restablecimiento</h2>
            <p>Hola <strong>{{ .Email }}</strong>,</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta TarantulaHawk.</p>
            
            <a href="{{ .ConfirmationURL }}" class="button">Restablecer Contraseña</a>
            
            <div class="warning">
                <p><strong>⚠️ Importante:</strong></p>
                <ul>
                    <li>Este enlace expira en 1 hora</li>
                    <li>Solo puede usarse una vez</li>
                    <li>Si no solicitaste este cambio, ignora este email</li>
                </ul>
            </div>
            
            <p>Por tu seguridad, asegúrate de:</p>
            <ul>
                <li>✅ Usar una contraseña segura (mínimo 8 caracteres)</li>
                <li>✅ Incluir mayúsculas, minúsculas y números</li>
                <li>✅ No compartir tu contraseña con nadie</li>
            </ul>
        </div>
        <div class="footer">
            <p>&copy; 2025 TarantulaHawk. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
```

### 4. CONFIGURAR SMTP

#### En Authentication → Settings → SMTP Settings:
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: tu-email@gmail.com
SMTP Pass: tu-app-password
Sender Email: noreply@tarantulahawk.com
Sender Name: TarantulaHawk
```

### 5. CONFIGURAR VARIABLES DE ENTORNO

#### En Vercel Dashboard → Project Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=tu-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_SITE_URL=https://tarantulahawk.vercel.app
```

### 6. VERIFICAR CONFIGURACIÓN

#### Ejecutar estas consultas para verificar:
```sql
-- Ver estadísticas de usuarios
SELECT * FROM public.user_stats;

-- Ver dominios corporativos
SELECT * FROM public.corporate_domains;

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Verificar triggers
SELECT event_object_table, trigger_name, action_timing, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_schema = 'public';
```

### 7. PROBAR EL FLUJO COMPLETO

1. **Registro de usuario**:
   - Usar email corporativo
   - Contraseña segura (8+ chars, mayúsculas, minúsculas, números, símbolos)
   - Verificar que se crea el perfil automáticamente

2. **Verificación de email**:
   - Revisar bandeja de entrada
   - Hacer clic en enlace de confirmación
   - Verificar que se actualiza `email_confirmed_at`

3. **Validaciones**:
   - Intentar registrarse con Gmail/Outlook (debe fallar)
   - Intentar contraseña débil (debe fallar)
   - Verificar que no se permiten dominios personales

### 8. MONITOREO Y MÉTRICAS

#### Consultas útiles para monitorear:
```sql
-- Usuarios registrados hoy
SELECT COUNT(*) as registros_hoy
FROM auth.users 
WHERE created_at::date = CURRENT_DATE;

-- Trials activos
SELECT COUNT(*) as trials_activos
FROM public.user_profiles 
WHERE trial_active = true AND trial_expires_at > NOW();

-- Dominios más populares
SELECT email_domain, COUNT(*) as usuarios
FROM public.user_profiles 
GROUP BY email_domain 
ORDER BY usuarios DESC 
LIMIT 10;

-- Actividad reciente
SELECT activity_type, COUNT(*) as total
FROM public.user_activity 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY activity_type
ORDER BY total DESC;
```

### 9. TROUBLESHOOTING

#### Problemas comunes:

**Error: "Personal email domains not allowed"**
- ✅ Solución: Está funcionando correctamente, solo permite emails corporativos

**Error: "Company name is required"**
- ✅ Solución: Está funcionando correctamente, requiere nombre de empresa

**Emails no llegan:**
- Verificar configuración SMTP
- Revisar spam/junk folder
- Comprobar límites de rate limiting

**Contraseñas rechazadas:**
- Verificar que cumple todos los requisitos
- Mínimo 8 caracteres
- Incluir mayúsculas, minúsculas, números y símbolos

### 10. PRÓXIMOS PASOS

1. ✅ Configurar MFA (Multi-Factor Authentication)
2. ✅ Implementar dashboard de administración
3. ✅ Configurar alertas de seguridad
4. ✅ Implementar logging avanzado
5. ✅ Configurar backup automático

---

## 📞 SOPORTE

Si tienes problemas con la configuración:
1. Revisa los logs en Supabase Dashboard → Logs
2. Verifica las políticas RLS en Authentication → Policies
3. Contacta soporte si necesitas ayuda adicional

¡La configuración está lista para producción con máxima seguridad! 🔒