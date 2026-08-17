import { PistonExecuteRequest, PistonExecuteResponse, PistonRuntime, TestResult } from '../types';

const PISTON_API_URL = 'https://emkc.org/api/v2/piston';

export async function listRuntimes(): Promise<PistonRuntime[]> {
  const response = await fetch(`${PISTON_API_URL}/runtimes`);
  if (!response.ok) {
    throw new Error(`Failed to list runtimes: ${response.statusText}`);
  }
  return response.json();
}

export async function executeCode(
  language: string,
  version: string,
  code: string,
  stdin?: string
): Promise<PistonExecuteResponse> {
  const requestBody: PistonExecuteRequest = {
    language,
    version,
    files: [{ content: code }],
    stdin,
    compile_timeout: 10000,
    run_timeout: 10000,
  };

  const response = await fetch(`${PISTON_API_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to execute code: ${response.statusText}`);
  }
  return response.json();
}

export async function executeWithTests(
  solutionCode: string,
  testCode: string,
  language: string
): Promise<{ executionOutput: string; testResults: TestResult[] }> {
  // Simple combined code execution
  // The testCode should ideally print JSON or structured output to parse
  const combinedCode = `${solutionCode}

${testCode}`;
  
  // Find version for language
  const runtimes = await listRuntimes();
  const runtime = runtimes.find(r => r.language === language || r.aliases.includes(language));
  if (!runtime) {
    throw new Error(`Runtime not found for language: ${language}`);
  }

  const response = await executeCode(runtime.language, runtime.version, combinedCode);
  
  // Parse test results from stdout if possible
  const stdout = response.run.stdout;
  const testResults: TestResult[] = [];
  
  // Basic parsing assuming tests print "TEST_PASS: name" or "TEST_FAIL: name | expected | actual"
  const lines = stdout.split('\n');
  for (const line of lines) {
    if (line.startsWith('TEST_PASS:')) {
      testResults.push({ name: line.replace('TEST_PASS:', '').trim(), passed: true, input: '', expected: '', actual: '' });
    } else if (line.startsWith('TEST_FAIL:')) {
      const parts = line.replace('TEST_FAIL:', '').split('|').map(s => s.trim());
      testResults.push({ name: parts[0], passed: false, input: '', expected: parts[1] || '', actual: parts[2] || '' });
    }
  }

  return { executionOutput: stdout, testResults };
}
