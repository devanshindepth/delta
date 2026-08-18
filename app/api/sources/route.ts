import { NextResponse } from "next/server";
import { getScrapedSources } from "@/lib/db/queries";

export async function GET() {
  try {
    const sources = getScrapedSources();
    return NextResponse.json({ success: true, data: sources });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
