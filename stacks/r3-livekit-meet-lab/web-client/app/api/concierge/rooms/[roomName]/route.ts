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
  context: { params: Promise<{ roomName: string }> }
) {
  try {
    const params = await context.params;
    const roomName = params.roomName.trim();
    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const roomService = getRoomServiceClient();
    await roomService.deleteRoom(roomName);

    pushConciergeEvent({
      source: 'concierge',
      event: 'concierge.room.deleted',
      roomName,
    });

    return new NextResponse(null, { status: 204, headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete room';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}
