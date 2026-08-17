import { NextRequest, NextResponse } from 'next/server';
import { listGoals, saveGoal, saveCompetencyNode, saveCompetencyEdge, saveChallenge } from '@/lib/db/queries';
import { generateCompetencyGraph } from '@/lib/engines/competency-engine';
import { generateChallenge } from '@/lib/engines/challenge-engine';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const goals = listGoals(userId);
    return NextResponse.json({ success: true, data: goals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const body = await request.json();
    
    const goal = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: body.title,
      description: body.description || '',
      status: "active" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    saveGoal(goal);
    
    const { nodes, edges } = await generateCompetencyGraph(goal.title, goal.description, goal.id);
    nodes.forEach(saveCompetencyNode);
    edges.forEach(saveCompetencyEdge);

    // Automatically generate executable challenges for the primary competency nodes
    const nodesToGenerate = nodes.slice(0, Math.min(6, nodes.length));
    for (const node of nodesToGenerate) {
      try {
        const challenge = await generateChallenge(node, null);
        saveChallenge(challenge);
      } catch (err) {
        console.warn(`Could not generate challenge for node ${node.name}:`, err);
      }
    }

    return NextResponse.json({ success: true, data: goal });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
