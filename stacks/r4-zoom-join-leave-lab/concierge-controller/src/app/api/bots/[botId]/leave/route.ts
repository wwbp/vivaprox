import { NextResponse } from 'next/server';
import { getRunnerUrl } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

function noStoreHeaders(): HeadersInit {
  return { 'Cache-Control': 'no-store' };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await context.params;
    const trimmedBotId = botId.trim();
    if (!trimmedBotId) {
      return NextResponse.json({ error: 'botId is required' }, { status: 400, headers: noStoreHeaders() });
    }

    const runnerUrl = getRunnerUrl();
    const endpoint = `${runnerUrl}/bots/${encodeURIComponent(trimmedBotId)}/leave`;

    const runnerResponse = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
    });

    const text = await runnerResponse.text();
    if (!runnerResponse.ok) {
      return NextResponse.json(
        { error: text || `Runner leave failed (${runnerResponse.status})` },
        { status: runnerResponse.status, headers: noStoreHeaders() }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to leave bot session';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}
