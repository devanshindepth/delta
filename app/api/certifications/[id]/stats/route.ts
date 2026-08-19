import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/db/queries";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const userId = request.headers.get("x-user-id") || "user-default";
    const stats = getDashboardStats(userId, id);
    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
