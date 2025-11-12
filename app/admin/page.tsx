import AdminDashboard from '@/app/components/AdminDashboard';
import { Suspense } from 'react';
import AccessDenied from './restricted';

// This page now uses client-side role verification to avoid SSR leakage
// and to allow smoother loading states.
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Cargando panel admin...</div>}>
      <AdminGuard>
        <AdminDashboard />
      </AdminGuard>
    </Suspense>
  );
}

// Client component for role guard
// Using a nested component to keep file concise.
function AdminGuard({ children }: { children: React.ReactNode }) {
  return <AdminGuardClient>{children}</AdminGuardClient>;
}

// Separate client implementation
// (Placed inline for now; could move to its own file if it grows)
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function AdminGuardClient({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkRole = async () => {
      try {
        const resp = await fetch('/api/admin/check-role');
        if (!resp.ok) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
        const data = await resp.json();
        if (data.authenticated && data.role === 'admin') {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      } catch (e) {
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    };
    checkRole();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Verificando acceso...</div>
      </div>
    );
  }

  if (!authorized) {
    return <AccessDenied origin="/admin" />;
  }

  return <>{children}</>;
}
