import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import CompletePortalUI from '@/app/components/complete_portal_ui'
import SessionMonitor from '@/app/components/SessionMonitor'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  
  // Validar variables de entorno
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[DASHBOARD] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    })
    
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-blue-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-blue-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Configuración</h1>
          <p className="text-gray-400 mb-6">
            Faltan variables de entorno de Supabase. Verifica tu archivo .env.local
          </p>
          <a 
            href="/" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-600 transition text-white"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    )
  }
  
  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Read-only en Server Component
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    console.log('[DASHBOARD] No session, redirecting to home')
    redirect('/?auth=error')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-blue-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Perfil</h1>
          <p className="text-gray-400 mb-6">
            No se pudo cargar tu perfil.
          </p>
          <a 
            href="/" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-600 transition text-white"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<DashboardLoading />}>
      <SessionMonitor 
        userId={user.id} 
        inactivityTimeout={15 * 60 * 1000} 
      />
      
      <CompletePortalUI 
        user={{
          id: user.id,
          email: user.email || '',
          name: profile.name || 'Usuario',
          company: profile.company || 'Sin empresa',
          balance: profile.account_balance_usd || 0,
          subscription_tier: profile.subscription_tier || 'free'
        }}
      />
    </Suspense>
  )
}

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">
        Cargando dashboard...
      </div>
    </div>
  )
}