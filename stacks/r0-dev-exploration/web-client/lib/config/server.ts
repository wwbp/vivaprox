export type ServerConfig = {
  livekitUrl?: string;
  livekitApiKey?: string;
  livekitApiSecret?: string;
  botRunnerUrl?: string;
  vercelUrl?: string;
};

export function getServerConfig(): ServerConfig {
  return {
    livekitUrl: process.env.LIVEKIT_URL,
    livekitApiKey: process.env.LIVEKIT_API_KEY,
    livekitApiSecret: process.env.LIVEKIT_API_SECRET,
    botRunnerUrl: process.env.BOT_RUNNER_URL,
    vercelUrl: process.env.VERCEL_URL,
  };
}

export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}
