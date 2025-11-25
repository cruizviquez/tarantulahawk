import React from 'react';
import { TransaccionRow } from './ml_mapper';

export default function TablaResultados({ rows, onViewDetails }: { rows: TransaccionRow[]; onViewDetails?: (id: string | number) => void }) {

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead>
            <tr className="text-left text-xs text-gray-400">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Monto</th>
              <th className="px-3 py-2">Etiqueta ML</th>
              <th className="px-3 py-2">Score EBR</th>
              <th className="px-3 py-2">Anomalía</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${String(r.id ?? 'row')}-${i}`} className="border-t border-gray-800 hover:bg-gray-800/40">
                <td className="px-3 py-2 font-mono text-xs text-gray-200">{r.id}</td>
                <td className="px-3 py-2 text-gray-300">{r.cliente ?? 'N/D'}</td>
                <td className="px-3 py-2 text-gray-300">{r.fecha}</td>
                <td className="px-3 py-2 font-mono text-teal-300">${Number(r.monto ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                    r.etiqueta_ml === 'preocupante' ? 'bg-red-600/20 text-red-300' :
                    r.etiqueta_ml === 'inusual' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-emerald-500/20 text-emerald-300'
                  }`}>{r.etiqueta_ml}</span>
                </td>
                <td className="px-3 py-2 text-gray-300">{r.score_ebr.toFixed(1)}</td>
                <td className="px-3 py-2">
                  {r.es_anomalia ? (
                    <span className="text-red-400 font-semibold">Sí</span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onViewDetails && onViewDetails(r.id)}
                    className="text-teal-300 hover:text-teal-200 underline text-xs"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
