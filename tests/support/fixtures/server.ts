import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

export type PilotServer = Readonly<{ url: string; pid: number; port: number }>;

export async function withPilotServer(use: (server: PilotServer) => Promise<void>): Promise<void> {
  const child = fork(fileURLToPath(new URL('../../../src/server.ts', import.meta.url)), {
    execArgv: [],
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const closed = new Promise<void>((resolve) => child.once('close', resolve));
  const startup = new AbortController();
  const timer = setTimeout(() => startup.abort(), 5_000);
  try {
    const port: unknown = await Promise.race([
      once(child, 'message', { signal: startup.signal }).then(([message]) => message),
      closed.then(() => { throw new Error('Pilot server exited before readiness'); }),
    ]);
    if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65_535 || !child.pid) {
      throw new Error('Invalid pilot server readiness message');
    }
    console.log(`[pilot-server] pid=${child.pid} port=${port}`);
    clearTimeout(timer);
    await use({ url: `http://127.0.0.1:${port}`, pid: child.pid, port });
  } finally {
    clearTimeout(timer);
    startup.abort();
    if (child.pid && child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  }
}
