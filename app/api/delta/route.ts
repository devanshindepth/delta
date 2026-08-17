import { NextRequest, NextResponse } from 'next/server';
import { listCompetencyNodes, listChangeImpacts } from '@/lib/db/queries';
import { computeLearningDelta } from '@/lib/engines/delta-engine';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const { searchParams } = new URL(request.url);
    const changeId = searchParams.get('changeId');
    
    // In real scenario, fetch specific nodes. Here we mock a generic goal
    const nodes = listCompetencyNodes('default-goal-id');
    const impacts = listChangeImpacts(userId, changeId || undefined);
    
    const summary = computeLearningDelta(userId, changeId, nodes, impacts);
    
    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
