import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreRun, validateResponse } from './score.mjs';
import { taskIds } from './task.mjs';

const note = 'Синтетическая разметка, не ответ модели.';
const item = line => ({ file: 'candidate.mjs', line, mechanism: 'Example mechanism', consequence: 'Example consequence', repro: 'Example reproduction' });
const match = defectId => ({ kind: 'match', defectId, note });
const fp = { kind: 'false-positive', note };
const dispute = { kind: 'disputed', note };

export function syntheticRun() {
  const attempts = [];
  for (const taskId of taskIds) for (let attempt = 1; attempt <= 3; attempt++) {
    const slot = { taskId, attempt };
    const answer = (...labels) => ({ ...slot, status: 'ok', response: { verdict: labels.length ? 'block' : 'approve', findings: labels.map((_, i) => item(i + 4)) }, labels });
    if (taskId === 'q-1c8b' && attempt === 1) attempts.push(answer(match('oracle-alias'), match('oracle-alias'), fp));
    else if (taskId === 'q-1c8b' && attempt === 2) attempts.push({ ...slot, status: 'timeout', note });
    else if (taskId === 'q-248c' && attempt === 1) attempts.push(answer(fp));
    else if (taskId === 'q-248c' && attempt === 2) attempts.push({ ...slot, status: 'invalid', note });
    else if (taskId === 'q-3df5') attempts.push(answer(match('vertical-clipping')));
    else if (taskId === 'q-5a2e' && attempt === 1) attempts.push(answer(dispute));
    else attempts.push(answer());
  }
  return {
    kind: 'synthetic',
    metadata: { corpusSha: '0'.repeat(40), promptSha256: '0'.repeat(64), roleRevision: 'fixture', model: 'not a model', dateUtc: '2026-01-01T00:00:00Z', sampling: { mode: 'fixture' }, tools: [], timeoutMs: 1, maxOutputTokens: 1 },
    attempts,
  };
}

test('Синтетические 24 попытки: дубль TP, пропуск, FP, спорный блокер и неответы различаются', () => {
  const run = syntheticRun();
  const result = scoreRun(run);
  assert.equal(result.kind, 'synthetic');
  assert.equal(result.provisional, true);
  assert.deepEqual(result.totals, { attempts: 24, ok: 22, timeout: 1, invalid: 1, tp: 4, fn: 8, fp: 2, disputed: 1, cleanAttempts: 12, cleanValid: 11, cleanBlocked: 2, stableTasks: 5, completeTasks: 6, tasks: 8 });
  assert.deepEqual(result.metrics, { precision: 4 / 6, recall: 4 / 12, falseBlockRateAllClean: 2 / 12, falseBlockRateValidClean: 2 / 11, repeatabilityAllTasks: 5 / 8, repeatabilityCompleteTasks: 5 / 6 });
  assert.deepEqual(result.rows[1].missed, ['oracle-alias']);
  assert.equal(result.rows[1].verdict, null);
  assert.equal(result.rows[4].verdict, null);
  assert.deepEqual(scoreRun({ ...run, attempts: [...run.attempts].reverse() }), result);
});

test('При отсутствии ответов метрики с нулевым знаменателем равны null, дефекты остаются пропущенными', () => {
  const run = syntheticRun();
  run.attempts = run.attempts.map(({ taskId, attempt }) => ({ taskId, attempt, status: 'timeout', note }));
  const result = scoreRun(run);
  assert.equal(result.metrics.precision, null);
  assert.equal(result.metrics.recall, 0);
  assert.equal(result.metrics.falseBlockRateValidClean, null);
  assert.equal(result.metrics.repeatabilityCompleteTasks, null);
  assert.equal(result.totals.fn, 12);
  assert.equal(result.totals.timeout, 24);
  assert.equal(result.rows.filter(row => row.verdict === 'approve').length, 0);
});

test('Подсчёт отклоняет неполные, дублированные, несвязанные или неразмеченные попытки', () => {
  const run = syntheticRun();
  assert.throws(() => scoreRun({ ...run, attempts: run.attempts.slice(1) }), /24 attempt slots/);
  assert.throws(() => scoreRun({ ...run, attempts: [run.attempts[1], ...run.attempts.slice(1)] }), /Duplicate attempt slot/);
  assert.throws(() => scoreRun({ ...run, metadata: { ...run.metadata, tools: ['read'] } }), /Invalid run metadata/);
  run.attempts[0].labels = [];
  assert.throws(() => scoreRun(run), /Every finding requires one label/);
  run.attempts[0].labels = [match('wrong-snapshot'), fp, fp];
  assert.throws(() => scoreRun(run), /Unexpected defect label/);
  run.attempts[0].labels = [fp, fp, fp];
  run.attempts[3].labels = [match('oracle-alias')];
  assert.throws(() => scoreRun(run), /Unexpected defect label/);
});

test('Формат ответа запрещает пустой блокер, текст без места и лишние поля', () => {
  assert.throws(() => validateResponse({ verdict: 'block', findings: [] }), /Verdict and findings/);
  assert.throws(() => validateResponse({ verdict: 'approve', findings: [item(1)] }), /Verdict and findings/);
  assert.throws(() => validateResponse({ verdict: 'block', findings: [item(0)] }), /Invalid finding/);
  assert.throws(() => validateResponse({ verdict: 'block', findings: [{ ...item(1), mechanism: ' ' }] }), /Invalid finding/);
  assert.throws(() => validateResponse({ verdict: 'approve', findings: [], extra: true }), /Invalid response schema/);
});
