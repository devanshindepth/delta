import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const stats = getDashboardStats(userId, 'default-goal-id');
    
    const profile = {
      id: userId,
      name: "Default User",
      email: "user@example.com",
      stats
    };
    
    return NextResponse.json({ success: true, data: profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
