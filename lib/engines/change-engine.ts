import { createGroqJsonCompletion, isGroqConfigured } from '../groq';
import { TechnicalChange, ChangeImpact, CompetencyNode, ChangeSignificance, ChangeType } from '../types';

export async function analyzeChange(rawContent: string, sourceUrl: string, sourceTitle: string): Promise<TechnicalChange> {
  if (isGroqConfigured()) {
    try {
      const prompt = `Analyze this technical content and extract the change details. Return JSON:
{
  "title": "Short title",
  "source_excerpt": "Relevant quote",
  "change_type": "new_release|api_change|framework_update|model_release|protocol_change|tool_update",
  "significance": "breaking|new_capability|deprecated|new_best_practice|cosmetic|documentation",
  "summary": "Detailed summary",
  "affected_technologies": ["tech1", "tech2"]
}
Content: ${rawContent.substring(0, 3000)}`;

      const data = await createGroqJsonCompletion(prompt);
      
      return {
        id: crypto.randomUUID(),
        title: data.title || sourceTitle || 'Technical Change',
        source_url: sourceUrl,
        source_title: sourceTitle,
        source_excerpt: data.source_excerpt || rawContent.substring(0, 200),
        change_type: (data.change_type as ChangeType) || 'new_release',
        significance: classifySignificance(data),
        summary: data.summary || rawContent.substring(0, 300),
        raw_content: rawContent,
        affected_technologies: data.affected_technologies || [],
        detected_at: new Date().toISOString(),
        scraped_at: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Groq change analysis fallback:', error);
    }
  }

  return {
    id: crypto.randomUUID(),
    title: sourceTitle || 'Technical Update Detected',
    source_url: sourceUrl,
    source_title: sourceTitle,
    source_excerpt: rawContent.substring(0, 200),
    change_type: 'new_release',
    significance: 'new_capability',
    summary: rawContent.substring(0, 300),
    raw_content: rawContent,
    affected_technologies: ['AI / ML', 'Backend'],
    detected_at: new Date().toISOString(),
    scraped_at: new Date().toISOString()
  };
}

export function classifySignificance(data: any): ChangeSignificance {
  const sig = data.significance;
  const valid = ["breaking", "new_capability", "deprecated", "new_best_practice", "cosmetic", "documentation"];
  return valid.includes(sig) ? sig as ChangeSignificance : "new_capability";
}

export function computeImpact(change: TechnicalChange, nodes: CompetencyNode[], goalId: string, userId: string): ChangeImpact[] {
  const impacts: ChangeImpact[] = [];
  const textToSearch = `${change.title} ${change.summary} ${change.affected_technologies.join(' ')}`.toLowerCase();

  for (const node of nodes) {
    if (textToSearch.includes(node.name.toLowerCase()) || textToSearch.includes(node.category.toLowerCase())) {
      impacts.push({
        id: crypto.randomUUID(),
        change_id: change.id,
        competency_node_id: node.id,
        goal_id: goalId,
        user_id: userId,
        relevance_score: 0.85,
        relevance_reason: `Affects core capability: ${node.name} (${node.category})`,
        status: 'new',
        created_at: new Date().toISOString()
      });
    }
  }

  // If no direct keyword match, assign to first relevant or first 2 nodes with lower score
  if (impacts.length === 0 && nodes.length > 0) {
    for (let i = 0; i < Math.min(2, nodes.length); i++) {
      impacts.push({
        id: crypto.randomUUID(),
        change_id: change.id,
        competency_node_id: nodes[i].id,
        goal_id: goalId,
        user_id: userId,
        relevance_score: 0.6,
        relevance_reason: `Potential prerequisite or related module for ${nodes[i].name}`,
        status: 'new',
        created_at: new Date().toISOString()
      });
    }
  }
  
  return impacts;
}
