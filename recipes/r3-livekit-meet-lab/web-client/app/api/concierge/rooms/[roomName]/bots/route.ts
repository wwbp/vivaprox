import { NextResponse } from 'next/server';
import { addBotRequest, listBotRequestsForRoom } from '@/lib/concierge/bot-requests-store';
import { pushConciergeEvent } from '@/lib/concierge/events-store';
import { getRoomServiceClient, mapParticipant } from '@/lib/concierge/livekit-admin';
import { getServerConfig, requireEnv } from '@/lib/config/server';

export const dynamic = 'force-dynamic';

type BotRunnerResponse = {
  session_id?: string;
  message?: string;
  error?: string;
};

function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  };
}

function isBotParticipant(participant: { identity: string; name?: string }): boolean {
  if (participant.identity.startsWith('bot_')) {
    return true;
  }
  return participant.name?.toLowerCase() === 'assistant';
}

function toBotRunnerStartUrl(botRunnerUrl: string): string {
  const normalized = botRunnerUrl.endsWith('/') ? botRunnerUrl : `${botRunnerUrl}/`;
  return `${normalized}start`;
}

async function callBotRunnerStart(
  roomName: string,
  agentName?: string
): Promise<{
  ok: boolean;
  status: number;
  payload?: BotRunnerResponse;
  errorText?: string;
}> {
  const config = getServerConfig();
  const botRunnerUrl = requireEnv(config.botRunnerUrl, 'BOT_RUNNER_URL');
  const endpoint = toBotRunnerStartUrl(botRunnerUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const body: {
      room_name: string;
      custom_data: { requested_by: string };
      room_config?: { agents: Array<{ agent_name: string }> };
    } = {
      room_name: roomName,
      custom_data: {
        requested_by: 'concierge',
      },
    };
    if (agentName) {
      body.room_config = {
        agents: [{ agent_name: agentName }],
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payloadRaw: unknown;
    let payload: BotRunnerResponse | undefined;
    if (text) {
      try {
        payloadRaw = JSON.parse(text);
        if (typeof payloadRaw === 'object' && payloadRaw !== null && !Array.isArray(payloadRaw)) {
          payload = payloadRaw as BotRunnerResponse;
        }
      } catch {
        payloadRaw = undefined;
      }
    }

    const tupleError =
      Array.isArray(payloadRaw) &&
      payloadRaw.length === 2 &&
      typeof payloadRaw[1] === 'number' &&
      payloadRaw[1] >= 400
        ? payloadRaw
        : undefined;
    const tupleErrorMessage =
      tupleError &&
      typeof tupleError[0] === 'object' &&
      tupleError[0] !== null &&
      'error' in tupleError[0] &&
      typeof (tupleError[0] as { error?: unknown }).error === 'string'
        ? (tupleError[0] as { error: string }).error
        : undefined;

    const appLevelError =
      payload?.error ??
      tupleErrorMessage ??
      (tupleError ? `Bot runner returned application error ${tupleError[1]}` : undefined);
    const isSuccess = response.ok && !appLevelError;

    return {
      ok: isSuccess,
      status: response.status,
      payload,
      errorText: isSuccess ? undefined : (appLevelError ?? text),
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      errorText: error instanceof Error ? error.message : 'Bot runner request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ roomName: string }> }) {
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
    const participants = await roomService.listParticipants(roomName);
    const bots = participants
      .map(mapParticipant)
      .filter(isBotParticipant)
      .map((bot) => ({
        identity: bot.identity,
        name: bot.name,
        state: bot.state,
        joinedAt: bot.joinedAt,
        trackCount: bot.tracks.length,
      }));

    return NextResponse.json(
      {
        roomName,
        bots,
        requests: listBotRequestsForRoom(roomName),
      },
      { headers: noStoreHeaders() }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list bots for room';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}

export async function POST(request: Request, context: { params: Promise<{ roomName: string }> }) {
  try {
    const params = await context.params;
    const roomName = params.roomName.trim();
    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const body = await request.json().catch(() => ({}));
    const agentName =
      typeof body.agentName === 'string' && body.agentName.trim()
        ? body.agentName.trim()
        : undefined;

    const runnerCall = await callBotRunnerStart(roomName, agentName);
    if (!runnerCall.ok) {
      const failedRequest = addBotRequest({
        roomName,
        status: 'failed',
        agentName,
        error: runnerCall.errorText ?? `Bot runner returned ${runnerCall.status}`,
      });

      pushConciergeEvent({
        source: 'concierge',
        event: 'concierge.bot.start_failed',
        roomName,
        payload: {
          requestId: failedRequest.id,
          status: runnerCall.status,
          error: failedRequest.error,
        },
      });

      return NextResponse.json(
        { error: failedRequest.error, request: failedRequest },
        { status: 502, headers: noStoreHeaders() }
      );
    }

    const startedRequest = addBotRequest({
      roomName,
      status: 'started',
      agentName,
      runnerSessionId: runnerCall.payload?.session_id,
    });

    pushConciergeEvent({
      source: 'concierge',
      event: 'concierge.bot.started',
      roomName,
      payload: {
        requestId: startedRequest.id,
        runnerSessionId: startedRequest.runnerSessionId,
        agentName,
      },
    });

    return NextResponse.json({ request: startedRequest }, { headers: noStoreHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start bot';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}
