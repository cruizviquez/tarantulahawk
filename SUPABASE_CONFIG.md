# 🔧 Configuración de Supabase para TarantulaHawk

## 📧 **1. Configurar Emails Personalizados**

### En tu Dashboard de Supabase:

1. **Ve a Authentication > Email Templates**
2. **Configura cada template:**

#### **Confirm Signup Template:**
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
            <h1 style="margin: 0; color: white;">🕷️🦅 TarantulaHawk</h1>
            <p style="margin: 5px 0 0 0; color: #ffedd5;">AI-Powered AML Detection</p>
        </div>
        <div class="content">
            <h2 style="color: #ea580c;">¡Bienvenido a TarantulaHawk!</h2>
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

#### **Configuración del Sender:**
- **From Email:** `noreply@tarantulahawk.com` 
- **From Name:** `TarantulaHawk Team`
- **Reply To:** `support@tarantulahawk.com`

## 🏢 **2. Configurar Dominio Personalizado (Opcional)**

Para emails desde tu propio dominio:

1. **Ve a Settings > Custom Domain**
2. **Agrega tu dominio:** `tarantulahawk.com`
3. **Configura los registros DNS:**
   ```
   CNAME: mail.tarantulahawk.com → supabase-mail.com
   TXT: v=spf1 include:supabase.com ~all
   ```

## ⚙️ **3. Configurar Variables de Entorno**

En tu **Vercel Dashboard** o **.env.local**:

```bash
# URLs de redirección
NEXT_PUBLIC_SITE_URL=https://tarantulahawk.vercel.app
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key

# Para emails personalizados
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## 🔒 **4. Políticas de Seguridad (RLS)**

En **SQL Editor** de Supabase:

```sql
-- Política para usuarios autenticados
CREATE POLICY "Users can read own profile" ON auth.users
    FOR SELECT USING (auth.uid() = id);

-- Tabla para datos adicionales de usuario
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email_domain TEXT NOT NULL,
    trial_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Política para perfiles
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
```

## 📊 **5. Dashboard de Administración**

Para monitorear registros:

```sql
-- Ver usuarios registrados hoy
SELECT 
    email,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'company' as company,
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;

-- Ver dominios de email más comunes
SELECT 
    SPLIT_PART(email, '@', 2) as domain,
    COUNT(*) as count
FROM auth.users 
GROUP BY SPLIT_PART(email, '@', 2)
ORDER BY count DESC;
```

## 🚀 **Pasos Siguientes:**

1. ✅ **Configura los email templates** en Supabase Dashboard
2. ✅ **Actualiza las variables de entorno** en Vercel
3. ✅ **Configura el dominio personalizado** (opcional)
4. ✅ **Prueba el flujo completo** con un email corporativo

## 📞 **Soporte:**

Si necesitas ayuda con la configuración, contacta al equipo de Supabase o revisa su documentación oficial sobre email authentication.