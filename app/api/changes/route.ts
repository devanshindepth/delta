import { NextRequest, NextResponse } from 'next/server';
import { listTechnicalChanges, saveTechnicalChange, listCompetencyNodes, saveChangeImpact } from '@/lib/db/queries';
import { scrapeUrl } from '@/lib/ingestion/scraper';
import { analyzeChange, computeImpact } from '@/lib/engines/change-engine';

export async function GET(request: NextRequest) {
  try {
    const changes = listTechnicalChanges();
    return NextResponse.json({ success: true, data: changes });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const body = await request.json();
    
    const { rawContent, title, scrapedAt } = await scrapeUrl(body.url);
    const change = await analyzeChange(rawContent, body.url, title || body.title);
    saveTechnicalChange(change);
    
    // Impact computation requires nodes, getting all nodes for user for simplicity
    // Typically you'd find user's active goal
    // We assume a generic goal ID or fetch it
    const nodes = listCompetencyNodes('default-goal-id'); // Placeholder
    const impacts = computeImpact(change, nodes, 'default-goal-id', userId);
    impacts.forEach(saveChangeImpact);
    
    return NextResponse.json({ success: true, data: change });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
