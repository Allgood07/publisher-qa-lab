import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { withPilotServer } from '../tests/support/fixtures/server.ts';
import type { PilotServer } from '../tests/support/fixtures/server.ts';

const controlled = new Error('CONTROLLED_FIXTURE_CALLBACK_FAILURE');
let started: PilotServer | undefined;
await assert.rejects(withPilotServer(async (server) => {
  started = server;
  const response = await fetch(`${server.url}/editor`, { signal: AbortSignal.timeout(3_000) });
  assert.equal(response.status, 200);
  await response.text();
  throw controlled;
}), (error: unknown) => error === controlled);

assert.ok(started, 'Fixture must start a server before the controlled failure');
const { pid, port } = started;
// The fixture owner is still alive, so IPC disconnect cannot explain shutdown.
assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
await assert.rejects(new Promise<void>((resolve, reject) => {
  const socket = connect({ host: '127.0.0.1', port });
  socket.once('connect', () => { socket.destroy(); resolve(); });
  socket.once('error', reject);
  socket.setTimeout(1_000, () => socket.destroy(new Error('TCP probe timed out')));
}), { code: 'ECONNREFUSED' });
console.log(`[fixture-cleanup] owner still running; PID ${pid} gone; TCP 127.0.0.1:${port} ECONNREFUSED`);
