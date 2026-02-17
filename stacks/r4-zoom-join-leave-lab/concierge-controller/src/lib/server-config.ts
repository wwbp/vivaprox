export function getRunnerUrl(): string {
  const value = process.env.RUNNER_URL;
  if (!value) {
    throw new Error('RUNNER_URL is not defined');
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
