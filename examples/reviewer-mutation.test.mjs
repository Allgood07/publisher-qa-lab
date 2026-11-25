// Standalone reconstruction of the aliasing issue in docs/codex-roles.md.
// Run: node --test examples/reviewer-mutation.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';

function createPublisher({ corruptInput }) {
  let draft, published;
  return {
    saveDraft(content) {
      if (corruptInput) content.title = '[damaged]'; // Deliberate local mutant.
      draft = { ...content };
    },
    publish() { published = { ...draft }; },
    publicView() { return { ...published }; },
  };
}

function checkLifecycle({ corruptInput, isolateExpected }) {
  const service = createPublisher({ corruptInput });
  const v1 = { title: 'First', body: 'Version one' };
  const v2 = { title: 'Second', body: 'Version two' };
  const input = expected => isolateExpected ? { ...expected } : expected;
  service.saveDraft(input(v1));
  service.publish();
  assert.deepEqual(service.publicView(), v1);
  service.saveDraft(input(v2));
  assert.deepEqual(service.publicView(), v1);
  service.publish();
  assert.deepEqual(service.publicView(), v2);
}

test('Control: both checks accept a correct implementation', () => {
  for (const isolateExpected of [false, true]) checkLifecycle({ corruptInput: false, isolateExpected });
});
test('False green: the old check accepts the mutant because the expected title also changes', () => {
  checkLifecycle({ corruptInput: true, isolateExpected: false });
});
test('Same mutant: the stronger check fails specifically on the damaged public title', () => {
  assert.throws(() => checkLifecycle({ corruptInput: true, isolateExpected: true }), err =>
    err instanceof assert.AssertionError && err.actual.title === '[damaged]' && err.expected.title === 'First');
});
