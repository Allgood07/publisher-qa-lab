import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const contracts = JSON.parse(await readFile(new URL('./contracts.json', import.meta.url), 'utf8'));
export const taskIds = Object.freeze(Object.keys(contracts).sort());

export async function renderTask(id) {
  if (!Object.hasOwn(contracts, id)) throw new Error('Unknown task ID');
  const [prompt, source] = await Promise.all([
    readFile(new URL('./prompt.md', import.meta.url), 'utf8'),
    readFile(new URL(`./tasks/${id}/candidate.mjs`, import.meta.url), 'utf8'),
  ]);
  const lines = source.trimEnd().split('\n');
  const diff = ['--- /dev/null', '+++ b/candidate.mjs', `@@ -0,0 +1,${lines.length} @@`, ...lines.map(line => `+${line}`)];
  return `${prompt.trim()}\n\n## Contract\n${contracts[id]}\n\n## Candidate diff\n\`\`\`diff\n${diff.join('\n')}\n\`\`\`\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node task.mjs <task-id>');
  process.stdout.write(await renderTask(process.argv[2]));
}
