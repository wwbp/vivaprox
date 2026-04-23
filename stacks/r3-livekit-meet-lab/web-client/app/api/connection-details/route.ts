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

type ConnectionRequestBody = {
  room_config?: {
    agents?: Array<{ agent_name?: string }>;
  };
  custom_data?: unknown;
};

function createUniqueSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function parseBody(request: Request): Promise<ConnectionRequestBody> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Request body must be a JSON object');
  }
  return parsed as ConnectionRequestBody;
}

export async function POST(req: Request) {
  try {
    const config = getServerConfig();
    const livekitUrl = requireEnv(config.livekitUrl, 'LIVEKIT_URL');
    const apiKey = requireEnv(config.livekitApiKey, 'LIVEKIT_API_KEY');
    const apiSecret = requireEnv(config.livekitApiSecret, 'LIVEKIT_API_SECRET');

    // Parse agent configuration from request body
    const body = await parseBody(req);
    const agentName: string | undefined = body?.room_config?.agents?.[0]?.agent_name;

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${createUniqueSuffix()}`;
    const roomName = `voice_assistant_room_${createUniqueSuffix()}`;

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
        const errorText = await botResponse.text();
        return NextResponse.json(
          {
            error: `Failed to start bot (${botResponse.status}): ${
              errorText || 'bot runner returned an error'
            }`,
          },
          { status: 502 }
        );
      }

      const responseText = await botResponse.text();
      if (responseText) {
        try {
          const payload = JSON.parse(responseText) as { error?: unknown };
          if (typeof payload.error === 'string' && payload.error.trim()) {
            return NextResponse.json(
              { error: `Failed to start bot: ${payload.error}` },
              { status: 502 }
            );
          }
        } catch {
          // Ignore non-JSON payload on success.
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown bot runner error';
      return NextResponse.json(
        { error: `Failed to contact bot runner: ${message}` },
        { status: 502 }
      );
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
      const status =
        error instanceof SyntaxError || error.message.includes('Request body must be a JSON object')
          ? 400
          : 500;
      return new NextResponse(error.message, { status });
    }
    return new NextResponse('Unexpected error', { status: 500 });
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
