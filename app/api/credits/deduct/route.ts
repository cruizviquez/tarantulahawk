import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { userId, amount, transactionType, description, metadata } = await request.json();

    if (!userId || !amount || !transactionType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, amount, transactionType' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Use service role client to call the function
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_transaction_type: transactionType,
      p_description: description || null,
      p_metadata: metadata || {}
    });

    if (error) {
      console.error('Error deducting credits:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // data is an array with one row
    const result = data[0];

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.message,
          currentBalance: result.new_balance 
        },
        { status: 402 } // Payment Required
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.new_balance,
      transactionId: result.transaction_id,
      message: result.message
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
