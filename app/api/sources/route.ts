import { NextRequest, NextResponse } from 'next/server';
import { listSources, saveSource } from '@/lib/db/queries';
import { SourceType } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const sources = listSources(userId);
    return NextResponse.json({ success: true, data: sources });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const body = await request.json();
    
    const source = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: body.title,
      url: body.url,
      source_type: (body.sourceType as SourceType) || 'documentation',
      raw_content: '',
      extracted_concepts: [],
      mapped_competency_ids: [],
      ingestion_status: 'pending' as const,
      scraped_at: null,
      created_at: new Date().toISOString()
    };
    
    saveSource(source);
    return NextResponse.json({ success: true, data: source });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
