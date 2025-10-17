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
        .logo { width: 120px; height: auto; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <svg class="logo" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color: #CC3300" />
                        <stop offset="50%" style="stop-color: #FF4500" />
                        <stop offset="100%" style="stop-color: #FF6B00" />
                    </linearGradient>
                    <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color: #00CED1" />
                        <stop offset="50%" style="stop-color: #20B2AA" />
                        <stop offset="100%" style="stop-color: #48D1CC" />
                    </linearGradient>
                </defs>
                <circle cx="200" cy="200" r="190" fill="none" stroke="url(#tealGrad)" stroke-width="3" opacity="0.4"/>
                <ellipse cx="200" cy="230" rx="35" ry="85" fill="#0A0A0A"/>
                <ellipse cx="200" cy="170" rx="18" ry="20" fill="#0F0F0F"/>
                <ellipse cx="200" cy="145" rx="32" ry="35" fill="#0F0F0F"/>
                <ellipse cx="200" cy="110" rx="22" ry="20" fill="#0A0A0A"/>
                <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#orangeGrad)" opacity="0.95"/>
                <ellipse cx="200" cy="245" rx="30" ry="9" fill="url(#orangeGrad)" opacity="0.9"/>
                <ellipse cx="200" cy="270" rx="27" ry="8" fill="url(#orangeGrad)" opacity="0.85"/>
                <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
                <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
                <path d="M 200 305 L 197 330 L 200 350 L 203 330 Z" fill="url(#orangeGrad)"/>
                <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1"/>
                <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1"/>
            </svg>
            <h1 style="margin: 10px 0 0 0; color: white; font-size: 28px;">TarantulaHawk</h1>
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

## 🔒 **4. Configuración de Seguridad Avanzada**

### **4.1 Políticas de Contraseña en Supabase Dashboard:**

Ve a **Authentication > Settings**:

```json
{
  "password_min_length": 8,
  "password_complexity": {
    "require_uppercase": true,
    "require_lowercase": true,
    "require_numbers": true,
    "require_special_chars": true
  }
}
```

### **4.2 Configurar MFA (Multi-Factor Authentication):**

En **Authentication > Settings > Multi-Factor Authentication**:
- ✅ **Habilitar TOTP (Time-based OTP)**
- ✅ **Habilitar Email OTP como fallback**
- ✅ **Requerir MFA para nuevos usuarios**

### **4.3 Políticas de Seguridad (RLS):**

En **SQL Editor** de Supabase:

```sql
-- Tabla para datos adicionales de usuario con seguridad mejorada
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email_domain TEXT NOT NULL,
    trial_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    mfa_enabled BOOLEAN DEFAULT TRUE,
    password_last_changed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para auto-update
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Políticas de seguridad
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Función para validar email corporativo
CREATE OR REPLACE FUNCTION validate_corporate_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_domain IN ('gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com') THEN
        RAISE EXCEPTION 'Personal email domains not allowed';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para validar email
CREATE TRIGGER validate_email_domain 
    BEFORE INSERT OR UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION validate_corporate_email();
```

### **4.4 Configuración de Cifrado:**

**Nota Importante:** Supabase maneja automáticamente:
- ✅ **Cifrado AES-256** para contraseñas
- ✅ **Hashing bcrypt** con salt
- ✅ **Cifrado en tránsito** (TLS 1.3)
- ✅ **Cifrado en reposo** (AES-256)

**No necesitas configurar cifrado manualmente** - está integrado por defecto.

## � **5. Configuración MFA Post-Registro**

### **5.1 Template de Email MFA:**

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Código de Verificación TarantulaHawk</title>
    <style>
        body { font-family: Arial, sans-serif; background: #0f0f0f; color: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #dc2626, #ea580c); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #1a1a1a; padding: 30px; border-radius: 0 0 8px 8px; text-align: center; }
        .code { background: #2a2a2a; border: 2px solid #ea580c; padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; color: #ea580c; }
        .logo { width: 80px; height: auto; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <svg class="logo" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="orangeGradMFA" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color: #CC3300" />
                        <stop offset="50%" style="stop-color: #FF4500" />
                        <stop offset="100%" style="stop-color: #FF6B00" />
                    </linearGradient>
                    <linearGradient id="tealGradMFA" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color: #00CED1" />
                        <stop offset="50%" style="stop-color: #20B2AA" />
                        <stop offset="100%" style="stop-color: #48D1CC" />
                    </linearGradient>
                </defs>
                <circle cx="200" cy="200" r="190" fill="none" stroke="url(#tealGradMFA)" stroke-width="3" opacity="0.4"/>
                <ellipse cx="200" cy="230" rx="35" ry="85" fill="#0A0A0A"/>
                <ellipse cx="200" cy="170" rx="18" ry="20" fill="#0F0F0F"/>
                <ellipse cx="200" cy="145" rx="32" ry="35" fill="#0F0F0F"/>
                <ellipse cx="200" cy="110" rx="22" ry="20" fill="#0A0A0A"/>
                <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#orangeGradMFA)" opacity="0.95"/>
                <ellipse cx="200" cy="245" rx="30" ry="9" fill="url(#orangeGradMFA)" opacity="0.9"/>
                <ellipse cx="200" cy="270" rx="27" ry="8" fill="url(#orangeGradMFA)" opacity="0.85"/>
                <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#orangeGradMFA)" opacity="0.9"/>
                <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#orangeGradMFA)" opacity="0.9"/>
                <path d="M 200 305 L 197 330 L 200 350 L 203 330 Z" fill="url(#orangeGradMFA)"/>
                <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1"/>
                <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1"/>
            </svg>
            <h1 style="margin: 10px 0 0 0; color: white; font-size: 24px;">TarantulaHawk</h1>
            <p style="margin: 5px 0 0 0; color: #ffedd5;">Código de Verificación</p>
        </div>
        <div class="content">
            <h2 style="color: #ea580c;">Código de Autenticación</h2>
            <p>Tu código de verificación de 6 dígitos es:</p>
            
            <div class="code">{{ .Token }}</div>
            
            <p><strong>⏰ Este código expira en 10 minutos</strong></p>
            <p>Si no solicitaste este código, ignora este email.</p>
            
            <hr style="border: 1px solid #333; margin: 30px 0;">
            <p style="color: #888; font-size: 12px;">Por tu seguridad, nunca compartas este código con nadie.</p>
        </div>
    </div>
</body>
</html>
```

### **5.2 Configuración de Sesiones:**

En **Authentication > Settings**:
```json
{
  "session_timeout": 86400,
  "refresh_token_rotation": true,
  "security": {
    "enable_captcha": true,
    "max_password_length": 72,
    "password_required_characters": ["uppercase", "lowercase", "number", "special"]
  }
}
```

## �📊 **6. Dashboard de Administración**

Para monitorear registros y seguridad:

```sql
-- Ver usuarios registrados con MFA
SELECT 
    email,
    raw_user_meta_data->>'name' as name,
    raw_user_meta_data->>'company' as company,
    raw_user_meta_data->>'mfa_enabled' as mfa_status,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users 
WHERE created_at::date = CURRENT_DATE
ORDER BY created_at DESC;

-- Estadísticas de seguridad
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as verified_users,
    COUNT(CASE WHEN raw_user_meta_data->>'mfa_enabled' = 'true' THEN 1 END) as mfa_enabled_users,
    ROUND(
        COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END)::numeric / 
        COUNT(*)::numeric * 100, 2
    ) as verification_rate
FROM auth.users;

-- Ver dominios corporativos más comunes
SELECT 
    SPLIT_PART(email, '@', 2) as domain,
    COUNT(*) as count,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as verified
FROM auth.users 
WHERE SPLIT_PART(email, '@', 2) NOT IN ('gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com')
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