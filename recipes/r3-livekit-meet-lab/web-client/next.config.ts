import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const baseEnvPath = join(process.cwd(), '.env.web');
const localEnvPath = join(process.cwd(), '.env.web.local');

if (existsSync(baseEnvPath)) {
  loadEnv({ path: baseEnvPath });
}
if (existsSync(localEnvPath)) {
  loadEnv({ path: localEnvPath, override: true });
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
