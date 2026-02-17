import { NextResponse } from 'next/server';
import { pushConciergeEvent } from '@/lib/concierge/events-store';
import { getRoomServiceClient } from '@/lib/concierge/livekit-admin';

export const dynamic = 'force-dynamic';

function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  };
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roomName: string; identity: string }> }
) {
  try {
    const params = await context.params;
    const roomName = params.roomName.trim();
    const identity = params.identity.trim();
    if (!roomName || !identity) {
      return NextResponse.json(
        { error: 'Room name and bot identity are required' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const roomService = getRoomServiceClient();
    await roomService.removeParticipant(roomName, identity);

    pushConciergeEvent({
      source: 'concierge',
      event: 'concierge.bot.removed',
      roomName,
      participantIdentity: identity,
    });

    return new NextResponse(null, { status: 204, headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove bot';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}
