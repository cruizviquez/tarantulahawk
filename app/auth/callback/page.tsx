import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>;
}) {
  const params = await searchParams;
  const { code, error, error_description } = params;

  // Debug logging (remove in production)
  console.log('[AUTH CALLBACK] Search params:', { code: code ? 'present' : 'missing', error, error_description });

  if (error) {
    console.error('[AUTH CALLBACK] Error from Supabase:', error, error_description);
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Verificación</h1>
          <p className="text-gray-400 mb-6">{error_description || error || 'Error desconocido'}</p>
          <div className="text-xs text-gray-600 mb-4">Error: {error}</div>
          <a 
            href="/" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition text-white"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    );
  }

  if (!code) {
    console.warn('[AUTH CALLBACK] No code parameter received, redirecting to home');
    redirect('/?auth_error=no_code');
  }

  // Create SECURE server-side Supabase client
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
          } catch {
            // Can be ignored in Server Components
          }
        },
      },
    }
  );

  // Exchange code for session (SECURE)
  console.log('[AUTH CALLBACK] Attempting to exchange code for session...');
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  
  if (exchangeError) {
    console.error('[AUTH CALLBACK] Exchange error:', exchangeError.message, exchangeError);
  }
  
  if (exchangeError || !sessionData?.user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Autenticación</h1>
          <p className="text-gray-400 mb-6">No pudimos verificar tu cuenta. El enlace puede haber expirado o ya fue usado.</p>
          <div className="text-xs text-gray-600 mb-4 font-mono">
            {exchangeError?.message || 'Sin detalles del error'}
          </div>
          <a 
            href="/" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition text-white"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    );
  }

  console.log('[AUTH CALLBACK] Session created successfully for user:', sessionData.user.id);

  // User authenticated - now create/update profile with SERVICE ROLE for security
  const userId = sessionData.user.id;
  const userMetadata = sessionData.user.user_metadata;
  
  try {
    // Use service role key for secure profile creation (bypasses RLS)
    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // SECURE: Server-side only
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

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, credits_gifted')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // NEW USER: Create profile with $500 USD gifted credits
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          email: sessionData.user.email,
          name: userMetadata?.name || null,
          company: userMetadata?.company || null,
          subscription_tier: 'free',
          role: 'client',
          credits_gifted: 500.00, // $500 USD initial VIRTUAL credit (not real money)
          credits_purchased: 0.00,
          account_balance_usd: 500.00, // Total = gifted + purchased
          api_access_enabled: false,
        });

      if (insertError) {
        console.error('Profile creation error:', insertError);
      }
    } else {
      // EXISTING USER: Update metadata only (don't reset credits)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          name: userMetadata?.name || existingProfile.name,
          company: userMetadata?.company || existingProfile.company,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
      }
    }
  } catch (e) {
    console.error('Profile initialization error:', e);
    // Non-fatal - proceed to dashboard
  }

  // SUCCESS: Redirect directly to dashboard (no intermediate screen)
  redirect('/dashboard?from=auth');
}