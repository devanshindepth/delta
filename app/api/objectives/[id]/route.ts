import { NextResponse } from "next/server";
import { getObjectiveById } from "@/lib/db/queries";

export async function GET(
  _request: Request,
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
    return NextResponse.json({ success: true, data: objective });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
