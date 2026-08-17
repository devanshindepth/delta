import { NextRequest, NextResponse } from 'next/server';
import { listHeatmapEntries } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'user-default';
    const entries = listHeatmapEntries(userId);
    return NextResponse.json({ success: true, data: entries });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
