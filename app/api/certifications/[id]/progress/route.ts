import { NextResponse } from "next/server";
import { getAllProgressForUser, getExamVersion, getObjectivesByVersion } from "@/lib/db/queries";

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

    // Get objective IDs for this cert
    const objectives = getObjectivesByVersion(version.id);
    const objectiveIds = new Set(objectives.map((o: any) => o.id));

    // Filter progress to only this cert's objectives
    const allProgress = getAllProgressForUser(userId);
    const filteredProgress = allProgress.filter((p: any) => objectiveIds.has(p.objective_id));

    return NextResponse.json({ success: true, data: filteredProgress });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
