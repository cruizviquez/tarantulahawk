import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')

  if (error) {
    console.error('[AUTH] Error from Supabase:', error)
    return NextResponse.redirect(new URL('/?error=' + error, requestUrl.origin))
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

  // Magic Link
  if (token_hash && type) {
    console.log('[AUTH] Processing Magic Link')

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
      
      return NextResponse.redirect(new URL(`/?error=${errorParam}`, requestUrl.origin))
    }

    if (data.session && data.user) {
      console.log('[AUTH] Session created for:', data.user.id)

      // Verificar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, company')
        .eq('id', data.user.id)
        .single()

      const redirectUrl = (!profile || !profile.name || !profile.company)
        ? new URL('/onboarding', requestUrl.origin)
        : new URL('/dashboard', requestUrl.origin)

      return NextResponse.redirect(redirectUrl)
    }
  }

  // PKCE
  if (code) {
    console.log('[AUTH] Processing PKCE')

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('[AUTH] Code exchange failed:', exchangeError.message)
      return NextResponse.redirect(new URL('/?error=code_exchange_failed', requestUrl.origin))
    }

    if (data.session && data.user) {
      console.log('[AUTH] PKCE session created for:', data.user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, company')
        .eq('id', data.user.id)
        .single()

      const redirectUrl = (!profile || !profile.name || !profile.company)
        ? new URL('/onboarding', requestUrl.origin)
        : new URL('/dashboard', requestUrl.origin)

      return NextResponse.redirect(redirectUrl)
    }
  }

  console.log('[AUTH] No auth params')
  return NextResponse.redirect(new URL('/?error=no_auth_params', requestUrl.origin))
}