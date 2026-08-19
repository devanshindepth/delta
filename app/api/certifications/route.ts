import { NextResponse } from "next/server";
import { getCertifications } from "@/lib/db/queries";

export async function GET() {
  try {
    const certs = getCertifications();
    return NextResponse.json({ success: true, data: certs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
