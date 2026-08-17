import { NextRequest, NextResponse } from 'next/server';
import { getTechnicalChange, listChangeImpacts } from '@/lib/db/queries';

export async function GET(request: NextRequest, context: any) {
  try {
    const params = await context.params;
    const userId = request.headers.get('x-user-id') || 'user-default';
    
    const change = getTechnicalChange(params.id);
    if (!change) throw new Error("Change not found");
    
    const impacts = listChangeImpacts(userId, params.id);
    
    return NextResponse.json({ success: true, data: { change, impacts } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
