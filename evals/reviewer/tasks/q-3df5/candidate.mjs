import assert from 'node:assert/strict';

export function verify(summary) {
  assert.equal(summary.textContent, 'The venue closes at six.');
  assert.ok(summary.clientHeight > 0);
}
