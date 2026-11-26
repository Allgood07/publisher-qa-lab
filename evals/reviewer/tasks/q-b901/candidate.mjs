import assert from 'node:assert/strict';

export function verify(summary) {
  assert.equal(summary.textContent, 'The venue opens at eight.');
  assert.ok(summary.clientHeight > 0);
  assert.ok(summary.scrollHeight <= summary.clientHeight);
}
