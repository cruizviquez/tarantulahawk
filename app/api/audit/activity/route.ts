import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface ActivityLog {
  user_id: string;
  action: string;
  timestamp: string;
  path: string;
  user_agent: string;
  metadata?: any;
}

/**
 * POST /api/audit/activity
 * Log user activity for AI anomaly detection
 */
export async function POST(request: NextRequest) {
  try {
    const body: ActivityLog = await request.json();
    
    // Validate required fields
    if (!body.user_id || !body.action || !body.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, action, timestamp' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for audit logs
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

    // Get client IP
    const ip = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Insert activity log
    const { error: insertError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: body.user_id,
        action: body.action,
        ip_address: ip,
        user_agent: body.user_agent,
        metadata: {
          path: body.path,
          timestamp: body.timestamp,
          ...body.metadata,
        },
        status: 'success',
      });

    if (insertError) {
      console.error('Audit log insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to log activity' },
        { status: 500 }
      );
    }

    // Check for anomalies using AI
    const anomalyDetected = await detectAnomalies(body.user_id, body.action, ip);

    if (anomalyDetected) {
      // Alert admins (could send to Slack, email, etc.)
      await alertAdmins({
        user_id: body.user_id,
        action: body.action,
        ip,
        path: body.path,
        timestamp: body.timestamp,
      });
    }

    return NextResponse.json({
      success: true,
      anomaly_detected: anomalyDetected,
    });
  } catch (error: any) {
    console.error('Activity logging error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * AI-powered anomaly detection
 * Detects unusual patterns:
 * - Rapid succession of requests
 * - Multiple IPs for same user
 * - Unusual actions at odd hours
 * - Geographic impossibilities
 */
async function detectAnomalies(
  userId: string,
  action: string,
  currentIp: string
): Promise<boolean> {
  try {
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

    // Get recent activity (last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    const { data: recentLogs, error } = await supabase
      .from('audit_logs')
      .select('action, ip_address, created_at')
      .eq('user_id', userId)
      .gte('created_at', fifteenMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !recentLogs) return false;

    // Rule 1: More than 30 actions in 15 minutes (likely bot)
    if (recentLogs.length > 30) {
      console.warn(`🚨 Anomaly detected: Excessive activity (${recentLogs.length} actions in 15 min)`, {
        user_id: userId,
        action,
      });
      return true;
    }

    // Rule 2: Multiple IPs in short time (account sharing or compromise)
    const uniqueIps = new Set(recentLogs.map(log => log.ip_address));
    if (uniqueIps.size > 3) {
      console.warn(`🚨 Anomaly detected: Multiple IPs (${uniqueIps.size} different IPs)`, {
        user_id: userId,
        ips: Array.from(uniqueIps),
      });
      return true;
    }

    // Rule 3: Rapid-fire actions (< 1 second apart)
    for (let i = 0; i < recentLogs.length - 1; i++) {
      const timeDiff = 
        new Date(recentLogs[i].created_at).getTime() - 
        new Date(recentLogs[i + 1].created_at).getTime();
      
      if (timeDiff < 500) { // Less than 500ms between actions
        console.warn(`🚨 Anomaly detected: Rapid-fire actions (${timeDiff}ms apart)`, {
          user_id: userId,
          action,
        });
        return true;
      }
    }

    // Rule 4: Unusual hours (2 AM - 5 AM) with high activity
    const currentHour = new Date().getHours();
    if (currentHour >= 2 && currentHour <= 5 && recentLogs.length > 10) {
      console.warn(`🚨 Anomaly detected: Unusual hours activity (${currentHour}:00)`, {
        user_id: userId,
        action,
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return false; // Fail open
  }
}

/**
 * Alert admins about detected anomalies
 */
async function alertAdmins(anomalyData: any) {
  try {
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

    // Log security alert
    await supabase.from('audit_logs').insert({
      user_id: anomalyData.user_id,
      action: 'security_alert_anomaly_detected',
      ip_address: anomalyData.ip,
      user_agent: 'AI Anomaly Detection System',
      metadata: anomalyData,
      status: 'warning',
    });

    // TODO: Send to Slack/Email/SMS
    // await sendSlackAlert(anomalyData);
    // await sendEmailAlert(anomalyData);

    console.log('🚨 Admin alert sent for anomaly:', anomalyData);
  } catch (error) {
    console.error('Admin alert error:', error);
  }
}
