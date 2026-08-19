import { NextRequest, NextResponse } from "next/server";
import { getCertificationById, getExamVersion, getKnowledgeGraph } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const certId = searchParams.get("certId") || "cert-azure-ai103";

  try {
    const cert = getCertificationById(certId);
    if (!cert) {
      return NextResponse.json({ success: false, error: "Certification not found" }, { status: 404 });
    }

    const version = getExamVersion(certId);
    if (!version) {
      return NextResponse.json({ success: true, data: { cert, domains: [] } });
    }

    const graph = getKnowledgeGraph(version.id);
    return NextResponse.json({ success: true, data: { cert, version, domains: graph } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
