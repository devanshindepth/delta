import { executeWithTests } from '../sandbox/piston';
import { generateCounterExamples } from './challenge-engine';
import { Challenge, SubmissionStatus, TechnicalChange } from '../types';
import { saveEvidenceRecord, updateNodeEvidence, listCompetencyNodes, saveCompetencyNode } from '../db/queries';

export async function verifySubmission(submission: { code: string; language: string }, challenge: Challenge) {
  const start = Date.now();
  
  const { executionOutput, testResults } = await executeWithTests(submission.code, challenge.test_code, submission.language);
  
  const duration_ms = Date.now() - start;
  const passed = testResults.length > 0 && testResults.every(tr => tr.passed);
  let status: SubmissionStatus = passed ? 'passed' : 'failed';
  
  let counterexamples: any[] = [];
  if (!passed) {
    counterexamples = await generateCounterExamples(submission.code, testResults, challenge);
  }

  return {
    status,
    execution_output: executionOutput,
    test_results: testResults,
    counterexamples,
    duration_ms
  };
}

export function updateEvidence(userId: string, challengeId: string, competencyNodeId: string, passed: boolean) {
  if (!passed) return;
  
  saveEvidenceRecord({
    id: crypto.randomUUID(),
    user_id: userId,
    competency_node_id: competencyNodeId,
    evidence_type: 'challenge_passed',
    details: 'Passed challenge successfully',
    confidence_delta: 0.5,
    challenge_id: challengeId,
    created_at: new Date().toISOString()
  });

  updateNodeEvidence(competencyNodeId, 'proven', 1.0, new Date().toISOString());
}

export function checkStaleEvidence(userId: string, goalId: string, changes: TechnicalChange[]) {
  const nodes = listCompetencyNodes(goalId);
  for (const node of nodes) {
    if (node.evidence_status === 'proven' || node.evidence_status === 'partial') {
      // Simplified: if any change affects this node, mark as stale
      // Real implementation would cross-reference impacts
      node.evidence_status = 'stale';
      saveCompetencyNode(node);
    }
  }
}
