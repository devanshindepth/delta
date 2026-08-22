import { NextResponse } from "next/server";
import {
  getObjectiveById,
  getQuestionsByObjective,
  getRecentScrapedSourceForObjective,
  savePracticeQuestion,
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

    const isMultiSelect = Math.random() > 0.6; // 40% chance for multi-select

    const mcqInstructions = `Write ONE high-quality multiple choice question (MCQ) testing a real decision or tradeoff regarding this topic.
The question must have 4 options and exactly 1 correct answer (specified as index 0, 1, 2, or 3).
Do NOT include option letters like [A], [B], A), B) in the stem or options.
Return ONLY valid JSON with this exact structure:
{
  "stem": "Detailed exam-style question scenario with concrete requirements...",
  "options": [
    "Option 1 description",
    "Option 2 description",
    "Option 3 description",
    "Option 4 description"
  ],
  "correct_answer": 0,
  "explanation": "Detailed 2-3 sentence explanation of why the correct answer is right and why distractors are wrong."
}`;

    const multiSelectInstructions = `Write ONE high-quality multi-select question testing a real decision or tradeoff regarding this topic.
The question must have 4 to 5 options and 2 or more correct answers.
Do NOT include option letters like [A], [B], A), B) in the stem or options.
Return ONLY valid JSON with this exact structure:
{
  "stem": "Detailed exam-style question scenario with concrete requirements... (Choose all that apply)",
  "options": [
    "Option 1 description",
    "Option 2 description",
    "Option 3 description",
    "Option 4 description",
    "Option 5 description"
  ],
  "correct_answer": [0, 2], // Array of correct indices
  "explanation": "Detailed 2-3 sentence explanation of why the correct answers are right and why distractors are wrong."
}`;

    const prompt = `You are an expert exam question author for the ${objective.certification_id || "cloud"} certification exam.

Objective: ${objective.objective_code}. ${objective.title}
Domain: ${objective.domain_title || ""}
Description: ${objective.description}

Here is official documentation content for this objective:
Key Concepts: ${keyConceptsText}
Learning Outcomes: ${learningOutcomesText}

${isMultiSelect ? multiSelectInstructions : mcqInstructions}`;

    const aiRes = await createGroqJsonCompletion(prompt);
    
    // Map string array to object array
    const rawOptions = Array.isArray(aiRes.options) ? aiRes.options : [];
    const formattedOptions = rawOptions.map((optText: any, idx: number) => {
      // If it's already an object somehow
      if (typeof optText === 'object' && optText !== null) {
        return {
          id: optText.id || String(idx),
          text: optText.text || String(optText)
        };
      }
      // If it's a string, strip leading A), A., [A], etc just in case
      const cleanText = String(optText).replace(/^([A-Ea-e][\.\)]|\[[A-Ea-e]\])\s*/, '');
      return { id: String(idx), text: cleanText };
    });

    let formattedCorrectAnswer: any;
    if (isMultiSelect) {
      formattedCorrectAnswer = Array.isArray(aiRes.correct_answer) 
        ? aiRes.correct_answer.map(String) 
        : [String(aiRes.correct_answer || 0)];
    } else {
      const correctAnswerIdx = typeof aiRes.correct_answer === "number" ? aiRes.correct_answer : (typeof aiRes.correct_index === "number" ? aiRes.correct_index : 0);
      formattedCorrectAnswer = String(correctAnswerIdx);
    }

    const generatedQuestion = {
      id: `gen-q-${id}-${Date.now()}`,
      objective_id: id,
      question_type: isMultiSelect ? "multi_select" : "mcq",
      difficulty: "intermediate",
      stem: aiRes.stem || aiRes.question || "",
      options: formattedOptions,
      correct_answer: formattedCorrectAnswer,
      explanation: aiRes.explanation || "Correct based on official documentation.",
      official_doc_url: cached?.url || objective.skills?.[0]?.official_doc_url || null,
      service_tags: [objective.title],
      validation_status: "ai_generated",
    };
    
    // Save to DB so it can be verified in the submit endpoint
    savePracticeQuestion(generatedQuestion);

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
Do NOT include option letters like [A], [B], A), B) in the stem or options.
Return ONLY valid JSON with this exact structure:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_index": 0,
  "explanation": "Brief explanation of why this is correct based on the text."
}`;

    const result = await createGroqJsonCompletion(prompt);
    
    if (result.options && Array.isArray(result.options)) {
      result.options = result.options.map((opt: any) => {
        const cleanText = String(opt.text || opt).replace(/^([A-Ea-e][\.\)]|\[[A-Ea-e]\])\s*/, '');
        return cleanText;
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
