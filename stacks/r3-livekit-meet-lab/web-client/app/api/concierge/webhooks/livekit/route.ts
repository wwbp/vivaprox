import { NextResponse } from 'next/server';
import { pushConciergeEvent } from '@/lib/concierge/events-store';
import { getWebhookReceiver, mapWebhookEvent } from '@/lib/concierge/livekit-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing Authorization header' },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const body = await request.text();
    const receiver = getWebhookReceiver();
    const event = await receiver.receive(body, authHeader);

    const storedEvent = pushConciergeEvent(mapWebhookEvent(event));
    return NextResponse.json({ ok: true, event: storedEvent }, { headers: noStoreHeaders() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to verify and process webhook event';
    return NextResponse.json({ error: message }, { status: 401, headers: noStoreHeaders() });
  }
}
