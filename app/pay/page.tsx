"use client";
import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { supabase } from '@/app/lib/supabaseClient';

export default function PayPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    setClientId(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || null);
    setLoading(false);
  }, []);

  const amount = useMemo(() => 15.0, []); // Example per-report pack or access fee

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!clientId) return;
    if ((window as any).paypal && !(window as any).__PAYPAL_BUTTON_RENDERED__) {
      (window as any).paypal
        .Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
          createOrder: (_data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [
                {
                  amount: { value: amount.toFixed(2) },
                  description: 'TarantulaHawk Access',
                },
              ],
            });
          },
          onApprove: async (_data: any, actions: any) => {
            await actions.order.capture();

            // Mark account as paid in Supabase
            const { data: user } = await supabase.auth.getUser();
            const userId = user?.user?.id;
            if (!userId) {
              setError('No authenticated user');
              return;
            }

            const { error: updateError } = await supabase
              .from('profiles')
              .update({ subscription_tier: 'paid' })
              .eq('id', userId);

            if (updateError) {
              setError('No se pudo actualizar la suscripción. Contacta soporte.');
              return;
            }

            setPaid(true);
          },
          onError: (err: any) => {
            console.error('PayPal error', err);
            setError('Error de pago');
          },
        })
        .render('#paypal-buttons');

      (window as any).__PAYPAL_BUTTON_RENDERED__ = true;
    }
  }, [clientId, amount]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-black mb-2 text-center bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">Acceso a TarantulaHawk</h1>
        <p className="text-gray-400 text-center mb-6">Desbloquea el acceso completo al dashboard y generación de reportes.</p>

        {paid ? (
          <div className="text-center">
            <div className="text-green-500 text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-green-400 mb-2">¡Pago recibido!</h2>
            <p className="text-gray-400 mb-4">Tu cuenta ha sido actualizada a <strong>Paid</strong>. Ya puedes volver al dashboard y continuar.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-center text-sm mb-4">
                {error}
              </div>
            )}

            {!loading && clientId ? (
              <>
                <div id="paypal-buttons" className="mt-4" />
                <Script src={`https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`} strategy="afterInteractive" />
              </>
            ) : (
              <div className="text-center text-gray-500">Cargando opciones de pago…</div>
            )}

            <div className="mt-6 text-sm text-gray-500 text-center">
              Plan actual: <span className="text-white font-semibold">Free</span> — 3 reportes gratis, máx. 500 transacciones por reporte.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
