import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/src/utils/authGuard';

export async function GET(req: NextRequest) {
  try {
    // Verify token WITHOUT restricting by role
    const user = await authenticate(req);
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Token is valid',
      user 
    });
  } catch (error) {
    console.error('Verify API error:', error);
    return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 });
  }
}
