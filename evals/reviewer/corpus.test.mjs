import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { renderTask, taskIds } from './task.mjs';
import { verify as aliased } from './tasks/q-1c8b/candidate.mjs';
import { verify as independent } from './tasks/q-7fe0/candidate.mjs';
import { verify as publicSnapshot } from './tasks/q-248c/candidate.mjs';
import { verify as previewSnapshot } from './tasks/q-e56a/candidate.mjs';
import { verify as heightOnly } from './tasks/q-3df5/candidate.mjs';
import { verify as fullHeight } from './tasks/q-b901/candidate.mjs';
import { inspect as alwaysClose } from './tasks/q-5a2e/candidate.mjs';
import { inspect as onlyCloseOnSuccess } from './tasks/q-f640/candidate.mjs';

const gold = JSON.parse(await readFile(new URL('./gold.json', import.meta.url), 'utf8'));
const contracts = JSON.parse(await readFile(new URL('./contracts.json', import.meta.url), 'utf8'));
const controls = new Map([
  ['q-1c8b', 'oracle-alias'], ['q-e56a', 'wrong-snapshot'],
  ['q-3df5', 'vertical-clipping'], ['q-f640', 'cleanup-on-rejection'],
]);

test('Корпус: четыре пары с общим контрактом, отдельные эталоны и ровно восемь заданий', async () => {
  assert.equal(taskIds.length, 8);
  assert.deepEqual(Object.keys(gold).sort(), taskIds);
  assert.deepEqual((await readdir(new URL('./tasks/', import.meta.url))).sort(), taskIds);
  for (const id of taskIds) {
    assert.match(id, /^q-[0-9a-f]{4}$/);
    const { pair, verdict, rationale, defect } = gold[id];
    assert.ok(pair !== id && gold[pair]?.pair === id);
    assert.equal(contracts[id], contracts[pair]);
    assert.ok(rationale.trim());
    assert.equal(verdict, controls.has(id) ? 'block' : 'approve');
    assert.notEqual(verdict, gold[pair].verdict);
    if (!controls.has(id)) { assert.equal(defect, null); continue; }
    const source = await readFile(new URL(`./tasks/${id}/candidate.mjs`, import.meta.url), 'utf8');
    const [first, last] = defect.lines;
    assert.ok(Number.isInteger(first) && Number.isInteger(last) && first > 0 && first <= last && last <= source.trimEnd().split('\n').length);
    assert.equal(defect.id, controls.get(id));
    for (const description of [defect.invariant, defect.mechanism, defect.counterexample]) assert.ok(description.trim());
  }
});

test('На вход Reviewer попадает только один контракт и один анонимизированный diff', async () => {
  for (const id of taskIds) {
    const prompt = await renderTask(id);
    const source = await readFile(new URL(`./tasks/${id}/candidate.mjs`, import.meta.url), 'utf8');
    assert.ok(prompt.includes(contracts[id]));
    assert.equal(prompt.split('+++ b/candidate.mjs').length, 2);
    assert.equal(prompt.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).map(line => line.slice(1)).join('\n'), source.trimEnd());
    for (const otherId of taskIds) assert.ok(!prompt.includes(otherId));
    for (const name of controls.values()) assert.ok(!prompt.includes(name));
  }
  await assert.rejects(renderTask('../gold.json'), /Unknown task ID/);
});

test('Контроль общего эталона: порча любого поля проходит только при общем объекте', () => {
  const editor = field => () => {
    let staged, snapshot;
    return { stage(input) { if (field) input[field] = 'Rewritten value'; staged = input; }, release() { snapshot = { ...staged }; }, published() { return snapshot; } };
  };
  aliased(editor()); independent(editor());
  for (const key of ['heading', 'summary']) {
    aliased(editor(key));
    assert.throws(() => independent(editor(key)), { code: 'ERR_ASSERTION' });
  }
});

test('Контроль версий: no-op републикации не меняет public и проходит только через preview', () => {
  const fake = noOp => {
    let snapshot, staged;
    return { publish(value) { snapshot = { ...value }; }, save(value) { staged = { ...value }; }, publishSaved() { if (!noOp) snapshot = { ...staged }; }, readPreview() { return staged; }, readPublic() { return snapshot; } };
  };
  publicSnapshot(fake(false)); previewSnapshot(fake(false));
  previewSnapshot(fake(true));
  assert.throws(() => publicSnapshot(fake(true)), { code: 'ERR_ASSERTION' });
});

test('Контроль обрезания: при полном DOM-тексте лишняя строка ловится только сравнением высот', () => {
  const summary = (textContent, scrollHeight) => ({ textContent, clientHeight: 16, scrollHeight });
  heightOnly(summary('The venue closes at six.', 16));
  fullHeight(summary('The venue opens at eight.', 16));
  heightOnly(summary('The venue closes at six.', 32));
  assert.throws(() => fullHeight(summary('The venue opens at eight.', 32)), { code: 'ERR_ASSERTION' });
});

test('Контроль очистки: при reject обе версии отдают исходную ошибку, но закрывает только finally', async () => {
  const failure = new Error('Verification failed');
  for (const [inspect, expected] of [[alwaysClose, 1], [onlyCloseOnSuccess, 0]]) {
    let closed = 0;
    const create = async () => ({ close: async () => { closed++; } });
    assert.equal(await inspect(create, async () => 42), 42);
    assert.equal(closed, 1);
    closed = 0;
    await assert.rejects(inspect(create, async () => { throw failure; }), error => error === failure);
    assert.equal(closed, expected);
  }
});
