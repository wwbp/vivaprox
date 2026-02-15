import { NextResponse } from 'next/server';
import { listConciergeEvents } from '@/lib/concierge/events-store';

export const dynamic = 'force-dynamic';

function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

  return NextResponse.json(
    { events: listConciergeEvents(limit) },
    {
      headers: noStoreHeaders(),
    }
  );
}
