"use client";

import { useEffect, useState } from "react";

type HealthResult = {
  ok: boolean;
  tables: { table: string; exists: boolean }[];
  note?: string;
  error?: string;
};

export default function HealthPage() {
  const [data, setData] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/health");
        const json = (await res.json()) as HealthResult;
        if (active) setData(json);
      } catch (e: any) {
        if (active) setData({ ok: false, tables: [], error: e?.message || "failed" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">System Health</h1>
      {loading && <p>Checking…</p>}
      {!loading && data && (
        <div className="space-y-4">
          <div className={`px-4 py-2 rounded ${data.ok ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
            {data.ok ? "All required tables are present." : "Some checks failed. See details below."}
          </div>
          {data.note && <p className="text-sm text-slate-500">{data.note}</p>}
          {data.error && <p className="text-sm text-blue-600">Error: {data.error}</p>}
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="p-2">Table</th>
                  <th className="p-2">Exists</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.map((t) => (
                  <tr key={t.table} className="border-t">
                    <td className="p-2 font-mono">{t.table}</td>
                    <td className="p-2">{t.exists ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
