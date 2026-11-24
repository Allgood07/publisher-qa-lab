import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const runner = spawn(process.execPath, [
  require.resolve('@playwright/test/cli'), 'test', 'tests/publish.spec.ts',
  '--project=chromium', '--workers=1', '--retries=0', '--reporter=list',
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, PILOT_FORCE_FAILURE: '1', FORCE_COLOR: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let exitedAt: number | undefined;
runner.once('exit', () => { exitedAt = performance.now(); });
let output = '';
for (const stream of [runner.stdout, runner.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk: string) => { output += chunk; });
}
const [code, signal] = await once(runner, 'close');
process.stdout.write(output);
if (exitedAt === undefined || code !== 1 || signal || !output.includes('Error: PILOT_CONTROLLED_FAILURE:') || !/\b1 failed\b/.test(output)) {
  throw new Error(`Expected the explicitly marked test failure, got exit=${code} signal=${signal}`);
}

const ready = [...output.matchAll(/^\[pilot-server\] pid=(\d+) port=(\d+)\s*$/gm)];
if (ready.length !== 1) throw new Error(`Expected one pilot server, found ${ready.length}`);
const pid = Number(ready[0][1]);
const port = Number(ready[0][2]);

function processGone(): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true;
    throw error;
  }
}

function connectionRefused(timeout: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(timeout);
    socket.once('connect', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') resolve(true);
      else reject(error);
    });
  });
}

const deadline = exitedAt + 5_000;
let stopped = false;
while (performance.now() < deadline) {
  if (processGone() && await connectionRefused(Math.max(1, Math.min(250, deadline - performance.now())))
      && performance.now() <= deadline) {
    stopped = true;
    break;
  }
  await delay(50);
}
if (!stopped) throw new Error(`Within 5s, did not confirm both exit of PID ${pid} and TCP refusal at 127.0.0.1:${port}`);
console.log(`[cleanup] expected runner exit=1; PID ${pid} gone; TCP 127.0.0.1:${port} ECONNREFUSED`);
