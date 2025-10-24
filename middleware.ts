import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create Redis client (using Upstash Redis)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

// Rate limiters for different tiers
const rateLimiters = {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 requests per hour
    analytics: true,
    prefix: '@tarantulahawk/ratelimit/free',
  }),
  paid: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 requests per hour
    analytics: true,
    prefix: '@tarantulahawk/ratelimit/paid',
  }),
  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10000, '1 h'), // 10k requests per hour (effectively unlimited)
    analytics: true,
    prefix: '@tarantulahawk/ratelimit/enterprise',
  }),
};

/**
 * Extract client IP address from various headers
 */
function getClientIP(request: NextRequest): string {
  // Cloudflare
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;

  // Standard forwarded headers
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }

  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) return xRealIP;

    // Fallback to unknown (IP extraction handles most cases)
    return 'unknown';
}

/**
 * Determine user tier from Supabase auth token
 */
async function getUserTier(request: NextRequest): Promise<'free' | 'paid' | 'enterprise'> {
  try {
    // Extract Supabase auth token from cookie
    const token = request.cookies.get('sb-access-token')?.value;
    if (!token) return 'free';

    // Parse JWT to get user_id (simple decode, not verifying - Supabase handles that)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.sub;

    // Fetch user profile from Supabase to get subscription_tier
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) return 'free';

    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) return 'free';

    const data = await response.json();
    if (!data || data.length === 0) return 'free';

    return data[0].subscription_tier || 'free';
  } catch (error) {
    console.error('Error determining user tier:', error);
    return 'free';
  }
}

export async function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting if Redis is not configured (development mode)
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('⚠️ Rate limiting disabled: Upstash Redis not configured');
    return NextResponse.next();
  }

  try {
    // Get client IP and user tier
    const clientIP = getClientIP(request);
    const tier = await getUserTier(request);

    // Select appropriate rate limiter
    const rateLimiter = rateLimiters[tier];

    // Check rate limit (use IP as identifier)
    const { success, limit, reset, remaining } = await rateLimiter.limit(clientIP);

    // Add rate limit headers to response
    const response = success
      ? NextResponse.next()
      : new NextResponse(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. You are limited to ${limit} requests per hour on the ${tier} tier.`,
            tier,
            limit,
            reset: new Date(reset).toISOString(),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

    // Set rate limit headers (standard RateLimit spec)
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());
    response.headers.set('X-RateLimit-Tier', tier);

    return response;
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow request to proceed (fail open)
    return NextResponse.next();
  }
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    '/api/:path*', // All API routes
  ],
};
