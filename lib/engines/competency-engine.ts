import { createGroqJsonCompletion, isGroqConfigured } from '../groq';
import { CompetencyNode, CompetencyEdge, CompetencyGraph, EdgeRelationship, EvidenceStatus } from '../types';

export async function generateCompetencyGraph(goalTitle: string, goalDescription: string, goalId: string): Promise<{ nodes: CompetencyNode[], edges: CompetencyEdge[] }> {
  if (isGroqConfigured()) {
    try {
      const prompt = `You are a curriculum designer. Create a competency graph for the goal: "${goalTitle}" - ${goalDescription}. 
Generate 15-25 nodes across different categories. Provide response in JSON format: { "nodes": [{ "id": "uuid", "name": "...", "category": "...", "description": "...", "position_x": 0-100, "position_y": 0-100 }], "edges": [{ "id": "uuid", "source_node_id": "...", "target_node_id": "...", "relationship": "prerequisite|optional|specialization|shared" }] }`;

      const data = await createGroqJsonCompletion(prompt);
      
      const nodes: CompetencyNode[] = (data.nodes || []).map((n: any, index: number) => ({
        id: n.id || crypto.randomUUID(),
        goal_id: goalId,
        name: n.name || `Competency ${index + 1}`,
        category: n.category || 'General',
        description: n.description || '',
        evidence_status: "not_started" as EvidenceStatus,
        confidence: 0,
        last_proven_at: null,
        position_x: n.position_x ?? ((index % 5) * 220),
        position_y: n.position_y ?? (Math.floor(index / 5) * 120),
        created_at: new Date().toISOString()
      }));

      const edges: CompetencyEdge[] = (data.edges || []).map((e: any) => ({
        id: e.id || crypto.randomUUID(),
        goal_id: goalId,
        source_node_id: e.source_node_id,
        target_node_id: e.target_node_id,
        relationship: (e.relationship as EdgeRelationship) || "prerequisite"
      }));

      if (nodes.length > 0) {
        return { nodes, edges };
      }
    } catch (error) {
      console.warn('Groq generation fallback:', error);
    }
  }

  // Graceful deterministic fallback if Groq API key is not configured or API fails
  const sampleCategories = [
    { cat: "Fundamentals", items: ["Python Core", "Data Structures & Algos", "Software Architecture"] },
    { cat: "Mathematics", items: ["Linear Algebra", "Probability & Statistics", "Optimization Theory"] },
    { cat: "Machine Learning", items: ["Classical ML", "Loss Functions", "Gradient Descent"] },
    { cat: "Deep Learning", items: ["Neural Networks", "Backpropagation", "Transformers", "Attention Mechanisms"] },
    { cat: "LLM Engineering", items: ["KV Cache", "Quantization", "Speculative Decoding", "Serving Systems"] },
    { cat: "Systems & Infra", items: ["Distributed Training", "CUDA Basics", "GPU Memory Optimization"] },
  ];

  const nodes: CompetencyNode[] = [];
  const edges: CompetencyEdge[] = [];

  sampleCategories.forEach((group, groupIdx) => {
    group.items.forEach((item, itemIdx) => {
      const id = crypto.randomUUID();
      nodes.push({
        id,
        goal_id: goalId,
        name: item,
        category: group.cat,
        description: `Core competency in ${item} required for ${goalTitle}.`,
        evidence_status: "not_started" as EvidenceStatus,
        confidence: 0,
        last_proven_at: null,
        position_x: groupIdx * 240,
        position_y: itemIdx * 130,
        created_at: new Date().toISOString(),
      });
    });
  });

  // Link consecutive items in each category
  for (let i = 0; i < nodes.length - 1; i++) {
    if (nodes[i].category === nodes[i + 1].category) {
      edges.push({
        id: crypto.randomUUID(),
        goal_id: goalId,
        source_node_id: nodes[i].id,
        target_node_id: nodes[i + 1].id,
        relationship: "prerequisite",
      });
    }
  }

  return { nodes, edges };
}

export async function mapSourceToGraph(sourceContent: string, goalId: string, existingNodes: CompetencyNode[]): Promise<string[]> {
  if (isGroqConfigured()) {
    try {
      const prompt = `Extract key concepts from this content and map them to the following competency node IDs: ${existingNodes.map(n => n.id + ": " + n.name).join(', ')}. Return JSON: { "matched_node_ids": ["id1", "id2"] }\n\nContent: ${sourceContent.substring(0, 2000)}`;
      const data = await createGroqJsonCompletion(prompt);
      return data.matched_node_ids || [];
    } catch (error) {
      console.warn('Map source fallback:', error);
    }
  }

  // Return matching nodes based on simple text search fallback
  const lower = sourceContent.toLowerCase();
  return existingNodes
    .filter((n) => lower.includes(n.name.toLowerCase()) || lower.includes(n.category.toLowerCase()))
    .map((n) => n.id);
}

export function computeOverlap(graphs: CompetencyGraph[]): string[] {
  if (graphs.length < 2) return [];
  const nameSets = graphs.map(g => new Set(g.nodes.map(n => n.name.toLowerCase())));
  const baseSet = nameSets[0];
  const overlap = new Set<string>();
  
  for (const name of baseSet) {
    if (nameSets.every(set => set.has(name))) {
      overlap.add(name);
    }
  }
  
  return Array.from(overlap);
}
