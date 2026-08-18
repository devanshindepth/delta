import { NextResponse } from "next/server";
import { getQuestionsByObjective, getObjectiveById } from "@/lib/db/queries";
import { getDb } from "@/lib/db/index";
import { isGroqConfigured, createGroqJsonCompletion } from "@/lib/groq";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // First: check existing seeded questions
    const existing = getQuestionsByObjective(id);
    if (existing.length > 0) {
      const q = existing[Math.floor(Math.random() * existing.length)];
      return NextResponse.json({ success: true, data: q });
    }

    // No seeded question — generate one with Groq if available
    const objective = getObjectiveById(id);
    if (!objective) {
      return NextResponse.json({ success: true, data: null });
    }

    if (!isGroqConfigured()) {
      // Return a basic MCQ placeholder when no LLM is configured
      const fallback = buildFallbackQuestion(objective);
      return NextResponse.json({ success: true, data: fallback });
    }

    // Generate via Groq
    const generated = await generateQuestionWithGroq(objective);
    if (!generated) {
      const fallback = buildFallbackQuestion(objective);
      return NextResponse.json({ success: true, data: fallback });
    }

    // Persist so we don't regenerate every time
    const db = getDb();
    const optJson = JSON.stringify(generated.options);
    const correctStr = typeof generated.correct_answer === "object"
      ? JSON.stringify(generated.correct_answer)
      : generated.correct_answer;

    const qId = `q-gen-${id}-${Date.now()}`;
    db.prepare(`
      INSERT OR IGNORE INTO practice_questions
        (id, objective_id, question_type, difficulty, stem, options_json, correct_answer, explanation, official_doc_url, service_tags, validation_status)
      VALUES (?, ?, 'mcq', 'exam', ?, ?, ?, ?, ?, '[]', 'ai_generated')
    `).run(qId, id, generated.stem, optJson, correctStr, generated.explanation || "", generated.official_doc_url || "");

    // Return in parsed form
    return NextResponse.json({
      success: true,
      data: {
        ...generated,
        id: qId,
        objective_id: id,
        question_type: "mcq",
        difficulty: "exam",
        service_tags: [],
        ordering_items: [],
        matching_pairs: [],
        case_study: null,
      },
    });
  } catch (error: any) {
    console.error("[question] route error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function buildFallbackQuestion(objective: any) {
  const options = [
    { id: "opt-a", text: "Review the official documentation for this objective", explanation: "The official docs are the authoritative source for exam content." },
    { id: "opt-b", text: "Skip this objective entirely", explanation: "Skipping critical objectives will reduce your readiness score." },
    { id: "opt-c", text: "Rely only on third-party summaries", explanation: "Third-party summaries may be outdated or inaccurate." },
    { id: "opt-d", text: "Guess on the exam", explanation: "Guessing without preparation is not a reliable strategy." },
  ];

  return {
    id: `fallback-${objective.id}`,
    objective_id: objective.id,
    question_type: "mcq",
    difficulty: "exam",
    stem: `Which approach best prepares you for the objective: "${objective.title}"?\n\n${objective.description}`,
    options,
    correct_answer: "opt-a",
    explanation: `The best approach for mastering "${objective.title}" is to review the official documentation. This objective covers: ${objective.description}`,
    official_doc_url: null,
    service_tags: [],
    ordering_items: [],
    matching_pairs: [],
    case_study: null,
  };
}

async function generateQuestionWithGroq(objective: any) {
  const prompt = `You are an expert certification exam question writer for technical cloud certifications.

Generate a realistic, exam-quality multiple-choice question (MCQ) for the following exam objective:

Objective: ${objective.objective_code}. ${objective.title}
Description: ${objective.description}
Domain: ${objective.domain_title}
Importance: ${objective.importance}

Requirements:
- The question must test real technical knowledge, not meta-knowledge about studying
- Write a scenario-based question (e.g. "You are building X, which approach should you take?")
- Provide exactly 4 answer options (opt-a through opt-d)
- Only one correct answer
- Include a brief explanation for each option
- The explanation field should explain WHY the correct answer is correct and why the others are wrong
- Return valid JSON only

Return this exact JSON structure:
{
  "stem": "question text here",
  "options": [
    {"id": "opt-a", "text": "...", "explanation": "..."},
    {"id": "opt-b", "text": "...", "explanation": "..."},
    {"id": "opt-c", "text": "...", "explanation": "..."},
    {"id": "opt-d", "text": "...", "explanation": "..."}
  ],
  "correct_answer": "opt-a",
  "explanation": "Full explanation of why the correct answer is correct and others are wrong.",
  "official_doc_url": "https://learn.microsoft.com/..."
}`;

  try {
    const result = await createGroqJsonCompletion(prompt);

    if (!result?.stem || !Array.isArray(result?.options) || result.options.length !== 4) {
      console.warn("[question] Groq returned malformed question:", result);
      return null;
    }

    return result;
  } catch (err: any) {
    console.warn("[question] Groq generation failed:", err?.message);
    return null;
  }
}
