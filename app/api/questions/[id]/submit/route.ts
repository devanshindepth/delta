import { NextRequest, NextResponse } from "next/server";
import { getQuestionById, savePracticeAttempt, upsertLearnerProgress } from "@/lib/db/queries";

function checkAnswer(question: any, given: any): boolean {
  const correct = question.correct_answer;

  if (question.question_type === "mcq" || question.question_type === "case_study") {
    return String(given) === String(correct);
  }

  if (question.question_type === "multi_select") {
    if (!Array.isArray(given) || !Array.isArray(correct)) return false;
    const givenSet = new Set(given.map(String));
    const correctSet = new Set(correct.map(String));
    if (givenSet.size !== correctSet.size) return false;
    for (const item of correctSet) {
      if (!givenSet.has(item)) return false;
    }
    return true;
  }

  if (question.question_type === "ordering") {
    if (!Array.isArray(given) || !Array.isArray(correct)) return false;
    if (given.length !== correct.length) return false;
    return given.every((item: any, idx: number) => String(item) === String(correct[idx]));
  }

  if (question.question_type === "matching") {
    if (typeof given !== "object" || typeof correct !== "object") return false;
    const correctEntries = Object.entries(correct);
    for (const [key, val] of correctEntries) {
      if (String(given[key]) !== String(val)) return false;
    }
    return true;
  }

  if (question.question_type === "sandbox") {
    // For sandbox, check if the answer contains key parts of the correct answer
    const givenStr = String(given || "").trim().toLowerCase();
    const correctStr = String(correct || "").trim().toLowerCase();
    if (!givenStr) return false;

    // Extract key tokens from the correct answer and check presence
    const keyTerms = correctStr
      .split(/[\s\n=(),]+/)
      .filter((t) => t.length > 3 && !["from", "import", "self", "none", "true", "false"].includes(t));

    const matchCount = keyTerms.filter((term) => givenStr.includes(term)).length;
    return matchCount >= Math.ceil(keyTerms.length * 0.6);
  }

  return String(given) === String(correct);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = request.headers.get("x-user-id") || "user-default";

    const question = getQuestionById(id);
    if (!question) {
      return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
    }

    const body = await request.json();
    const { answer, timeSpent = 0 } = body;

    const isCorrect = checkAnswer(question, answer);

    // Persist the attempt
    savePracticeAttempt(userId, id, JSON.stringify(answer), isCorrect, timeSpent);

    // Update learner progress for the objective
    upsertLearnerProgress(userId, question.objective_id, isCorrect);

    return NextResponse.json({
      success: true,
      data: {
        isCorrect,
        correctAnswer: question.correct_answer,
        explanation: question.explanation,
        officialDocUrl: question.official_doc_url,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
