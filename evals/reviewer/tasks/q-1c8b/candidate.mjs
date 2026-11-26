import assert from 'node:assert/strict';

export function verify(makeEditor) {
  const editor = makeEditor();
  const expected = { heading: 'Weekly digest', summary: 'Issue 17' };
  editor.stage(expected);
  editor.release();
  assert.deepEqual(editor.published(), expected);
}
