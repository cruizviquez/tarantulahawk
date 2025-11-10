import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from '@/app/lib/api-auth-helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const auth = await validateAuth(request);
    if (auth.error || !auth.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Allow user to query their own balance or use query param
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    const userId = queryUserId || auth.user.id;
    
    // Only allow querying own balance unless admin
    if (queryUserId && queryUserId !== auth.user.id && auth.profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, name, company, account_balance_usd, subscription_tier')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      balance: profile.account_balance_usd || 0,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        company: profile.company,
        subscription_tier: profile.subscription_tier
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
