import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/app/lib/supabaseServer';

export async function GET() {
  try {
    const db = getServiceSupabase();

    async function tableExists(table: string) {
      try {
        // Avoid chaining methods so our fallback dummy client type also matches
        const { error } = await (db as any).from(table as any).select('*', { head: true, count: 'exact' });
        return !error;
      } catch {
        return false;
      }
    }

    const checks = await Promise.all([
      tableExists('profiles'),
      tableExists('audit_logs'),
      tableExists('api_keys'),
      tableExists('api_key_usage'),
    ]);

    const result = {
      ok: checks.every(Boolean),
      tables: [
        { table: 'profiles', exists: checks[0] },
        { table: 'audit_logs', exists: checks[1] },
        { table: 'api_keys', exists: checks[2] },
        { table: 'api_key_usage', exists: checks[3] },
      ],
      note: 'RLS and trigger checks require manual verification via SQL logs; this endpoint validates table presence only.',
    } as const;

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Health check failed' }, { status: 500 });
  }
}
