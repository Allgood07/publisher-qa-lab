import assert from 'node:assert/strict';

export function verify(makeEditor) {
  const editor = makeEditor();
  const expected = { heading: 'Release notes', summary: 'Issue 24' };
  editor.stage({ ...expected });
  editor.release();
  assert.deepEqual(editor.published(), expected);
}
