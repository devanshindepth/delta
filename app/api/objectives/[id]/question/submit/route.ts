import { NextResponse } from "next/server";
import { getObjectiveById, getRecentScrapedSourceForObjective } from "@/lib/db/queries";
import { createGroqJsonCompletion } from "@/lib/groq";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { question, learner_answer_index, correct_index } = await request.json();
    
    const objective = getObjectiveById(id);
    if (!objective) {
       return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    const cached = getRecentScrapedSourceForObjective(id, 24);
    if (!cached || !cached.raw_content) {
       return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }
    
    let extractionResult;
    try {
      extractionResult = JSON.parse(cached.raw_content);
    } catch {
      return NextResponse.json({ error: "extraction_failed" }, { status: 422 });
    }

    const isCorrect = learner_answer_index === correct_index;

    const prompt = `You are an expert instructor providing feedback to a learner.
Here is the official documentation for the topic "${objective.title}":
Key Concepts: ${JSON.stringify(extractionResult.key_concepts)}
Learning Outcomes: ${JSON.stringify(extractionResult.learning_outcomes)}

The question was: "${question}"
The learner answered ${isCorrect ? "CORRECTLY" : "INCORRECTLY"}.

Provide brief feedback explaining why the answer is correct or incorrect, grounded ONLY in the provided facts.
Return ONLY valid JSON with this exact structure:
{
  "feedback": "Your concise explanation here."
}`;

    const result = await createGroqJsonCompletion(prompt);
    
    if (isCorrect) {
      return NextResponse.json({ correct: true, feedback: result.feedback });
    } else {
      return NextResponse.json({ correct: false, feedback: result.feedback, weak_topic: true });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
