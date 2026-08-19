import { NextResponse } from "next/server";
import { getExamVersion, getKnowledgeGraph } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const version = getExamVersion(id);
    if (!version) {
      return NextResponse.json({ success: true, data: [] });
    }
    const graph = getKnowledgeGraph(version.id);
    return NextResponse.json({ success: true, data: graph });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
