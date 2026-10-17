// Usage: node scripts/rea-inventory.mjs http://127.0.0.1:9222 output.json
// Requires Node.js and npm. Uses the pinned official REA package.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [endpoint, output] = process.argv.slice(2);
if (!endpoint || !output) throw new Error('Provide a loopback CDP HTTP endpoint and a new output JSON path.');
const url = new URL(endpoint);
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) {
  throw new Error('Use a loopback HTTP CDP endpoint without credentials.');
}
const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', 'rea-agents@6.5.0', 'list-browser-targets', endpoint, '--format', 'json'],
  { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, shell: false });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'REA failed');
const evidence = JSON.parse(result.stdout);
if (evidence.error) throw new Error(JSON.stringify(evidence));
if (evidence.operation !== 'list_browser_targets' || !Array.isArray(evidence.normalized_result?.targets)) {
  throw new Error('Unexpected REA evidence format');
}
writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
for (const target of evidence.normalized_result.targets) {
  const blocked = /privacy error|certificate|access denied/i.test(target.title);
  console.log(JSON.stringify({ url: target.url, title: target.title, targetId: target.target_id,
    status: blocked ? 'blocked-page; do not treat as application evidence' : 'listed; page inspection still required' }));
}
