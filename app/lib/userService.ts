import { supabase } from './supabaseClient';

// Tipos para TypeScript
export interface UserProfile {
  id: string;
  name: string;
  company: string;
  email_domain: string;
  trial_expires_at: string;
  trial_active: boolean;
  mfa_enabled: boolean;
  password_last_changed: string;
  login_attempts: number;
  locked_until?: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface RegistrationData {
  name: string;
  email: string;
  password: string;
  company: string;
}

// Validar email corporativo
export function validateCorporateEmail(email: string): boolean {
  const personalDomains = [
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'live.com', 'msn.com', 'mail.com',
    'yandex.com', 'zoho.com', 'tutanota.com', 'fastmail.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return Boolean(domain && !personalDomains.includes(domain));
}

// Validar fortaleza de contraseña
export function validatePassword(password: string): { 
  isValid: boolean; 
  message: string; 
  strength: number; 
  requirements: Array<{ met: boolean; text: string }>;
} {
  if (password.length < 8) {
    return { 
      isValid: false, 
      message: 'Mínimo 8 caracteres', 
      strength: 0,
      requirements: []
    };
  }

  const requirements = [
    { met: /[A-Z]/.test(password), text: 'Al menos 1 mayúscula' },
    { met: /[a-z]/.test(password), text: 'Al menos 1 minúscula' },
    { met: /\d/.test(password), text: 'Al menos 1 número' },
    { met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password), text: 'Al menos 1 carácter especial' }
  ];

  const metRequirements = requirements.filter(req => req.met).length;
  const unmetRequirements = requirements.filter(req => !req.met);

  if (metRequirements === 4) {
    return { 
      isValid: true, 
      message: '✅ Contraseña segura', 
      strength: 100,
      requirements
    };
  }

  const missing = unmetRequirements.map(req => req.text).join(', ');
  return { 
    isValid: false, 
    message: `Faltan: ${missing}`, 
    strength: (metRequirements / 4) * 100,
    requirements
  };
}

// Registrar usuario con validaciones mejoradas
export async function registerUser(data: RegistrationData) {
  const { name, email, password, company } = data;
  
  // Validaciones del lado cliente
  if (!validateCorporateEmail(email)) {
    throw new Error('Solo se permiten emails corporativos. No se aceptan cuentas personales.');
  }

  if (!company.trim()) {
    throw new Error('El campo empresa es obligatorio.');
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new Error(`Contraseña no cumple los requisitos: ${passwordValidation.message}`);
  }

  const emailDomain = email.split('@')[1];
  const trialExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Registrar usuario en Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name: name.trim(), 
          company: company.trim(), 
          email_domain: emailDomain,
          trial_expires_at: trialExpiresAt,
          mfa_enabled: true
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      },
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        throw new Error('Esta dirección de email ya está registrada. ¿Intentas iniciar sesión en su lugar?');
      } else if (signUpError.message.includes('password')) {
        throw new Error('Error con la contraseña. Asegúrate de que cumple todos los requisitos de seguridad.');
      } else {
        throw new Error(signUpError.message);
      }
    }

    // Log de actividad de registro
    if (authData.user) {
      await logUserActivity(authData.user.id, 'registration', {
        company: company.trim(),
        email_domain: emailDomain,
        registration_method: 'trial_signup'
      });
    }

    return authData;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Obtener perfil de usuario
export async function getUserProfile(userId?: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId || (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

// Actualizar perfil de usuario
export async function updateUserProfile(updates: Partial<UserProfile>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', (await supabase.auth.getUser()).data.user?.id);

    if (error) {
      console.error('Error updating user profile:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
}

// Verificar si el trial está activo
export async function isTrialActive(userId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('is_trial_active', { 
        user_uuid: userId || (await supabase.auth.getUser()).data.user?.id 
      });

    if (error) {
      console.error('Error checking trial status:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Error checking trial status:', error);
    return false;
  }
}

// Extender trial
export async function extendTrial(additionalDays: number = 7, userId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('extend_trial', { 
        user_uuid: userId || (await supabase.auth.getUser()).data.user?.id,
        additional_days: additionalDays
      });

    if (error) {
      console.error('Error extending trial:', error);
      return false;
    }

    return data;
  } catch (error) {
    console.error('Error extending trial:', error);
    return false;
  }
}

// Log de actividad de usuario
export async function logUserActivity(
  userId: string,
  activityType: string,
  details: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('log_user_activity', {
        user_uuid: userId,
        activity: activityType,
        activity_details: details,
        ip: ipAddress,
        agent: userAgent
      });

    if (error) {
      console.error('Error logging user activity:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error logging user activity:', error);
    return null;
  }
}

// Obtener actividad del usuario
export async function getUserActivity(userId?: string, limit: number = 50): Promise<UserActivity[]> {
  try {
    const { data, error } = await supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId || (await supabase.auth.getUser()).data.user?.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user activity:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return [];
  }
}

// Reset password con validaciones
export async function resetPassword(email: string): Promise<void> {
  if (!validateCorporateEmail(email)) {
    throw new Error('Solo se puede restablecer contraseñas de emails corporativos.');
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw error;
  }
}

// Actualizar contraseña con validaciones
export async function updatePassword(newPassword: string): Promise<void> {
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    throw new Error(`La nueva contraseña no cumple los requisitos: ${passwordValidation.message}`);
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    throw error;
  }

  // Log del cambio de contraseña
  const user = await supabase.auth.getUser();
  if (user.data.user) {
    await logUserActivity(user.data.user.id, 'password_change', {
      changed_at: new Date().toISOString(),
      method: 'user_initiated'
    });

    // Actualizar timestamp en el perfil
    await updateUserProfile({
      password_last_changed: new Date().toISOString()
    });
  }
}

// Función para handle de login con logging
export async function loginUser(email: string, password: string) {
  if (!validateCorporateEmail(email)) {
    throw new Error('Solo se permite el acceso con emails corporativos.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Log intento fallido
    const profile = await supabase
      .from('user_profiles')
      .select('id, login_attempts')
      .eq('id', data?.user?.id)
      .single();

    if (profile.data) {
      await supabase
        .from('user_profiles')
        .update({ 
          login_attempts: (profile.data.login_attempts || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.data.id);
    }

    throw error;
  }

  // Log login exitoso
  if (data.user) {
    await logUserActivity(data.user.id, 'login', {
      login_method: 'email_password',
      user_agent: navigator.userAgent
    });

    // Reset login attempts y actualizar last login
    await updateUserProfile({
      login_attempts: 0,
      last_login_at: new Date().toISOString()
    });
  }

  return data;
}

// Obtener estadísticas de usuarios (para admin)
export async function getUserStats() {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching user stats:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }
}

// Obtener dominios corporativos (para admin)
export async function getCorporateDomains() {
  try {
    const { data, error } = await supabase
      .from('corporate_domains')
      .select('*');

    if (error) {
      console.error('Error fetching corporate domains:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching corporate domains:', error);
    return [];
  }
}