import { NextResponse } from 'next/server';
import { pushConciergeEvent } from '@/lib/concierge/events-store';
import { getRoomServiceClient, mapRoom } from '@/lib/concierge/livekit-admin';

export const dynamic = 'force-dynamic';

function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: noStoreHeaders() });
}

export async function GET() {
  try {
    const roomService = getRoomServiceClient();
    const rooms = await roomService.listRooms();
    const mappedRooms = rooms.map(mapRoom).sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ rooms: mappedRooms }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list rooms';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const roomName = typeof body.name === 'string' ? body.name.trim() : '';
    const metadata = typeof body.metadata === 'string' ? body.metadata.trim() : '';
    const emptyTimeoutSeconds =
      typeof body.emptyTimeout === 'number' && Number.isFinite(body.emptyTimeout)
        ? Math.max(0, Math.floor(body.emptyTimeout))
        : undefined;

    if (!roomName) {
      return badRequest('Room name is required');
    }
    if (roomName.length > 128) {
      return badRequest('Room name must be 128 characters or fewer');
    }

    const roomService = getRoomServiceClient();
    const room = await roomService.createRoom({
      name: roomName,
      metadata: metadata || undefined,
      emptyTimeout: emptyTimeoutSeconds,
    });

    pushConciergeEvent({
      source: 'concierge',
      event: 'concierge.room.created',
      roomName,
      payload: {
        metadata: metadata || undefined,
        emptyTimeout: emptyTimeoutSeconds,
      },
    });

    return NextResponse.json({ room: mapRoom(room) }, { status: 201, headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create room';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}
