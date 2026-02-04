import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';
import { getServerConfig, requireEnv } from '@/lib/config/server';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const config = getServerConfig();
    const livekitUrl = requireEnv(config.livekitUrl, 'LIVEKIT_URL');
    const apiKey = requireEnv(config.livekitApiKey, 'LIVEKIT_API_KEY');
    const apiSecret = requireEnv(config.livekitApiSecret, 'LIVEKIT_API_SECRET');

    // Parse agent configuration from request body
    const body = await req.json();
    const agentName: string = body?.room_config?.agents?.[0]?.agent_name;

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      apiKey,
      apiSecret
    );

    // Tell the FastAPI server to start the bot
    const botRunnerUrl = requireEnv(config.botRunnerUrl, 'BOT_RUNNER_URL');
    const apiUrl = botRunnerUrl.endsWith('/') ? botRunnerUrl : `${botRunnerUrl}/`;
    console.log('Contacting bot runner at:', apiUrl);
    try {
      const botResponse = await fetch(`${apiUrl}start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_name: roomName,
          room_config: body.room_config,
          custom_data: body.custom_data,
        }),
      });

      if (!botResponse.ok) {
        console.error('Failed to start bot:', await botResponse.text());
      }
    } catch (error) {
      console.error('Error contacting bot runner:', error);
    }

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitUrl,
      roomName,
      participantToken: participantToken,
      participantName,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName: string | undefined,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}
