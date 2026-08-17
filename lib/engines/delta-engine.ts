import { CompetencyNode, ChangeImpact, LearningDeltaSummary, LearningDelta, CompetencyEdge, DeltaStatus } from '../types';

export function computeLearningDelta(userId: string, changeId: string | null, nodes: CompetencyNode[], impacts: ChangeImpact[]): LearningDeltaSummary {
  const known: LearningDelta[] = [];
  const partial: LearningDelta[] = [];
  const missing: LearningDelta[] = [];
  
  let totalHours = 0;

  for (const impact of impacts) {
    const node = nodes.find(n => n.id === impact.competency_node_id);
    if (!node) continue;
    
    const est = estimateEffort(node.evidence_status);
    totalHours += est;

    let status: DeltaStatus = "missing";
    if (node.evidence_status === "proven") status = "known";
    if (node.evidence_status === "partial") status = "partial";
    if (node.evidence_status === "stale") status = "missing"; // Treat stale as missing for delta

    const delta: LearningDelta = {
      id: crypto.randomUUID(),
      user_id: userId,
      change_id: changeId,
      competency_node_id: node.id,
      competency_name: node.name,
      status,
      required_concepts: [node.name],
      estimated_hours: est,
      created_at: new Date().toISOString()
    };

    if (status === "known") known.push(delta);
    else if (status === "partial") partial.push(delta);
    else missing.push(delta);
  }

  return {
    user_id: userId,
    change_id: changeId,
    known,
    partial,
    missing,
    total_estimated_hours: totalHours
  };
}

export function estimateEffort(status: string): number {
  if (status === "proven") return 0;
  if (status === "partial") return 2;
  return 5;
}

export function prioritize(deltas: LearningDelta[], edges: CompetencyEdge[]): LearningDelta[] {
  // Simple prioritization: dependencies first (naive topological sort approximation)
  // In a real scenario, build a graph and sort
  return [...deltas].sort((a, b) => {
    const aIsTarget = edges.some(e => e.target_node_id === a.competency_node_id);
    const bIsTarget = edges.some(e => e.target_node_id === b.competency_node_id);
    if (!aIsTarget && bIsTarget) return -1;
    if (aIsTarget && !bIsTarget) return 1;
    return 0;
  });
}
