import { NextRequest, NextResponse } from 'next/server';
import { listCompetencyNodes, listCompetencyEdges } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('goalId');
    if (!goalId) throw new Error("goalId required");
    
    const nodes = listCompetencyNodes(goalId);
    const edges = listCompetencyEdges(goalId);
    
    return NextResponse.json({ success: true, data: { nodes, edges } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
