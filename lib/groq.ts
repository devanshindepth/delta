import Groq from 'groq-sdk';

let groqInstance: Groq | null = null;
let cachedActiveModels: string[] | null = null;

export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(key && key.trim() !== '' && !key.includes('your_groq_api_key_here') && !key.includes('dummy_key'));
}

export function getGroq(): Groq {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY || 'gsk_dev_dummy_key_to_prevent_build_crash';
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
}

// Clean and extract valid JSON from LLM output, stripping markdown code blocks if present
export function cleanAndParseJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return {};
  
  let cleaned = raw.trim();
  
  // Remove markdown code fences e.g. ```json ... ``` or ``` ... ```
  if (cleaned.includes('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/im, '')
      .replace(/\n?```\s*$/im, '')
      .trim();
  }
  
  // Isolate outermost JSON object bounds if extra conversational prose is present
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  return JSON.parse(cleaned);
}

// Dynamically discover all active models from Groq API
async function getAvailableGroqModels(groq: Groq): Promise<string[]> {
  if (cachedActiveModels && cachedActiveModels.length > 0) {
    return cachedActiveModels;
  }

  try {
    const response = await groq.models.list();
    if (response?.data && Array.isArray(response.data)) {
      // Filter active chat/completion models
      const activeIds = response.data
        .filter((m: any) => m.active !== false && !m.id.includes('whisper') && !m.id.includes('guard'))
        .map((m: any) => m.id);

      if (activeIds.length > 0) {
        cachedActiveModels = activeIds;
        return activeIds;
      }
    }
  } catch (err) {
    console.warn('Could not dynamically list Groq models:', err);
  }

  // Default fallback priority list
  return [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'gpt-oss-120b',
    'gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'gemma2-9b-it',
    'llama-3.2-3b-preview',
    'llama-3.2-1b-preview',
  ];
}

export async function createGroqJsonCompletion(prompt: string): Promise<any> {
  const groq = getGroq();
  
  // 1. Get models from Groq API dynamically + manual env override
  const activeModels = await getAvailableGroqModels(groq);

  // Preferred priority ranking - prioritizing GPT OSS models as requested
  const priorityOrder = [
    process.env.GROQ_MODEL,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'gpt-oss-120b',
    'gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'deepseek-r1-distill-llama-70b',
    'gemma2-9b-it',
    'llama-3.2-3b-preview',
    'llama-3.2-1b-preview',
    ...activeModels,
  ].filter(Boolean) as string[];

  // Deduplicate while preserving priority order
  const modelsToTry = Array.from(new Set(priorityOrder));

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model,
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content || '{}';
      return cleanAndParseJson(content);
    } catch (err: any) {
      lastError = err;

      const isModelUnavailable =
        err?.status === 404 ||
        (err?.status === 400 && (err?.error?.error?.code === 'model_decommissioned' || err?.error?.error?.code === 'invalid_request_error')) ||
        err?.error?.error?.code === 'model_not_found' ||
        err?.error?.error?.code === 'model_decommissioned' ||
        (err?.message && (
          err.message.includes('does not exist') ||
          err.message.includes('decommissioned') ||
          err.message.includes('not supported') ||
          err.message.includes('model')
        ));

      if (isModelUnavailable) {
        console.warn(`Groq model '${model}' is unavailable/decommissioned, trying next available model...`);
        continue;
      }

      // If JSON parse failed on markdown output, try cleanAndParseJson fallback
      if (err instanceof SyntaxError) {
        console.warn(`JSON syntax error for model '${model}', attempting fallback parse...`);
        try {
          const rawContent = (lastError as any)?.response || '';
          if (rawContent) return cleanAndParseJson(rawContent);
        } catch {
          // continue to next model
        }
      }

      // If it's an authorization or rate limit error, rethrow
      throw err;
    }
  }

  throw lastError;
}
