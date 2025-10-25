import { supabase } from './supabaseClient';
import { getServiceSupabase } from './supabaseServer';

export interface AuditEvent {
  user_id: string | null;
  action: 'registration' | 'login' | 'logout' | 'report_generated' | 'transaction_uploaded' | 'export_xml' | 'api_key_created' | 'api_key_used' | 'api_key_rotated' | 'password_reset' | 'account_upgraded';
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  resource_id?: string;
  resource_type?: string;
  status?: 'success' | 'failure' | 'pending';
}

/**
 * Log audit events for LFPIORPI compliance
 * Tracks all critical user actions for regulatory reporting
 */
export async function logAuditEvent(event: AuditEvent): Promise<string | null> {
  try {
    // Use service role for inserts (RLS policy restricts insert to service_role)
    const svc = getServiceSupabase();
    const { data, error } = await svc
      .from('audit_logs')
      .insert({
        user_id: event.user_id,
        action: event.action,
        metadata: event.metadata || {},
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        resource_id: event.resource_id,
        resource_type: event.resource_type,
        status: event.status || 'success',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Audit log error:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Failed to log audit event:', error);
    return null;
  }
}

/**
 * Get audit logs for a user (for compliance reporting)
 */
export async function getUserAuditLogs(
  userId: string,
  options?: {
    limit?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<any[]> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.action) {
      query = query.eq('action', options.action);
    }

    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}

/**
 * Helper to get client IP address (works in API routes and middleware)
 */
export function getClientIP(request?: Request): string | undefined {
  if (typeof window !== 'undefined') return undefined; // Client-side

  if (!request) return undefined;

  // Try various headers that might contain the real IP
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const real = headers.get('x-real-ip');
  const cfConnecting = headers.get('cf-connecting-ip'); // Cloudflare

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (real) {
    return real.trim();
  }

  if (cfConnecting) {
    return cfConnecting.trim();
  }

  return undefined;
}
