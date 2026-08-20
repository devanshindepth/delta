import { NextResponse } from "next/server";
import {
  getObjectiveById,
  getQuestionsByObjective,
  getRecentScrapedSourceForObjective,
} from "@/lib/db/queries";
import { createGroqJsonCompletion } from "@/lib/groq";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const objective = getObjectiveById(id);
    if (!objective) {
      return NextResponse.json(
        { success: false, error: "Objective not found" },
        { status: 404 }
      );
    }

    // 1. Check existing questions in DB
    const existing = getQuestionsByObjective(id);
    if (existing && existing.length > 0) {
      const randomIndex = Math.floor(Math.random() * existing.length);
      return NextResponse.json({
        success: true,
        data: existing[randomIndex],
      });
    }

    // 2. Generate a practice question using Groq and cached documentation
    const cached = getRecentScrapedSourceForObjective(id, 168);
    let extractionResult: any = null;
    if (cached?.raw_content) {
      try {
        extractionResult = JSON.parse(cached.raw_content);
      } catch {
        // Not JSON
      }
    }

    const keyConceptsText = extractionResult?.key_concepts
      ? JSON.stringify(extractionResult.key_concepts)
      : objective.description;

    const learningOutcomesText = extractionResult?.learning_outcomes
      ? JSON.stringify(extractionResult.learning_outcomes)
      : objective.title;

    const prompt = `You are an expert exam question author for the ${objective.certification_id || "cloud"} certification exam.

Objective: ${objective.objective_code}. ${objective.title}
Domain: ${objective.domain_title || ""}
Description: ${objective.description}

Here is official documentation content for this objective:
Key Concepts: ${keyConceptsText}
Learning Outcomes: ${learningOutcomesText}

Write ONE high-quality multiple choice question (MCQ) testing a real decision or tradeoff regarding this topic.
The question must have 4 options and exactly 1 correct answer (specified as index 0, 1, 2, or 3).

Return ONLY valid JSON with this exact structure:
{
  "stem": "Detailed exam-style question scenario with concrete requirements...",
  "options": [
    "Option A description",
    "Option B description",
    "Option C description",
    "Option D description"
  ],
  "correct_answer": 0,
  "explanation": "Detailed 2-3 sentence explanation of why the correct answer is right and why distractors are wrong."
}`;

    const aiRes = await createGroqJsonCompletion(prompt);

    const generatedQuestion = {
      id: `gen-q-${id}-${Date.now()}`,
      objective_id: id,
      question_type: "mcq",
      difficulty: "intermediate",
      stem: aiRes.stem || aiRes.question,
      options: aiRes.options || [],
      correct_answer: typeof aiRes.correct_answer === "number" ? aiRes.correct_answer : (typeof aiRes.correct_index === "number" ? aiRes.correct_index : 0),
      explanation: aiRes.explanation || "Correct based on official documentation.",
      official_doc_url: cached?.url || objective.skills?.[0]?.official_doc_url || null,
      service_tags: [objective.title],
      validation_status: "ai_generated",
    };

    return NextResponse.json({
      success: true,
      data: generatedQuestion,
    });
  } catch (error: any) {
    console.error("[question GET error]", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const objective = getObjectiveById(id);
    if (!objective) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    const cached = getRecentScrapedSourceForObjective(id, 168);
    if (!cached || !cached.raw_content) {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }

    let extractionResult: any;
    try {
      extractionResult = JSON.parse(cached.raw_content);
      if (!extractionResult.title && !extractionResult.key_concepts) {
        return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
      }
    } catch {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }

    const prompt = `You are an expert instructor preparing a developer for an exam.
Here is the official documentation for the topic "${objective.title}":
Key Concepts: ${JSON.stringify(extractionResult.key_concepts)}
Learning Outcomes: ${JSON.stringify(extractionResult.learning_outcomes)}

Generate a single multiple-choice practice question based ONLY on these facts. Do not invent facts outside of this content.
Return ONLY valid JSON with this exact structure:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_index": 0,
  "explanation": "Brief explanation of why this is correct based on the text."
}`;

    const result = await createGroqJsonCompletion(prompt);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
