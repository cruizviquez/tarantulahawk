import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

/**
 * Obtiene usuario autenticado (cached por request)
 * Lanza error si no está autenticado
 */
export const getAuthUser = cache(async () => {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
              })
            );
          } catch (error) {
            console.error('[SET COOKIES ERROR]', error);
          }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('[AUTH ERROR]', error.message);
    redirect('/?auth=error');
  }
  
  if (!user) {
    redirect('/?auth=required');
  }

  return { user, supabase };
});

/**
 * Obtiene perfil de usuario (cached por request)
 */
export const getUserProfile = cache(async (userId: string) => {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[PROFILE ERROR]', error.message);
    return null;
  }

  return profile;
});

/**
 * Verifica si usuario tiene permiso para acción específica
 */
export async function requirePermission(
  action: 'use_ml' | 'admin_access' | 'api_access'
): Promise<void> {
  const { user } = await getAuthUser();
  const profile = await getUserProfile(user.id);
  
  if (!profile) {
    redirect('/?auth=profile_missing');
  }

  const permissions = {
    free: ['use_ml'],
    paid: ['use_ml', 'api_access'],
    enterprise: ['use_ml', 'api_access', 'admin_access'],
  };

  const tier = profile.subscription_tier || 'free';
  const allowedActions = permissions[tier as keyof typeof permissions] || [];

  if (!allowedActions.includes(action)) {
    throw new Error(`Permission denied: ${action} requires upgrade`);
  }
}

/**
 * Logout helper
 */
export async function signOut() {
  const { supabase } = await getAuthUser();
  await supabase.auth.signOut();
  redirect('/?logout=true');
}
