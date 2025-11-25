import { useEffect, useState } from 'react';
import { TransaccionRow, mapApiResponseToRows } from './ml_mapper';

export function useAnalisisTransacciones(analysisId: string | null, initialData?: any[]) {
  const [rows, setRows] = useState<TransaccionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData && Array.isArray(initialData)) {
      setRows(mapApiResponseToRows(initialData));
      return;
    }

    if (!analysisId) return;
    let mounted = true;
    setLoading(true);
    fetch(`/api/portal/results/${analysisId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        setRows(mapApiResponseToRows(json.transacciones || json));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => { mounted = false; };
  }, [analysisId, JSON.stringify(initialData)]);

  return { rows, loading };
}
