/**
 * api-auth-helpers.ts
 * Helper functions for API route authentication and authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AuthResult {
  user: { id: string; email?: string };
  profile: { role: string } | null;
  error?: string;
}

/**
 * Validate user authentication and get profile from database
 * Use this at the start of protected API routes
 */
export async function validateAuth(request?: NextRequest): Promise<AuthResult> {
  try {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { 
        user: { id: '' }, 
        profile: null, 
        error: 'Unauthorized' 
      };
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
    }

    return {
      user: { id: user.id, email: user.email },
      profile: profile || { role: 'client' }, // Default to client if no profile
      error: undefined,
    };
  } catch (error) {
    console.error('Auth validation error:', error);
    return {
      user: { id: '' },
      profile: null,
      error: 'Internal auth error',
    };
  }
}

/**
 * Validate user has admin role
 * Returns 403 response if not admin, null if admin
 */
export async function requireAdmin(request?: NextRequest): Promise<NextResponse | null> {
  const auth = await validateAuth(request);
  
  if (auth.error || !auth.user.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  if (!auth.profile || auth.profile.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    );
  }
  
  return null; // No error, user is admin
}

/**
 * Validate user has auditor or admin role
 * Returns 403 response if not authorized, null if authorized
 */
export async function requireAuditorOrAdmin(request?: NextRequest): Promise<{ response: NextResponse | null; auth: AuthResult }> {
  const auth = await validateAuth(request);
  
  if (auth.error || !auth.user.id) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
      auth,
    };
  }
  
  const allowedRoles = ['auditor', 'admin'];
  if (!auth.profile || !allowedRoles.includes(auth.profile.role)) {
    return {
      response: NextResponse.json(
        { error: 'Forbidden - Auditor or Admin access required' },
        { status: 403 }
      ),
      auth,
    };
  }
  
  return { response: null, auth }; // No error
}
