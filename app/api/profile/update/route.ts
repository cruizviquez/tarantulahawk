import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateAuth } from '@/app/lib/api-auth-helpers';

/**
 * POST /api/profile/update
 * Updates user profile information (name, company, phone, position, avatar_url)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, company, phone, position, avatar_url } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    // Verify authenticated user
    const auth = await validateAuth(request);
    
    if (auth.error || !auth.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user can only update their own profile
    if (auth.user.id !== user_id) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot update another user\'s profile' },
        { status: 403 }
      );
    }

    // Update profiles table
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: name || null,
        company: company || null,
        company_name: company || null, // Sync both fields
        phone: phone || null,
        position: position || null,
        avatar_url: avatar_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id)
      .select()
      .single();

    if (error) {
      console.error('[PROFILE UPDATE] Error:', error);
      return NextResponse.json(
        { error: 'Failed to update profile', details: error.message },
        { status: 500 }
      );
    }

    // Also update auth.users metadata for consistency
    try {
      await supabase.auth.updateUser({
        data: {
          name: name || auth.user.email,
          company: company || '',
        }
      });
    } catch (metaError) {
      console.warn('[PROFILE UPDATE] Failed to update user metadata:', metaError);
      // Non-critical - continue
    }

    console.log('[PROFILE UPDATE] Success:', { user_id, name, company });

    return NextResponse.json({
      success: true,
      profile: data,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('[PROFILE UPDATE] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profile/update - Method not allowed
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}
