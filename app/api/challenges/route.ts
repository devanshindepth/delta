import { NextRequest, NextResponse } from 'next/server';
import { listChallenges, saveChallenge, listGoals, listCompetencyNodes, getCompetencyNode } from '@/lib/db/queries';
import { generateChallenge } from '@/lib/engines/challenge-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const competencyNodeId = searchParams.get('competencyNodeId') || undefined;
    const difficulty = searchParams.get('difficulty') || undefined;
    const changeId = searchParams.get('changeId') || undefined;
    const userId = request.headers.get('x-user-id') || 'user-default';
    
    let challenges = listChallenges({ competencyNodeId, difficulty, changeId });

    // If no challenges exist yet, auto-populate from existing goals/competency nodes
    if (challenges.length === 0 && !competencyNodeId && !changeId) {
      const goals = listGoals(userId);
      if (goals.length > 0) {
        const nodes = listCompetencyNodes(goals[0].id);
        const nodesToGenerate = nodes.slice(0, Math.min(6, nodes.length));
        for (const node of nodesToGenerate) {
          try {
            const ch = await generateChallenge(node, null);
            saveChallenge(ch);
          } catch (e) {
            console.warn('Auto challenge gen error:', e);
          }
        }
        challenges = listChallenges({ competencyNodeId, difficulty, changeId });
      }
    }

    return NextResponse.json({ success: true, data: challenges });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const body = await request.json();
    
    let targetNode = null;
    if (body.competencyNodeId) {
      targetNode = getCompetencyNode(body.competencyNodeId);
    } else if (body.goalId) {
      const nodes = listCompetencyNodes(body.goalId);
      if (nodes.length > 0) {
        // Pick an unproven node or the first node
        targetNode = nodes.find(n => n.evidence_status !== 'proven') || nodes[0];
      }
    } else {
      const goals = listGoals(userId);
      if (goals.length > 0) {
        const nodes = listCompetencyNodes(goals[0].id);
        targetNode = nodes.find(n => n.evidence_status !== 'proven') || nodes[0];
      }
    }

    if (!targetNode) {
      // Create a default competency node under a default goal if none exists
      return NextResponse.json({ 
        success: false, 
        error: "Please create a career goal first before generating challenges." 
      }, { status: 400 });
    }

    const challenge = await generateChallenge(targetNode, null);
    if (body.difficulty) {
      challenge.difficulty = body.difficulty;
    }
    if (body.title) {
      challenge.title = body.title;
    }

    saveChallenge(challenge);

    return NextResponse.json({ success: true, data: challenge });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
