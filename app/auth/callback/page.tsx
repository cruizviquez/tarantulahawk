import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function AuthCallback({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; error_description?: string };
}) {
  const { code, error, error_description } = searchParams;

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Verificación</h1>
          <p className="text-gray-400 mb-6">{error_description || 'Error desconocido'}</p>
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

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-white mb-4">Error de Autenticación</h1>
            <p className="text-gray-400 mb-6">No pudimos verificar tu cuenta. El enlace puede haber expirado.</p>
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

    // Crear/actualizar perfil con valores por defecto para PAYG
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        await supabase.from('profiles').upsert(
          {
            id: userId,
            subscription_tier: 'free',
            free_reports_used: 0,
            max_free_reports: 3,
            tx_limit_free: 1500,
            tx_used_free: 0,
            api_access_enabled: false,
          },
          { onConflict: 'id' }
        );
      }
    } catch (e) {
      // Non-fatal; UI proceeds
      console.error('Profile initialization error', e);
    }

    // Éxito - redirigir al dashboard o página principal con mensaje de éxito
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-4">¡Cuenta Verificada!</h1>
          <p className="text-gray-400 mb-6">Tu cuenta TarantulaHawk ha sido verificada exitosamente. Ahora puedes acceder a tu trial gratuito.</p>
          <a 
            href="/?verified=true" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition text-white"
          >
            Acceder a TarantulaHawk
          </a>
        </div>
      </div>
    );
  }

  // Sin código ni error - redirigir al inicio
  redirect('/');
}