"use client";
import Link from 'next/link';

export default function AccessDenied({ origin = '/' }: { origin?: string }) {
  return (
    <div className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 inline-block p-3 bg-yellow-500/10 rounded-full">
        <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M4.293 6.293a1 1 0 011.414 0L12 12.586l6.293-6.293a1 1 0 111.414 1.414L13.414 14l6.293 6.293a1 1 0 01-1.414 1.414L12 15.414l-6.293 6.293a1 1 0 01-1.414-1.414L10.586 14 4.293 7.707a1 1 0 010-1.414z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Acceso restringido</h2>
      <p className="text-gray-400 mb-6">No tienes permisos de administrador.</p>
      <div className="flex gap-3">
        <Link href={`/auth/login?auth=required&returnTo=${encodeURIComponent(origin)}`} className="px-5 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-600 transition">
          Iniciar sesión con otra cuenta
        </Link>
        <Link href="/" className="px-5 py-3 bg-gray-800 border border-gray-700 rounded-lg font-semibold hover:bg-gray-750 transition">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
