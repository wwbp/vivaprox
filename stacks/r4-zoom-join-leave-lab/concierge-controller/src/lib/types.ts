export type BotSession = {
  bot_id: string;
  state: 'joined' | 'left';
  meeting_url: string;
  meeting_id?: string;
  started_at: string;
  left_at?: string;
  external_session_id?: string;
};

export type BotsResponse = {
  bots: BotSession[];
};

export type JoinResponse = {
  bot: BotSession;
};
