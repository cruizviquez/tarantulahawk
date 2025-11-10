import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/app/lib/api-auth-helpers';

/**
 * GET /api/admin/security
 * Returns AI-powered security analytics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is admin
    const adminCheck = await requireAdmin(request);
    if (adminCheck) return adminCheck; // Returns 401 or 403 if not admin

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Get suspicious activity using AI function
    const { data: suspiciousUsers, error: suspiciousError } = await supabase
      .rpc('get_suspicious_activity');

    if (suspiciousError) {
      console.error('Suspicious activity query error:', suspiciousError);
    }

    // Get overall stats
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Total users active in last 24h
    const { count: activeUsers } = await supabase
      .from('audit_logs')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo);

    // Total alerts today
    const { count: totalAlerts } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'warning')
      .gte('created_at', twentyFourHoursAgo);

    // High risk users (risk_score >= 51)
    const highRiskUsers = (suspiciousUsers || []).filter(
      (u: any) => u.risk_score >= 51
    ).length;

    // Average actions per user
    const { data: avgData } = await supabase
      .from('audit_logs')
      .select('user_id')
      .gte('created_at', twentyFourHoursAgo);

    const uniqueUsers = new Set((avgData || []).map((d: any) => d.user_id));
    const avgActions = uniqueUsers.size > 0 
      ? (avgData || []).length / uniqueUsers.size 
      : 0;

    return NextResponse.json({
      success: true,
      suspicious_users: suspiciousUsers || [],
      stats: {
        total_users_active: activeUsers || 0,
        total_alerts_today: totalAlerts || 0,
        high_risk_users: highRiskUsers,
        avg_actions_per_user: avgActions,
      },
    });
  } catch (error: any) {
    console.error('Security dashboard error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
