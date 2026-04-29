import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config/server';

export async function GET(req: NextRequest) {
  try {
    const roomName = req.nextUrl.searchParams.get('roomName');

    /**
     * CAUTION:
     * for simplicity this implementation does not authenticate users and therefore allows anyone with knowledge of a roomName
     * to start/stop recordings for that room.
     * DO NOT USE THIS FOR PRODUCTION PURPOSES AS IS
     */

    if (roomName === null) {
      return new NextResponse('Missing roomName parameter', { status: 400 });
    }

    const config = getServerConfig();
    const livekitUrlInternal = config.livekitInternalUrl;
    if (!livekitUrlInternal) {
      return new NextResponse(
        'LIVEKIT_URL_INTERNAL, LIVEKIT_URL_PUBLIC, or LIVEKIT_URL must be set',
        { status: 500 },
      );
    }

    const hostURL = new URL(livekitUrlInternal);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, config.livekitApiKey, config.livekitApiSecret);
    const activeEgresses = (await egressClient.listEgress({ roomName })).filter(
      (info) => info.status < 2,
    );
    if (activeEgresses.length === 0) {
      return new NextResponse('No active recording found', { status: 404 });
    }
    await Promise.all(activeEgresses.map((info) => egressClient.stopEgress(info.egressId)));

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}
