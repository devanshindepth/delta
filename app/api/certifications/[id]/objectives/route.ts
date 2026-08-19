import { NextResponse } from "next/server";
import { getExamVersion, getObjectivesByVersion, getAllProgressForUser } from "@/lib/db/queries";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = request.headers.get("x-user-id") || "user-default";

    const version = getExamVersion(id);
    if (!version) {
      return NextResponse.json({ success: true, data: [] });
    }

    const objectives = getObjectivesByVersion(version.id);
    const allProgress = getAllProgressForUser(userId);

    // Build progress map
    const progressMap: Record<string, any> = {};
    for (const p of allProgress) {
      progressMap[p.objective_id] = p;
    }

    // Attach progress to each objective
    const withProgress = objectives.map((obj: any) => ({
      ...obj,
      progress: progressMap[obj.id] || null,
    }));

    return NextResponse.json({ success: true, data: withProgress });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
