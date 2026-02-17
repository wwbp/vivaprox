'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { TrashIcon } from '@phosphor-icons/react/dist/ssr';
import { Button } from '@/components/livekit/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/livekit/select';
import type {
  BotsResponse,
  ConciergeBot,
  ConciergeBotRequest,
  ConciergeEvent,
  ConciergeInviteDetails,
  ConciergeParticipant,
  ConciergeRoom,
  EventsResponse,
  InviteResponse,
  ParticipantsResponse,
  RoomsResponse,
  StartBotResponse,
} from '@/lib/concierge/types';

const POLL_INTERVAL_MS = 8000;
const EVENT_LIMIT = 60;

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    if (text) {
      try {
        const payload = JSON.parse(text) as { error?: string };
        if (typeof payload.error === 'string' && payload.error) {
          message = payload.error;
        }
      } catch {
        // Keep raw response text.
      }
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }
  return (await response.json()) as T;
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return 'n/a';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected error';
}

function safeText(value?: string): string {
  if (!value) {
    return '-';
  }
  return value.trim() ? value : '-';
}

export function ConciergeConsole() {
  const [rooms, setRooms] = useState<ConciergeRoom[]>([]);
  const [selectedRoomName, setSelectedRoomName] = useState('');
  const [participants, setParticipants] = useState<ConciergeParticipant[]>([]);
  const [events, setEvents] = useState<ConciergeEvent[]>([]);
  const [invite, setInvite] = useState<ConciergeInviteDetails | null>(null);
  const [bots, setBots] = useState<ConciergeBot[]>([]);
  const [botRequests, setBotRequests] = useState<ConciergeBotRequest[]>([]);

  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomMetadata, setNewRoomMetadata] = useState('');
  const [newRoomTimeout, setNewRoomTimeout] = useState('300');

  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [loadingBots, setLoadingBots] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalTracks = useMemo(
    () => participants.reduce((count, participant) => count + participant.tracks.length, 0),
    [participants]
  );

  const activeRooms = useMemo(
    () => rooms.filter((room) => (room.numParticipants ?? 0) > 0).length,
    [rooms]
  );

  async function loadRooms() {
    setLoadingRooms(true);
    try {
      const data = await requestJson<RoomsResponse>('/api/concierge/rooms');
      setRooms(data.rooms);
      setSelectedRoomName((current) => {
        if (current && data.rooms.some((room) => room.name === current)) {
          return current;
        }
        return data.rooms[0]?.name ?? '';
      });
      setError(null);
    } catch (loadError) {
      setError(readErrorMessage(loadError));
    } finally {
      setLoadingRooms(false);
    }
  }

  async function loadParticipants(roomName: string) {
    if (!roomName) {
      setParticipants([]);
      return;
    }

    setLoadingParticipants(true);
    try {
      const data = await requestJson<ParticipantsResponse>(
        `/api/concierge/rooms/${encodeURIComponent(roomName)}/participants`
      );
      setParticipants(data.participants);
      setError(null);
    } catch (loadError) {
      setError(readErrorMessage(loadError));
    } finally {
      setLoadingParticipants(false);
    }
  }

  async function loadInvite(roomName: string) {
    if (!roomName) {
      setInvite(null);
      return;
    }

    setLoadingInvite(true);
    try {
      const data = await requestJson<InviteResponse>(
        `/api/concierge/rooms/${encodeURIComponent(roomName)}/invite`
      );
      setInvite(data.invite);
      setError(null);
    } catch (loadError) {
      setError(readErrorMessage(loadError));
    } finally {
      setLoadingInvite(false);
    }
  }

  async function loadBots(roomName: string) {
    if (!roomName) {
      setBots([]);
      setBotRequests([]);
      return;
    }

    setLoadingBots(true);
    try {
      const data = await requestJson<BotsResponse>(
        `/api/concierge/rooms/${encodeURIComponent(roomName)}/bots`
      );
      setBots(data.bots);
      setBotRequests(data.requests);
      setError(null);
    } catch (loadError) {
      setError(readErrorMessage(loadError));
    } finally {
      setLoadingBots(false);
    }
  }

  async function loadEvents() {
    setLoadingEvents(true);
    try {
      const data = await requestJson<EventsResponse>(`/api/concierge/events?limit=${EVENT_LIMIT}`);
      setEvents(data.events);
      setError(null);
    } catch (loadError) {
      setError(readErrorMessage(loadError));
    } finally {
      setLoadingEvents(false);
    }
  }

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomName = newRoomName.trim();
    if (!roomName) {
      setError('Room name is required');
      return;
    }

    const timeoutValue = Number.parseInt(newRoomTimeout, 10);
    const payload: { name: string; metadata?: string; emptyTimeout?: number } = {
      name: roomName,
    };
    if (newRoomMetadata.trim()) {
      payload.metadata = newRoomMetadata.trim();
    }
    if (!Number.isNaN(timeoutValue) && timeoutValue >= 0) {
      payload.emptyTimeout = timeoutValue;
    }

    setRunningAction('create-room');
    try {
      await requestJson('/api/concierge/rooms', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNewRoomName('');
      await loadRooms();
      setSelectedRoomName(roomName);
      await Promise.all([
        loadParticipants(roomName),
        loadInvite(roomName),
        loadBots(roomName),
        loadEvents(),
      ]);
      setError(null);
    } catch (actionError) {
      setError(readErrorMessage(actionError));
    } finally {
      setRunningAction(null);
    }
  }

  async function handleDeleteRoom() {
    if (!selectedRoomName) {
      return;
    }

    const confirmed = window.confirm(
      `Delete room "${selectedRoomName}" and disconnect all participants?`
    );
    if (!confirmed) {
      return;
    }

    setRunningAction('delete-room');
    try {
      await requestJson(`/api/concierge/rooms/${encodeURIComponent(selectedRoomName)}`, {
        method: 'DELETE',
      });
      await loadRooms();
      await Promise.all([loadEvents(), loadInvite(''), loadBots('')]);
      setError(null);
    } catch (actionError) {
      setError(readErrorMessage(actionError));
    } finally {
      setRunningAction(null);
    }
  }

  async function handleRemoveParticipant(identity: string) {
    if (!selectedRoomName) {
      return;
    }

    const confirmed = window.confirm(
      `Remove participant "${identity}" from "${selectedRoomName}"?`
    );
    if (!confirmed) {
      return;
    }

    setRunningAction(`remove-${identity}`);
    try {
      await requestJson(
        `/api/concierge/rooms/${encodeURIComponent(selectedRoomName)}/participants/${encodeURIComponent(identity)}`,
        { method: 'DELETE' }
      );
      await Promise.all([
        loadParticipants(selectedRoomName),
        loadRooms(),
        loadBots(selectedRoomName),
        loadEvents(),
      ]);
      setError(null);
    } catch (actionError) {
      setError(readErrorMessage(actionError));
    } finally {
      setRunningAction(null);
    }
  }

  async function handleToggleTrackMute(identity: string, trackSid: string, muted: boolean) {
    if (!selectedRoomName) {
      return;
    }

    setRunningAction(`mute-${identity}-${trackSid}`);
    try {
      await requestJson(
        `/api/concierge/rooms/${encodeURIComponent(selectedRoomName)}/participants/${encodeURIComponent(identity)}/tracks/${encodeURIComponent(trackSid)}/mute`,
        {
          method: 'POST',
          body: JSON.stringify({ muted }),
        }
      );
      await Promise.all([loadParticipants(selectedRoomName), loadEvents()]);
      setError(null);
    } catch (actionError) {
      setError(readErrorMessage(actionError));
    } finally {
      setRunningAction(null);
    }
  }

  async function handleCopyInvite() {
    if (!invite?.shareText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(invite.shareText);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1200);
    } catch (copyError) {
      setError(readErrorMessage(copyError));
    }
  }

  async function handleStartBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoomName) {
      return;
    }

    setRunningAction('start-bot');
    try {
      await requestJson<StartBotResponse>(
        `/api/concierge/rooms/${encodeURIComponent(selectedRoomName)}/bots`,
        {
          method: 'POST',
        }
      );
      await Promise.all([
        loadBots(selectedRoomName),
        loadParticipants(selectedRoomName),
        loadEvents(),
      ]);
      setError(null);
    } catch (actionError) {
      setError(readErrorMessage(actionError));
    } finally {
      setRunningAction(null);
    }
  }

  async function handleRemoveBot(identity: string) {
    if (!selectedRoomName) {
      return;
    }

    const confirmed = window.confirm(
      `Disconnect bot "${identity}" from room "${selectedRoomName}"?`
    );
    if (!confirmed) {
      return;
    }

    setRunningAction(`remove-bot-${identity}`);
    try {
      await requestJson(
        `/api/concierge/rooms/${encodeURIComponent(selectedRoomName)}/bots/${encodeURIComponent(identity)}`,
        { method: 'DELETE' }
      );
      await Promise.all([
        loadBots(selectedRoomName),
        loadParticipants(selectedRoomName),
        loadEvents(),
      ]);
      setError(null);
    } catch (actionError) {
      setError(readErrorMessage(actionError));
    } finally {
      setRunningAction(null);
    }
  }

  useEffect(() => {
    const roomFromQuery = new URLSearchParams(window.location.search).get('room');
    if (roomFromQuery) {
      setSelectedRoomName(roomFromQuery);
    }
    void loadRooms();
    void loadEvents();
    const interval = window.setInterval(() => {
      void loadRooms();
      void loadEvents();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedRoomName) {
      setParticipants([]);
      setInvite(null);
      setBots([]);
      setBotRequests([]);
      return;
    }
    void loadParticipants(selectedRoomName);
    void loadInvite(selectedRoomName);
    void loadBots(selectedRoomName);
    const interval = window.setInterval(() => {
      void loadParticipants(selectedRoomName);
      void loadBots(selectedRoomName);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [selectedRoomName]);

  const selectedRoom = rooms.find((room) => room.name === selectedRoomName);

  return (
    <div className="swiss-grid bg-background min-h-svh">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8 sm:py-10">
        <header className="border-foreground/15 grid grid-cols-12 gap-4 border-b pb-6">
          <div className="col-span-12 space-y-2 lg:col-span-8">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
              Concierge Console
            </p>
            <h1 className="text-4xl font-light tracking-tight sm:text-5xl">
              Meet Administration Grid
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
              Human invites, first-person bot orchestration, participants, tracks, and telemetry.
            </p>
          </div>
          <div className="col-span-12 grid grid-cols-4 gap-2 lg:col-span-4">
            <div className="border-foreground/15 bg-background/80 border p-3 backdrop-blur">
              <p className="text-muted-foreground font-mono text-[10px] uppercase">rooms</p>
              <p className="text-2xl">{rooms.length}</p>
            </div>
            <div className="border-foreground/15 bg-background/80 border p-3 backdrop-blur">
              <p className="text-muted-foreground font-mono text-[10px] uppercase">active</p>
              <p className="text-2xl">{activeRooms}</p>
            </div>
            <div className="border-foreground/15 bg-background/80 border p-3 backdrop-blur">
              <p className="text-muted-foreground font-mono text-[10px] uppercase">tracks</p>
              <p className="text-2xl">{totalTracks}</p>
            </div>
            <div className="border-foreground/15 bg-background/80 border p-3 backdrop-blur">
              <p className="text-muted-foreground font-mono text-[10px] uppercase">bots</p>
              <p className="text-2xl">{bots.length}</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="border-destructive/40 bg-destructive/8 text-destructive mt-4 border p-3 text-sm">
            {error}
          </div>
        )}

        <main className="mt-6 grid grid-cols-12 gap-4">
          <section className="border-foreground/15 bg-background/90 col-span-12 border p-4 lg:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">Rooms and Invite</h2>
              <p className="text-muted-foreground font-mono text-[11px] uppercase">
                {loadingRooms ? 'syncing' : 'synced'}
              </p>
            </div>

            <form
              onSubmit={handleCreateRoom}
              className="border-foreground/10 space-y-3 border-b pb-4"
            >
              <div>
                <label className="text-muted-foreground mb-1 block font-mono text-[11px] uppercase">
                  Room Name
                </label>
                <input
                  value={newRoomName}
                  onChange={(event) => setNewRoomName(event.target.value)}
                  className="border-foreground/20 focus:border-foreground/50 w-full border bg-transparent px-3 py-2 text-sm outline-none"
                  placeholder="seminar-101"
                  maxLength={128}
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block font-mono text-[11px] uppercase">
                  Metadata (optional)
                </label>
                <input
                  value={newRoomMetadata}
                  onChange={(event) => setNewRoomMetadata(event.target.value)}
                  className="border-foreground/20 focus:border-foreground/50 w-full border bg-transparent px-3 py-2 text-sm outline-none"
                  placeholder='{"cohort":"spring"}'
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block font-mono text-[11px] uppercase">
                  Empty Timeout (sec)
                </label>
                <input
                  value={newRoomTimeout}
                  onChange={(event) => setNewRoomTimeout(event.target.value)}
                  type="number"
                  min={0}
                  className="border-foreground/20 focus:border-foreground/50 w-full border bg-transparent px-3 py-2 text-sm outline-none"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                disabled={runningAction === 'create-room'}
              >
                {runningAction === 'create-room' ? 'Creating...' : 'Create Room'}
              </Button>
            </form>

            <div className="mt-4 space-y-3">
              <label className="text-muted-foreground block font-mono text-[11px] uppercase">
                Selected Room
              </label>
              <Select value={selectedRoomName} onValueChange={setSelectedRoomName}>
                <SelectTrigger className="border-foreground/20 w-full rounded-none border bg-transparent px-3">
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((room) => (
                    <SelectItem key={room.name} value={room.name}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="border-foreground/10 space-y-1 border p-3 text-sm">
                <p>
                  <span className="text-muted-foreground font-mono text-[11px] uppercase">sid</span>{' '}
                  {safeText(selectedRoom?.sid)}
                </p>
                <p>
                  <span className="text-muted-foreground font-mono text-[11px] uppercase">
                    participants
                  </span>{' '}
                  {selectedRoom?.numParticipants ?? 0}
                </p>
                <p>
                  <span className="text-muted-foreground font-mono text-[11px] uppercase">
                    created
                  </span>{' '}
                  {formatTimestamp(selectedRoom?.creationTime)}
                </p>
                <p>
                  <span className="text-muted-foreground font-mono text-[11px] uppercase">
                    recording
                  </span>{' '}
                  {selectedRoom?.activeRecording ? 'yes' : 'no'}
                </p>
              </div>

              <div className="border-foreground/10 space-y-2 border p-3">
                <p className="text-muted-foreground font-mono text-[11px] uppercase">
                  Human Join Link
                </p>
                {loadingInvite && (
                  <p className="text-muted-foreground text-xs">Loading invite...</p>
                )}
                {!loadingInvite && invite?.meetJoinUrl && (
                  <>
                    <input
                      readOnly
                      value={invite.meetJoinUrl}
                      className="border-foreground/20 w-full border bg-transparent px-2 py-2 text-xs outline-none"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={handleCopyInvite}
                    >
                      {copiedInvite ? 'Copied' : 'Copy Invite Text'}
                    </Button>
                  </>
                )}
                {!loadingInvite && !invite?.meetJoinUrl && (
                  <p className="text-muted-foreground text-xs">
                    Select a room to generate invite details.
                  </p>
                )}
              </div>

              <Button
                variant="destructive"
                className="w-full justify-center"
                disabled={!selectedRoomName || runningAction === 'delete-room'}
                onClick={handleDeleteRoom}
              >
                <TrashIcon size={14} weight="bold" />
                {runningAction === 'delete-room' ? 'Deleting...' : 'Delete Room'}
              </Button>
            </div>
          </section>

          <section className="border-foreground/15 bg-background/90 col-span-12 border p-4 lg:col-span-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">Participants and Tracks</h2>
              <p className="text-muted-foreground font-mono text-[11px] uppercase">
                {loadingParticipants ? 'syncing' : 'synced'}
              </p>
            </div>

            {!selectedRoomName && (
              <div className="border-foreground/10 text-muted-foreground border p-4 text-sm">
                Create or select a room to inspect participants and tracks.
              </div>
            )}

            {selectedRoomName && participants.length === 0 && !loadingParticipants && (
              <div className="border-foreground/10 text-muted-foreground border p-4 text-sm">
                No participants are connected to this room.
              </div>
            )}

            <div className="space-y-3">
              {participants.map((participant) => (
                <article key={participant.identity} className="border-foreground/10 border">
                  <div className="border-foreground/10 flex items-center justify-between border-b p-3">
                    <div>
                      <p className="text-sm font-semibold">{participant.identity}</p>
                      <p className="text-muted-foreground text-xs">
                        joined {formatTimestamp(participant.joinedAt)} | state{' '}
                        {safeText(participant.state)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={runningAction === `remove-${participant.identity}`}
                      onClick={() => handleRemoveParticipant(participant.identity)}
                    >
                      {runningAction === `remove-${participant.identity}`
                        ? 'Removing...'
                        : 'Remove'}
                    </Button>
                  </div>

                  {participant.tracks.length === 0 && (
                    <div className="text-muted-foreground p-3 text-xs">
                      Participant has no published tracks.
                    </div>
                  )}

                  {participant.tracks.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground font-mono text-[10px] uppercase [&_th]:px-3 [&_th]:py-2 [&_th]:text-left">
                          <tr>
                            <th>Track SID</th>
                            <th>Source</th>
                            <th>Kind</th>
                            <th>Muted</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody className="[&_td]:border-foreground/10 [&_td]:border-t [&_td]:px-3 [&_td]:py-2">
                          {participant.tracks.map((track) => {
                            const actionKey = `mute-${participant.identity}-${track.sid}`;
                            const nextMutedState = !Boolean(track.muted);
                            return (
                              <tr key={track.sid}>
                                <td className="font-mono">{track.sid}</td>
                                <td>{safeText(track.source)}</td>
                                <td>{safeText(track.kind)}</td>
                                <td>{track.muted ? 'yes' : 'no'}</td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={runningAction === actionKey || !track.sid}
                                    onClick={() =>
                                      handleToggleTrackMute(
                                        participant.identity,
                                        track.sid,
                                        nextMutedState
                                      )
                                    }
                                  >
                                    {runningAction === actionKey
                                      ? 'Updating...'
                                      : track.muted
                                        ? 'Unmute'
                                        : 'Mute'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="border-foreground/15 bg-background/90 col-span-12 border p-4 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium">Bots and Monitoring</h2>
              <p className="text-muted-foreground font-mono text-[11px] uppercase">
                {loadingBots || loadingEvents ? 'syncing' : 'synced'}
              </p>
            </div>

            {!selectedRoomName && (
              <div className="border-foreground/10 text-muted-foreground mb-3 border p-3 text-xs">
                Select a room to start and manage bot participants.
              </div>
            )}

            {selectedRoomName && (
              <div className="border-foreground/10 mb-3 space-y-3 border p-3">
                <form onSubmit={handleStartBot} className="space-y-2">
                  <p className="text-muted-foreground text-xs">
                    Starts one bot participant with default runner configuration.
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={runningAction === 'start-bot'}
                  >
                    {runningAction === 'start-bot' ? 'Starting bot...' : 'Start Bot Participant'}
                  </Button>
                </form>

                <div className="space-y-2">
                  <p className="text-muted-foreground font-mono text-[11px] uppercase">
                    Active Bots
                  </p>
                  {bots.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      No bot participant currently detected.
                    </p>
                  )}
                  {bots.map((bot) => (
                    <div
                      key={bot.identity}
                      className="border-foreground/10 space-y-1 border p-2 text-xs"
                    >
                      <p className="font-mono">{bot.identity}</p>
                      <p className="text-muted-foreground">
                        joined {formatTimestamp(bot.joinedAt)} | state {safeText(bot.state)} |
                        tracks {bot.trackCount}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={runningAction === `remove-bot-${bot.identity}`}
                        onClick={() => handleRemoveBot(bot.identity)}
                      >
                        {runningAction === `remove-bot-${bot.identity}`
                          ? 'Disconnecting...'
                          : 'Disconnect Bot'}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-muted-foreground font-mono text-[11px] uppercase">
                    Bot Start Requests
                  </p>
                  {botRequests.length === 0 && (
                    <p className="text-muted-foreground text-xs">No requests yet for this room.</p>
                  )}
                  {botRequests.slice(0, 4).map((request) => (
                    <div key={request.id} className="border-foreground/10 border p-2 text-xs">
                      <p className="font-mono">{request.status}</p>
                      <p className="text-muted-foreground">
                        {formatTimestamp(request.requestedAt)}
                        {request.runnerSessionId && ` | session ${request.runnerSessionId}`}
                      </p>
                      {request.error && <p className="text-destructive mt-1">{request.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-foreground/10 mb-3 border p-3 text-xs">
              <p className="text-muted-foreground font-mono uppercase">Webhook Endpoint</p>
              <p className="mt-1 break-all">POST /api/concierge/webhooks/livekit</p>
            </div>

            <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {events.length === 0 && (
                <div className="border-foreground/10 text-muted-foreground border p-3 text-xs">
                  No events captured yet.
                </div>
              )}

              {events.map((event) => (
                <article key={event.id} className="border-foreground/10 border p-3 text-xs">
                  <p className="text-muted-foreground font-mono uppercase">{event.source}</p>
                  <p className="mt-1 text-sm">{event.event}</p>
                  <p className="text-muted-foreground mt-1">{formatTimestamp(event.receivedAt)}</p>
                  {event.roomName && (
                    <p className="mt-1">
                      <span className="text-muted-foreground font-mono uppercase">room</span>{' '}
                      {event.roomName}
                    </p>
                  )}
                  {event.participantIdentity && (
                    <p className="mt-1">
                      <span className="text-muted-foreground font-mono uppercase">participant</span>{' '}
                      {event.participantIdentity}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
