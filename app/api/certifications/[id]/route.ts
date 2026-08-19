import { NextResponse } from "next/server";
import { getCertificationById } from "@/lib/db/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cert = getCertificationById(id);
    if (!cert) {
      return NextResponse.json({ success: false, error: "Certification not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: cert });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
