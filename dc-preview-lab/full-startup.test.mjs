import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(path.join(root, 'runtime-deps/node_modules/@wonderwhy-er/desktop-commander/package.json'));
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const hash = value => createHash('sha256').update(value).digest('hex');
const text = result => result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');

test('full index startup preserves file data, edit and terminal behavior without UI metadata', { timeout: 120000 }, async () => {
  const run = await mkdtemp(path.join(root, 'full-run-'));
  const originalConfig = path.join(os.homedir(), '.claude-server-commander/config.json');
  const configBefore = await readFile(originalConfig);
  const originalHash = hash(configBefore);
  const fixture = path.join(run, 'fixture.txt');
  const source = Array.from({ length: 320 }, (_, n) => `${n}: Japanese 日本語 😀 preserved ${'abcdef'.repeat(20)}`).join('\n');
  await writeFile(fixture, source);
  const results = [];
  for (const variant of ['original', 'candidate']) {
    const client = new Client({ name: 'preview-full-startup-test', version: '1.0.0' }, { capabilities: {} });
    const auditFile = path.join(run, `${variant}-original-write-attempts.jsonl`);
    await writeFile(auditFile, '');
    const transport = new StdioClientTransport({ command: process.execPath,
      args: ['--import', pathToFileURL(path.join(root, 'audit-original-writes.mjs')).href, path.join(root, 'full-server.mjs'), variant, path.join(run, variant)],
      env: { ...process.env, DC_PREVIEW_WRITE_AUDIT: auditFile }, cwd: root, stderr: 'pipe' });
    let stderr = '';
    transport.stderr?.on('data', chunk => { stderr += chunk; });
    const call = async (name, args) => {
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 20000 });
      assert.notEqual(result.isError, true, JSON.stringify(result));
      return result;
    };
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      const reads = [];
      for (const args of [{ path: fixture, length: 1000 }, { path: fixture, offset: 17, length: 9 }, { path: fixture, offset: -3 }]) {
        reads.push(await call('read_file', args));
      }
      assert.ok(text(reads[0]).includes(source));
      const scratch = path.join(run, `${variant}-scratch.txt`);
      await call('write_file', { path: scratch, content: 'before 日本語 😀', mode: 'rewrite' });
      await call('edit_block', { file_path: scratch, old_string: 'before', new_string: 'after' });
      assert.equal(await readFile(scratch, 'utf8'), 'after 日本語 😀');
      assert.ok(text(await call('list_directory', { path: run, depth: 1 })).includes('fixture.txt'));
      const processResult = await call('start_process', {
        command: "[Console]::WriteLine('PREVIEW_FULL_STARTUP_OK')", shell: 'powershell.exe', timeout_ms: 10000
      });
      let processText = text(processResult);
      if (!processText.includes('PREVIEW_FULL_STARTUP_OK')) {
        const pid = Number(processText.match(/(?:PID|pid)[:\s]+(\d+)/)?.[1]);
        assert.ok(pid > 0, processText);
        processText += text(await call('read_process_output', { pid, timeout_ms: 10000 }));
      }
      assert.ok(processText.includes('PREVIEW_FULL_STARTUP_OK'), processText);
      results.push({ variant, tools, reads, fileEditPassed: true, terminalPassed: true });
    } finally {
      await client.close();
      await transport.close();
      await writeFile(path.join(run, `${variant}-stderr.txt`), stderr);
    }
    assert.equal(await readFile(auditFile, 'utf8'), '', 'No child may mutate original DC state');
    const layout = JSON.parse(await readFile(path.join(run, variant, 'runtime-layout.json'), 'utf8'));
    assert.deepEqual(layout.redirectedModules.sort(), ['config.js', 'utils/fuzzySearchLogger.js', 'utils/toolHistory.js']);
    assert.equal(layout.realHome, os.homedir());
    assert.equal(layout.runtimeCredentialRemoved, true);
  }
  assert.deepEqual(results[1].reads, results[0].reads);
  const baseline = structuredClone(results[0].tools);
  for (const tool of baseline.tools) delete tool._meta;
  assert.deepEqual(results[1].tools, baseline);
  const configAfter = await readFile(originalConfig);
  const beforeSettings = JSON.parse(configBefore);
  const afterSettings = JSON.parse(configAfter);
  const concurrentlyUpdatedKeys = Object.keys({ ...beforeSettings, ...afterSettings }).filter(k => JSON.stringify(beforeSettings[k]) !== JSON.stringify(afterSettings[k]));
  // A live production server updates its usage counters concurrently. Guarded test
  // children cannot write that file; still fail on any actual settings change.
  delete beforeSettings.usageStats;
  delete afterSettings.usageStats;
  assert.deepEqual(afterSettings, beforeSettings, 'Existing DC settings must remain unchanged');
  const evidence = { entrypoint: 'unchanged full dist/index.js', tools: baseline.tools.length,
    readHashes: results.map(r => ({ variant: r.variant, hashes: r.reads.map(v => hash(JSON.stringify(v))) })),
    fileEditPassed: true, terminalPassed: true, originalStateWriteAttempts: 0,
    existingSettingsUnchanged: true, existingConfigBytesUnchanged: hash(configAfter) === originalHash, concurrentlyUpdatedKeys,
    isolation: 'private DC persistence; actual os.homedir and network preserved; telemetry disabled; no onboarding',
    desktopPerformanceMeasured: false };
  await writeFile(path.join(run, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ run, ...evidence }));
});
