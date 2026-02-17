export type ConciergeRoom = {
  name: string;
  sid?: string;
  metadata?: string;
  numParticipants?: number;
  activeRecording?: boolean;
  creationTime?: string;
};

export type ConciergeTrack = {
  sid: string;
  name?: string;
  source?: string;
  kind?: string;
  muted?: boolean;
  mimeType?: string;
  width?: number;
  height?: number;
};

export type ConciergeParticipant = {
  identity: string;
  sid?: string;
  name?: string;
  state?: string;
  metadata?: string;
  joinedAt?: string;
  isPublisher?: boolean;
  tracks: ConciergeTrack[];
};

export type ConciergeEvent = {
  id: string;
  source: 'concierge' | 'webhook';
  event: string;
  receivedAt: string;
  roomName?: string;
  participantIdentity?: string;
  payload?: unknown;
};

export type ConciergeInviteDetails = {
  roomName: string;
  meetJoinUrl: string;
  shareText: string;
};

export type ConciergeBot = {
  identity: string;
  name?: string;
  state?: string;
  joinedAt?: string;
  trackCount: number;
};

export type ConciergeBotRequest = {
  id: string;
  roomName: string;
  status: 'started' | 'failed';
  requestedAt: string;
  agentName?: string;
  runnerSessionId?: string;
  error?: string;
};

export type RoomsResponse = {
  rooms: ConciergeRoom[];
};

export type RoomResponse = {
  room: ConciergeRoom;
};

export type ParticipantsResponse = {
  roomName: string;
  participants: ConciergeParticipant[];
};

export type EventsResponse = {
  events: ConciergeEvent[];
};

export type InviteResponse = {
  invite: ConciergeInviteDetails;
};

export type BotsResponse = {
  roomName: string;
  bots: ConciergeBot[];
  requests: ConciergeBotRequest[];
};

export type StartBotResponse = {
  request: ConciergeBotRequest;
};
