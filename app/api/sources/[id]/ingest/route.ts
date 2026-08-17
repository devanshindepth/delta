import { NextRequest, NextResponse } from 'next/server';
import { getSource, saveSource, listCompetencyNodes } from '@/lib/db/queries';
import { scrapeUrl } from '@/lib/ingestion/scraper';
import { mapSourceToGraph } from '@/lib/engines/competency-engine';

export async function POST(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const source = getSource(params.id);
    if (!source) throw new Error("Source not found");
    
    source.ingestion_status = 'processing';
    saveSource(source);
    
    const { rawContent, title, scrapedAt } = await scrapeUrl(source.url);
    source.raw_content = rawContent;
    source.title = title;
    source.scraped_at = scrapedAt;
    
    const nodes = listCompetencyNodes('default-goal-id');
    const matchedNodeIds = await mapSourceToGraph(rawContent, 'default-goal-id', nodes);
    
    source.mapped_competency_ids = matchedNodeIds;
    source.ingestion_status = 'completed';
    saveSource(source);
    
    return NextResponse.json({ success: true, data: source });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
