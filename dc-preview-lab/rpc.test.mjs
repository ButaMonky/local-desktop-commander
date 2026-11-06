import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('.', import.meta.url));
const upstream = path.join(root, 'runtime-deps/node_modules/@wonderwhy-er/desktop-commander');
const require = createRequire(upstream + '/package.json');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('real stdio MCP returns byte-identical file content with and without preview metadata', { timeout: 60000 }, async () => {
  const run = await mkdtemp(path.join(root, 'rpc-run-'));
  const fixture = path.join(run, 'fixture.txt');
  const text = Array.from({length: 320}, (_, n) => `${n}: Japanese 日本語 😀 preserved ${'abcdef'.repeat(20)}`).join('\n');
  await writeFile(fixture, text, 'utf8');
  const results = [];
  for (const [label, dist] of [['original', upstream + '/dist'], ['candidate', path.join(root, 'candidate/dist')]]) {
    const home = path.join(run, label);
    const configDir = path.join(home, '.claude-server-commander');
    await mkdir(configDir, {recursive: true});
    await writeFile(path.join(configDir, 'config.json'), JSON.stringify({
      telemetryEnabled: false, allowedDirectories: [run],
      welcomeOnboardingEligible: false, pendingWelcomeOnboarding: false,
      fileReadLineLimit: 1000, fileWriteLineLimit: 50, feedbackGiven: true,
      abTest_McpUiPreviews: 'showMCPUi',
    }));
    const transport = new StdioClientTransport({
      command: process.execPath, args: [path.join(root, 'isolated-server.mjs'), dist, home],
      stderr: 'pipe', cwd: root,
    });
    const client = new Client({name: 'preview-isolation-test', version: '1.0.0'}, {capabilities:{}});
    let stderr = '';
    transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      const reads = [];
      for (const args of [{path:fixture,length:1000}, {path:fixture,offset:17,length:9}, {path:fixture,offset:-3}]) {
        const result = await client.callTool({name:'read_file',arguments:args}, undefined, {timeout:15000});
        assert.notEqual(result.isError, true, JSON.stringify(result));
        reads.push(result);
      }
      assert.ok(reads[0].content.some(c => c.type === 'text' && c.text.includes(text)));
      results.push({label,tools,reads});
    } finally {
      await client.close();
      await transport.close();
      await writeFile(path.join(run, `${label}-stderr.txt`), stderr);
    }
  }
  assert.deepEqual(results[1].reads, results[0].reads);
  const baseline = structuredClone(results[0].tools);
  for (const t of baseline.tools) delete t._meta;
  assert.deepEqual(results[1].tools, baseline);
  const evidence = { fixtureBytes:Buffer.byteLength(text),
    tools:baseline.tools.length, readComparisons:3,
    originalHashes:results[0].reads.map(hash),candidateHashes:results[1].reads.map(hash),
    modelResultsEqual:true, hostPerformanceTested:false,
    harness:'real stdio; private test home; network disabled; custom entry skips startup services' };
  await writeFile(path.join(run, 'result.json'), JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({run,...evidence}));
});
