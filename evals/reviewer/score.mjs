import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { taskIds } from './task.mjs';

const gold = JSON.parse(await readFile(new URL('./gold.json', import.meta.url), 'utf8'));
export const attemptsPerTask = 3;
const kinds = ['measured', 'synthetic'];
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const positive = x => Number.isSafeInteger(x) && x > 0;
const ratio = (n, d) => d === 0 ? null : n / d;
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function shape(value, fields) {
  return isObject(value) && Object.keys(value).length === fields.length && fields.every(k => Object.hasOwn(value, k));
}

export function validateResponse(response) {
  requireThat(shape(response, ['verdict', 'findings']) && Array.isArray(response.findings), 'Invalid response schema');
  const { verdict, findings } = response;
  requireThat(verdict === 'approve' ? findings.length === 0 : verdict === 'block' && findings.length > 0, 'Verdict and findings disagree');
  for (const finding of findings) {
    requireThat(shape(finding, ['file', 'line', 'mechanism', 'consequence', 'repro']) && finding.file === 'candidate.mjs' && positive(finding.line)
      && text(finding.mechanism) && text(finding.consequence) && text(finding.repro), 'Invalid finding');
  }
}

function validUtc(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().replace('.000Z', 'Z') === value;
}

function validateRun(run) {
  requireThat(shape(run, ['kind', 'metadata', 'attempts']) && kinds.includes(run.kind) && Array.isArray(run.attempts), 'Invalid run schema');
  const m = run.metadata;
  const fields = ['corpusSha', 'promptSha256', 'roleRevision', 'model', 'dateUtc', 'sampling', 'tools', 'timeoutMs', 'maxOutputTokens'];
  requireThat(shape(m, fields) && text(m.corpusSha) && /^[a-f0-9]{40}$/.test(m.corpusSha) && text(m.promptSha256) && /^[a-f0-9]{64}$/.test(m.promptSha256)
    && text(m.roleRevision) && text(m.model) && validUtc(m.dateUtc)
    && isObject(m.sampling) && Object.keys(m.sampling).length > 0 && Array.isArray(m.tools) && m.tools.length === 0
    && positive(m.timeoutMs) && positive(m.maxOutputTokens), 'Invalid run metadata');
}

function grade(entry) {
  const { taskId, attempt, status } = entry;
  const expected = gold[taskId];
  if (status === 'timeout' || status === 'invalid') {
    requireThat(shape(entry, ['taskId', 'attempt', 'status', 'note']) && text(entry.note), 'Incomplete unsuccessful attempt');
    return { taskId, attempt, status, note: entry.note, verdict: null, matched: [], missed: expected.defect ? [expected.defect.id] : [], falsePositives: [], disputed: [] };
  }
  requireThat(status === 'ok' && shape(entry, ['taskId', 'attempt', 'status', 'response', 'labels']), 'Invalid attempt schema');
  validateResponse(entry.response);
  requireThat(Array.isArray(entry.labels) && entry.labels.length === entry.response.findings.length, 'Every finding requires one label in response order');
  const matched = new Set(), falsePositives = [], disputed = [];
  for (const [i, label] of entry.labels.entries()) {
    const finding = entry.response.findings[i];
    requireThat(isObject(label) && text(label.note), 'A label needs an explanation');
    if (label.kind === 'match') {
      requireThat(shape(label, ['kind', 'defectId', 'note']) && text(label.defectId) && expected.defect?.id === label.defectId, `Unexpected defect label for ${taskId}`);
      matched.add(label.defectId);
    } else {
      requireThat(shape(label, ['kind', 'note']) && (label.kind === 'false-positive' || label.kind === 'disputed'), 'Invalid finding label');
      (label.kind === 'false-positive' ? falsePositives : disputed).push({ index: i + 1, finding, note: label.note });
    }
  }
  const missed = expected.defect && !matched.has(expected.defect.id) ? [expected.defect.id] : [];
  return { taskId, attempt, status, verdict: entry.response.verdict, matched: [...matched], missed, falsePositives, disputed };
}

export function scoreRun(run) {
  validateRun(run);
  requireThat(run.attempts.length === taskIds.length * attemptsPerTask, 'A complete run has exactly 24 attempt slots');
  const attempts = new Map();
  for (const entry of run.attempts) {
    requireThat(isObject(entry) && taskIds.includes(entry.taskId) && positive(entry.attempt) && entry.attempt <= attemptsPerTask, 'Invalid attempt slot');
    const key = `${entry.taskId}/${entry.attempt}`;
    requireThat(!attempts.has(key), `Duplicate attempt slot: ${key}`);
    attempts.set(key, entry);
  }

  const rows = [];
  const totals = { attempts: 0, ok: 0, timeout: 0, invalid: 0, tp: 0, fn: 0, fp: 0, disputed: 0, cleanAttempts: 0, cleanValid: 0, cleanBlocked: 0, stableTasks: 0, completeTasks: 0, tasks: taskIds.length };
  for (const id of taskIds) {
    const clean = gold[id].verdict === 'approve';
    const group = Array.from({ length: attemptsPerTask }, (_, i) => grade(attempts.get(`${id}/${i + 1}`)));
    for (const row of group) {
      rows.push({ ...row, expectedVerdict: gold[id].verdict });
      totals.attempts++;
      totals[row.status]++;
      totals.tp += row.matched.length;
      totals.fn += row.missed.length;
      totals.fp += row.falsePositives.length;
      totals.disputed += row.disputed.length;
      if (clean) {
        totals.cleanAttempts++;
        if (row.status === 'ok') totals.cleanValid++;
        if (row.verdict === 'block') totals.cleanBlocked++;
      }
    }
    if (group.every(row => row.status === 'ok')) {
      totals.completeTasks++;
      const signature = row => JSON.stringify([row.verdict, row.matched]);
      if (group.every(row => signature(row) === signature(group[0]))) totals.stableTasks++;
    }
  }

  return {
    kind: run.kind,
    metadata: run.metadata,
    provisional: totals.disputed > 0,
    totals,
    metrics: {
      precision: ratio(totals.tp, totals.tp + totals.fp),
      recall: ratio(totals.tp, totals.tp + totals.fn),
      falseBlockRateAllClean: ratio(totals.cleanBlocked, totals.cleanAttempts),
      falseBlockRateValidClean: ratio(totals.cleanBlocked, totals.cleanValid),
      repeatabilityAllTasks: ratio(totals.stableTasks, totals.tasks),
      repeatabilityCompleteTasks: ratio(totals.stableTasks, totals.completeTasks),
    },
    rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node score.mjs <labeled-run.json>');
  const run = JSON.parse(await readFile(process.argv[2], 'utf8'));
  process.stdout.write(`${JSON.stringify(scoreRun(run), null, 2)}\n`);
}
