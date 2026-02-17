'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { BotSession, BotsResponse, JoinResponse } from '@/lib/types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text || `Request failed (${response.status})`;
    if (text) {
      try {
        const payload = JSON.parse(text) as { error?: string; detail?: string };
        if (typeof payload.error === 'string' && payload.error) {
          message = payload.error;
        } else if (typeof payload.detail === 'string' && payload.detail) {
          message = payload.detail;
        }
      } catch {
        // Keep raw message body.
      }
    }
    throw new Error(message);
  }

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function Home() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingId, setMeetingId] = useState('');

  const [bots, setBots] = useState<BotSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBots() {
    setLoading(true);
    try {
      const payload = await requestJson<BotsResponse>('/api/bots');
      setBots(payload.bots ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load bot sessions');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMeetingUrl = meetingUrl.trim();
    if (!trimmedMeetingUrl) {
      setError('Meeting URL is required');
      return;
    }

    setAction('join');
    try {
      await requestJson<JoinResponse>('/api/bots', {
        method: 'POST',
        body: JSON.stringify({
          meetingUrl: trimmedMeetingUrl,
          meetingId: meetingId.trim() || undefined,
        }),
      });
      await loadBots();
      setError(null);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to join meeting');
    } finally {
      setAction(null);
    }
  }

  async function handleLeave(botId: string) {
    setAction(`leave-${botId}`);
    try {
      await requestJson<JoinResponse>(`/api/bots/${encodeURIComponent(botId)}/leave`, {
        method: 'POST',
      });
      await loadBots();
      setError(null);
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : 'Failed to leave meeting');
    } finally {
      setAction(null);
    }
  }

  useEffect(() => {
    void loadBots();
    const interval = window.setInterval(() => {
      void loadBots();
    }, 6000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main>
      <h1>Stack 4: Zoom Join/Leave Concierge</h1>
      <p className="meta">
        This controller only handles bot join and leave. Meeting lifecycle remains external.
      </p>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h2>Start Bot Session</h2>
        <form onSubmit={handleJoin}>
          <div className="grid">
            <div>
              <label htmlFor="meeting-url">Meeting URL</label>
              <input
                id="meeting-url"
                value={meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
                placeholder="https://us06web.zoom.us/j/123456789?pwd=..."
              />
            </div>

            <div>
              <label htmlFor="meeting-id">Meeting ID (optional)</label>
              <input
                id="meeting-id"
                value={meetingId}
                onChange={(event) => setMeetingId(event.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button type="submit" className="primary" disabled={action === 'join'}>
              {action === 'join' ? 'Joining...' : 'Join Meeting'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setMeetingUrl('');
                setMeetingId('');
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Bot Sessions</h2>
        <p className="meta">
          {loading ? 'Refreshing...' : 'Synced'} | Active sessions: {bots.length}
        </p>

        <table>
          <thead>
            <tr>
              <th>Bot</th>
              <th>Status</th>
              <th>Meeting</th>
              <th>Started</th>
              <th>Left</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {bots.length === 0 && (
              <tr>
                <td colSpan={6}>No bot sessions yet.</td>
              </tr>
            )}
            {bots.map((bot) => (
              <tr key={bot.bot_id}>
                <td className="code">{bot.bot_id}</td>
                <td>{bot.state}</td>
                <td className="code">{bot.meeting_url}</td>
                <td>{formatTimestamp(bot.started_at)}</td>
                <td>{formatTimestamp(bot.left_at)}</td>
                <td>
                  <button
                    className="danger"
                    disabled={bot.state !== 'joined' || action === `leave-${bot.bot_id}`}
                    onClick={() => void handleLeave(bot.bot_id)}
                  >
                    {action === `leave-${bot.bot_id}` ? 'Leaving...' : 'Leave'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
