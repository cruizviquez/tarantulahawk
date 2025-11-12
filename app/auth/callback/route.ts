import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Helper: Get correct origin (always use x-forwarded-host to avoid internal port issues)
 */
function getOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  
  if (forwardedHost) {
    // Always use forwarded host (strips internal port added by Next.js server)
    return `${forwardedProto}://${forwardedHost}`
  }
  
  return new URL(request.url).origin
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = getOrigin(request)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')

  if (error) {
    console.error('[AUTH] Error from Supabase:', error)
    return NextResponse.redirect(new URL('/?error=' + error, origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Optional admin client for used_tokens (single-use enforcement)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = serviceRoleKey
    ? createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
          cookies: {
            getAll() {
              return []
            },
            setAll() {},
          },
        }
      )
    : null

  // Magic Link
  if (token_hash && type) {
    console.log('[AUTH] Processing Magic Link')

    // Enforce single-use via used_tokens
    try {
      if (supabaseAdmin) {
        const shortHash = token_hash.substring(0, 30)
        const { data: used } = await supabaseAdmin
          .from('used_tokens')
          .select('token_hash')
          .eq('token_hash', shortHash)
          .maybeSingle()
        if (used) {
          return NextResponse.redirect(new URL('/?error=token_already_used', origin))
        }
      }
    } catch (e) {
      console.warn('[AUTH] used_tokens pre-check failed:', (e as any)?.message || e)
      // Continue; Supabase will still enforce validity
    }

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (verifyError) {
      console.error('[AUTH] Verification failed:', verifyError.message)
      
      // ✅ MEJORADO: Detectar si el token ya fue usado o expiró
      const errorMsg = verifyError.message.toLowerCase()
      let errorParam = 'invalid_token'
      
      if (errorMsg.includes('expired')) {
        errorParam = 'token_expired'
      } else if (errorMsg.includes('already') || errorMsg.includes('used')) {
        errorParam = 'token_already_used'
      } else if (errorMsg.includes('invalid')) {
        errorParam = 'token_invalid'
      }
      
      return NextResponse.redirect(new URL(`/?error=${errorParam}`, origin))
    }

    if (data.session && data.user) {
      console.log('[AUTH] Session created for:', data.user.id)

      // Verificar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, company')
        .eq('id', data.user.id)
        .single()

      // Mark token as used (best-effort)
      try {
        if (supabaseAdmin) {
          const shortHash = token_hash.substring(0, 30)
          await supabaseAdmin.from('used_tokens').insert({
            token_hash: shortHash,
            used_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          })
        }
      } catch (e) {
        console.warn('[AUTH] used_tokens mark failed:', (e as any)?.message || e)
      }

      const targetPath = (!profile || !profile.name || !profile.company)
        ? '/onboarding'
        : '/dashboard'

      // ✅ Add slight delay to ensure cookies are set before redirect
      await new Promise(resolve => setTimeout(resolve, 100))

      const redirectUrl = new URL(targetPath, origin)
      const response = NextResponse.redirect(redirectUrl, { status: 307 })
      
      // Force cookie persistence and disable caching
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('X-Auth-Success', 'true')
      
      return response
    }
  }

  // PKCE
  if (code) {
    console.log('[AUTH] Processing PKCE')

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH] Code exchange failed:', exchangeError.message)
      return NextResponse.redirect(new URL('/?error=code_exchange_failed', origin))
    }

    if (data.session && data.user) {
      console.log('[AUTH] PKCE session created for:', data.user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, company')
        .eq('id', data.user.id)
        .single()

      const redirectUrl = (!profile || !profile.name || !profile.company)
        ? new URL('/onboarding', origin)
        : new URL('/dashboard', origin)

      return NextResponse.redirect(redirectUrl)
    }
  }

  console.log('[AUTH] No auth params')
  return NextResponse.redirect(new URL('/?error=no_auth_params', origin))
}