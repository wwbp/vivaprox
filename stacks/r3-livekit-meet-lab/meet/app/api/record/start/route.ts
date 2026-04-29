import { EgressClient, EncodedFileOutput, S3Upload } from 'livekit-server-sdk';
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

    const { S3_KEY_ID, S3_KEY_SECRET, S3_BUCKET, S3_ENDPOINT, S3_REGION } = process.env;
    const hostURL = new URL(livekitUrlInternal);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, config.livekitApiKey, config.livekitApiSecret);

    const existingEgresses = await egressClient.listEgress({ roomName });
    if (existingEgresses.length > 0 && existingEgresses.some((e) => e.status < 2)) {
      return new NextResponse('Meeting is already being recorded', { status: 409 });
    }

    const fileOutput = new EncodedFileOutput({
      filepath: `${new Date(Date.now()).toISOString()}-${roomName}.mp4`,
      output: {
        case: 's3',
        value: new S3Upload({
          endpoint: S3_ENDPOINT,
          accessKey: S3_KEY_ID,
          secret: S3_KEY_SECRET,
          region: S3_REGION,
          bucket: S3_BUCKET,
        }),
      },
    });

    await egressClient.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput,
      },
      {
        layout: 'speaker',
      },
    );

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}
