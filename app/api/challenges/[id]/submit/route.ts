import { NextRequest, NextResponse } from 'next/server';
import { getChallenge, saveChallengeSubmission } from '@/lib/db/queries';
import { verifySubmission, updateEvidence } from '@/lib/engines/verification-engine';
import { ChallengeSubmission } from '@/lib/types';

export async function POST(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const userId = request.headers.get('x-user-id') || 'user-default';
    const body = await request.json();
    
    const challenge = getChallenge(params.id);
    if (!challenge) throw new Error("Challenge not found");
    
    const result = await verifySubmission({ code: body.code, language: body.language }, challenge);
    
    const submission: ChallengeSubmission = {
      id: crypto.randomUUID(),
      challenge_id: challenge.id,
      user_id: userId,
      code: body.code,
      language: body.language,
      status: result.status,
      execution_output: result.execution_output,
      test_results: result.test_results,
      counterexamples: result.counterexamples,
      duration_ms: result.duration_ms,
      submitted_at: new Date().toISOString()
    };
    
    saveChallengeSubmission(submission);
    
    if (result.status === 'passed') {
      updateEvidence(userId, challenge.id, challenge.competency_node_id, true);
    }
    
    return NextResponse.json({ success: true, data: submission });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
