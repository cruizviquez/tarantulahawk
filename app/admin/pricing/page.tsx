'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Tier = {
  upto: number | null;
  rate: number;
};

type PricingData = {
  currency: string;
  tiers: Tier[];
};

export default function AdminPricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [tiers, setTiers] = useState<Tier[]>([
    { upto: 2000, rate: 1.0 },
    { upto: 5000, rate: 0.75 },
    { upto: 10000, rate: 0.5 },
    { upto: null, rate: 0.35 },
  ]);

  useEffect(() => {
    fetchPricing();
  }, []);

  async function fetchPricing() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/pricing');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/');
          return;
        }
        if (res.status === 403) {
          setError('Acceso denegado. Solo administradores pueden editar precios.');
          return;
        }
        throw new Error('Failed to fetch pricing');
      }
      const json = await res.json();
      if (json.ok && json.pricing) {
        setPricingData(json.pricing);
        setCurrency(json.pricing.currency || 'USD');
        setTiers(json.pricing.tiers || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Error al cargar pricing');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Validate tiers
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        if (t.upto !== null && (!Number.isFinite(t.upto) || t.upto <= 0)) {
          setError(`Tier ${i + 1}: "upto" debe ser un número positivo o null.`);
          return;
        }
        if (!Number.isFinite(t.rate) || t.rate < 0) {
          setError(`Tier ${i + 1}: "rate" debe ser un número no negativo.`);
          return;
        }
      }

      const payload = { currency, tiers };
      const res = await fetch('/api/admin/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to save pricing');
      }

      setSuccess('Pricing actualizado exitosamente. Recarga la app para ver cambios.');
      await fetchPricing();
    } catch (e: any) {
      setError(e?.message || 'Error al guardar pricing');
    } finally {
      setSaving(false);
    }
  }

  function addTier() {
    setTiers([...tiers, { upto: null, rate: 0 }]);
  }

  function removeTier(idx: number) {
    setTiers(tiers.filter((_, i) => i !== idx));
  }

  function updateTier(idx: number, field: 'upto' | 'rate', value: string) {
    const copy = [...tiers];
    if (field === 'upto') {
      copy[idx].upto = value === '' ? null : Number(value);
    } else {
      copy[idx].rate = Number(value);
    }
    setTiers(copy);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin - Configuración de Precios</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              ← Volver al Dashboard
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              {success}
            </div>
          )}

          <div className="space-y-6">
            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Moneda</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="USD"
              />
            </div>

            {/* Tiers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Tiers de Precio</label>
                <button
                  onClick={addTier}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Agregar Tier
                </button>
              </div>

              <div className="space-y-3">
                {tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Hasta (null = infinito)</label>
                      <input
                        type="text"
                        value={tier.upto === null ? '' : tier.upto}
                        onChange={(e) => updateTier(idx, 'upto', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="null o número"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">Rate ($/txn)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={tier.rate}
                        onChange={(e) => updateTier(idx, 'rate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={() => removeTier(idx)}
                      className="mt-5 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Vista previa:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                {tiers.map((tier, idx) => {
                  const prevLimit = idx === 0 ? 0 : (tiers[idx - 1].upto || 0);
                  const label = tier.upto === null
                    ? `${(prevLimit + 1).toLocaleString()}+ transacciones`
                    : `${(prevLimit + 1).toLocaleString()}-${tier.upto.toLocaleString()} transacciones`;
                  return (
                    <li key={idx}>
                      {label}: <strong>${tier.rate.toFixed(2)}</strong> c/u
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button
                onClick={fetchPricing}
                disabled={saving}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Recargar
              </button>
            </div>
          </div>
        </div>

        {/* Current JSON Display */}
        {pricingData && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">JSON Actual (config/pricing.json)</h2>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-auto text-xs font-mono">
              {JSON.stringify(pricingData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
