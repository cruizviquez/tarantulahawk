import { getAuthUser, getUserProfile } from '@/app/lib/auth';
import CompletePortalUI from '@/app/components/complete_portal_ui';
import SessionMonitor from '@/app/components/SessionMonitor';
import { Suspense } from 'react';

export default async function DashboardPage() {
  // Middleware ya verificó auth, pero doble verificación no daña
  const { user } = await getAuthUser();
  const profile = await getUserProfile(user.id);

  // Si no hay perfil, mostrar error específico
  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Perfil</h1>
          <p className="text-gray-400 mb-6">
            No se pudo cargar tu perfil. Contacta soporte si el problema persiste.
          </p>
          <a 
            href="/?logout=true" 
            className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition text-white"
          >
            Volver al Inicio
          </a>
        </div>
      </div>
    );
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
  );
}

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">
        Cargando dashboard...
      </div>
    </div>
  );
}