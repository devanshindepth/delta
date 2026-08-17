import { NextRequest, NextResponse } from 'next/server';
import { getChallenge, listChallengeSubmissions } from '@/lib/db/queries';

export async function GET(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const userId = request.headers.get('x-user-id') || 'user-default';
    
    const challenge = getChallenge(params.id);
    if (!challenge) throw new Error("Challenge not found");
    
    const submissions = listChallengeSubmissions(params.id, userId);
    
    return NextResponse.json({ success: true, data: { challenge, submissions } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
