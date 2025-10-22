-- ===============================================
-- SUPABASE DATABASE SETUP FOR TARANTULAHAWK
-- ===============================================

-- 1. CREAR TABLA DE PERFILES DE USUARIO
-- ===============================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT NOT NULL,
    email_domain TEXT NOT NULL,
    trial_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    trial_active BOOLEAN DEFAULT TRUE,
    mfa_enabled BOOLEAN DEFAULT TRUE,
    password_last_changed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR FUNCIÓN PARA ACTUALIZAR TIMESTAMP
-- ===============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. CREAR TRIGGER PARA AUTO-UPDATE
-- ===============================================

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON public.user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. FUNCIÓN PARA VALIDAR EMAIL CORPORATIVO
-- ===============================================

CREATE OR REPLACE FUNCTION validate_corporate_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Lista de dominios personales no permitidos
    IF NEW.email_domain IN (
        'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
        'aol.com', 'protonmail.com', 'live.com', 'msn.com', 'mail.com',
        'yandex.com', 'zoho.com', 'tutanota.com', 'fastmail.com'
    ) THEN
        RAISE EXCEPTION 'Personal email domains not allowed. Only corporate emails accepted.';
    END IF;
    
    -- Validar que el dominio no esté vacío
    IF NEW.email_domain IS NULL OR TRIM(NEW.email_domain) = '' THEN
        RAISE EXCEPTION 'Email domain is required';
    END IF;
    
    -- Validar que la empresa no esté vacía
    IF NEW.company IS NULL OR TRIM(NEW.company) = '' THEN
        RAISE EXCEPTION 'Company name is required';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. CREAR TRIGGER PARA VALIDAR EMAIL
-- ===============================================

DROP TRIGGER IF EXISTS validate_email_domain ON public.user_profiles;
CREATE TRIGGER validate_email_domain 
    BEFORE INSERT OR UPDATE ON public.user_profiles 
    FOR EACH ROW EXECUTE FUNCTION validate_corporate_email();

-- 6. FUNCIÓN PARA CREAR PERFIL AUTOMÁTICAMENTE
-- ===============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id, 
        name, 
        company, 
        email_domain,
        trial_expires_at,
        mfa_enabled
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'company', ''),
        COALESCE(NEW.raw_user_meta_data->>'email_domain', SPLIT_PART(NEW.email, '@', 2)),
        COALESCE(
            (NEW.raw_user_meta_data->>'trial_expires_at')::timestamp with time zone,
            NOW() + INTERVAL '14 days'
        ),
        COALESCE((NEW.raw_user_meta_data->>'mfa_enabled')::boolean, true)
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 7. CREAR TRIGGER PARA NUEVO USUARIO
-- ===============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. POLÍTICAS DE SEGURIDAD (RLS)
-- ===============================================

-- Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden leer su propio perfil
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Política: Los usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Política: Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Política: Solo el usuario puede eliminar su perfil
CREATE POLICY "Users can delete own profile" ON public.user_profiles
    FOR DELETE USING (auth.uid() = id);

-- 9. TABLA PARA TRACKING DE ACTIVIDAD
-- ===============================================

CREATE TABLE IF NOT EXISTS public.user_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'login', 'password_change', 'mfa_setup', etc.
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. ÍNDICES PARA PERFORMANCE
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_email_domain ON public.user_profiles(email_domain);
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_expires ON public.user_profiles(trial_expires_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON public.user_profiles(company);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_type ON public.user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON public.user_activity(created_at);

-- 11. FUNCIÓN PARA VERIFICAR TRIAL ACTIVO
-- ===============================================

CREATE OR REPLACE FUNCTION public.is_trial_active(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    trial_expires TIMESTAMP WITH TIME ZONE;
    trial_status BOOLEAN;
BEGIN
    SELECT trial_expires_at, trial_active 
    INTO trial_expires, trial_status
    FROM public.user_profiles 
    WHERE id = user_uuid;
    
    -- Si no existe el perfil, retornar false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar si el trial sigue activo y no ha expirado
    RETURN trial_status AND trial_expires > NOW();
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 12. FUNCIÓN PARA EXTENDER TRIAL
-- ===============================================

CREATE OR REPLACE FUNCTION public.extend_trial(
    user_uuid UUID, 
    additional_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.user_profiles 
    SET 
        trial_expires_at = trial_expires_at + (additional_days || ' days')::INTERVAL,
        updated_at = NOW()
    WHERE id = user_uuid;
    
    RETURN FOUND;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 13. FUNCIÓN PARA LOGGING DE ACTIVIDAD
-- ===============================================

CREATE OR REPLACE FUNCTION public.log_user_activity(
    user_uuid UUID,
    activity TEXT,
    activity_details JSONB DEFAULT '{}',
    ip TEXT DEFAULT NULL,
    agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO public.user_activity (
        user_id, 
        activity_type, 
        details, 
        ip_address, 
        user_agent
    )
    VALUES (
        user_uuid, 
        activity, 
        activity_details, 
        ip::INET, 
        agent
    )
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- 14. VISTA PARA ESTADÍSTICAS DE USUARIOS
-- ===============================================

CREATE OR REPLACE VIEW public.user_stats AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN u.email_confirmed_at IS NOT NULL THEN 1 END) as verified_users,
    COUNT(CASE WHEN p.mfa_enabled = true THEN 1 END) as mfa_enabled_users,
    COUNT(CASE WHEN p.trial_active = true AND p.trial_expires_at > NOW() THEN 1 END) as active_trials,
    COUNT(CASE WHEN p.trial_expires_at <= NOW() THEN 1 END) as expired_trials,
    ROUND(
        COUNT(CASE WHEN u.email_confirmed_at IS NOT NULL THEN 1 END)::numeric / 
        COUNT(*)::numeric * 100, 2
    ) as verification_rate,
    ROUND(
        COUNT(CASE WHEN p.mfa_enabled = true THEN 1 END)::numeric / 
        COUNT(*)::numeric * 100, 2
    ) as mfa_adoption_rate
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id;

-- 15. VISTA PARA DOMINIOS CORPORATIVOS
-- ===============================================

CREATE OR REPLACE VIEW public.corporate_domains AS
SELECT 
    email_domain,
    COUNT(*) as user_count,
    COUNT(CASE WHEN u.email_confirmed_at IS NOT NULL THEN 1 END) as verified_count,
    COUNT(CASE WHEN p.trial_active = true AND p.trial_expires_at > NOW() THEN 1 END) as active_trials,
    ARRAY_AGG(DISTINCT p.company) as companies
FROM public.user_profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.email_domain NOT IN (
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com'
)
GROUP BY email_domain
ORDER BY user_count DESC;

-- 16. POLÍTICA PARA ACTIVIDAD DE USUARIOS
-- ===============================================

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity" ON public.user_activity
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity" ON public.user_activity
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 17. GRANTS DE PERMISOS
-- ===============================================

-- Permitir acceso a las tablas para usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.user_activity TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Permitir acceso a las vistas
GRANT SELECT ON public.user_stats TO authenticated;
GRANT SELECT ON public.corporate_domains TO authenticated;

-- Permitir acceso a las funciones
GRANT EXECUTE ON FUNCTION public.is_trial_active(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_trial(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_activity(UUID, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- ===============================================
-- CONFIGURACIÓN COMPLETADA
-- ===============================================

-- Para verificar que todo esté correcto, ejecuta:
-- SELECT * FROM public.user_stats;
-- SELECT * FROM public.corporate_domains;