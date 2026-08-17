import { createGroqJsonCompletion, isGroqConfigured } from '../groq';
import { Challenge, CompetencyNode, TechnicalChange, ChallengeType, ChallengeDifficulty, VerificationMethod, TestResult, CounterExample } from '../types';

export async function generateChallenge(competencyNode: CompetencyNode, changeContext: TechnicalChange | null): Promise<Challenge> {
  if (isGroqConfigured()) {
    try {
      let prompt = `Create a coding challenge for the competency: ${competencyNode.name}.`;
      if (changeContext) {
        prompt += ` Context of recent change: ${changeContext.summary}.`;
      }
      prompt += ` Return JSON:
{
  "title": "Challenge title",
  "description": "Challenge description",
  "challenge_type": "implement|debug|compare|optimize",
  "difficulty": "beginner|intermediate|advanced",
  "language": "python",
  "starter_code": "def solution():\n  pass",
  "test_code": "assert solution() == ...\nprint('ALL_TESTS_PASSED')",
  "expected_output": null,
  "verification_method": "automated_tests",
  "estimated_minutes": 30,
  "why_it_matters": "Reason"
}`;

      const data = await createGroqJsonCompletion(prompt);

      return {
        id: crypto.randomUUID(),
        competency_node_id: competencyNode.id,
        change_id: changeContext ? changeContext.id : null,
        title: data.title || `Implement ${competencyNode.name}`,
        description: data.description || `Build and verify a solution for ${competencyNode.name}.`,
        challenge_type: (data.challenge_type as ChallengeType) || 'implement',
        difficulty: (data.difficulty as ChallengeDifficulty) || 'intermediate',
        language: data.language || 'python',
        starter_code: data.starter_code || `def solve(inputs):\n    # TODO: Implement capability for ${competencyNode.name}\n    return inputs\n`,
        test_code: data.test_code || `assert solve("test") == "test"\nprint("ALL_TESTS_PASSED")\n`,
        expected_output: data.expected_output || null,
        verification_method: (data.verification_method as VerificationMethod) || 'automated_tests',
        estimated_minutes: data.estimated_minutes || 30,
        why_it_matters: data.why_it_matters || `Proves real execution capability in ${competencyNode.name}.`,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Groq challenge generation fallback:', error);
    }
  }

  return {
    id: crypto.randomUUID(),
    competency_node_id: competencyNode.id,
    change_id: changeContext ? changeContext.id : null,
    title: `Verify ${competencyNode.name}`,
    description: `Implement and verify the invariant properties of ${competencyNode.name}.`,
    challenge_type: 'implement',
    difficulty: 'intermediate',
    language: 'python',
    starter_code: `def solution(data):\n    # Implement verification logic for ${competencyNode.name}\n    return data\n`,
    test_code: `result = solution("delta")\nassert result == "delta", f"Expected 'delta', got {result}"\nprint("ALL_TESTS_PASSED")\n`,
    expected_output: 'ALL_TESTS_PASSED',
    verification_method: 'automated_tests',
    estimated_minutes: 25,
    why_it_matters: `Demonstrates verified understanding of ${competencyNode.name}.`,
    created_at: new Date().toISOString()
  };
}

export async function generateCounterExamples(code: string, testResults: TestResult[], challenge: Challenge): Promise<CounterExample[]> {
  if (testResults.every(tr => tr.passed)) return [];

  const failedTests = testResults.filter(tr => !tr.passed);

  if (isGroqConfigured()) {
    try {
      const prompt = `Analyze these failed tests and the code. Generate counterexamples to help the user understand why it failed. Return JSON:
{
  "counterexamples": [{
    "input": "...",
    "your_result": "...",
    "expected": "...",
    "failure_trace": "...",
    "invariant_violated": "..."
  }]
}
Code: ${code}
Failed Tests: ${JSON.stringify(failedTests)}`;

      const data = await createGroqJsonCompletion(prompt);
      if (data.counterexamples && data.counterexamples.length > 0) {
        return data.counterexamples;
      }
    } catch (error) {
      console.warn('Groq counterexample generation fallback:', error);
    }
  }

  // Deterministic counterexample generation from failed test outputs
  return failedTests.map((ft, idx) => ({
    input: ft.input || `Test Case #${idx + 1}`,
    your_result: ft.actual || 'Execution error / Incomplete output',
    expected: ft.expected || 'Valid invariant adherence',
    failure_trace: ft.error || 'AssertionError: Output did not match expected boundary constraints',
    invariant_violated: `Target competency rule violated in test "${ft.name || 'Assertion failure'}"`
  }));
}
