import { NextResponse } from 'next/server';
import { getRunnerUrl } from '@/lib/server-config';

export const dynamic = 'force-dynamic';

function noStoreHeaders(): HeadersInit {
  return { 'Cache-Control': 'no-store' };
}

async function forwardToRunner(path: string, init?: RequestInit): Promise<Response> {
  const endpoint = `${getRunnerUrl()}${path}`;
  return fetch(endpoint, {
    ...init,
    cache: 'no-store',
  });
}

export async function GET(_request: Request) {
  try {
    const runnerResponse = await forwardToRunner('/bots');
    const text = await runnerResponse.text();

    if (!runnerResponse.ok) {
      return NextResponse.json(
        { error: text || `Runner request failed (${runnerResponse.status})` },
        { status: runnerResponse.status, headers: noStoreHeaders() }
      );
    }

    if (!text) {
      return NextResponse.json({ bots: [] }, { headers: noStoreHeaders() });
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        ...noStoreHeaders(),
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load bot sessions';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}

type JoinBody = {
  meetingUrl?: string;
  meetingId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as JoinBody;

    const meetingUrl = typeof body.meetingUrl === 'string' ? body.meetingUrl.trim() : '';
    if (!meetingUrl) {
      return NextResponse.json(
        { error: 'meetingUrl is required' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const payload = {
      meeting_url: meetingUrl,
      meeting_id:
        typeof body.meetingId === 'string' && body.meetingId.trim() ? body.meetingId.trim() : null,
    };

    const runnerResponse = await forwardToRunner('/bots/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await runnerResponse.text();
    if (!runnerResponse.ok) {
      return NextResponse.json(
        { error: text || `Runner join failed (${runnerResponse.status})` },
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
    const message = error instanceof Error ? error.message : 'Failed to start bot session';
    return NextResponse.json({ error: message }, { status: 500, headers: noStoreHeaders() });
  }
}
