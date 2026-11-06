import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as candidateMeta from './candidate/dist/ui/contracts.js';

const upstream = fileURLToPath(new URL('./runtime-deps/node_modules/@wonderwhy-er/desktop-commander/', import.meta.url));
const require = createRequire(upstream + 'package.json');
const { zodToJsonSchema } = require('zod-to-json-schema');
const schemas = await import(pathToFileURL(upstream + 'dist/tools/schemas.js'));
const originalMeta = await import(pathToFileURL(upstream + 'dist/ui/contracts.js'));

// Execute the real tools/list registration block without starting the server,
// network, configuration manager, telemetry, or file/process tool handlers.
async function catalog(sourcePath, meta) {
  const source = await readFile(sourcePath, 'utf8');
  const start = source.indexOf('server.setRequestHandler(ListToolsRequestSchema,');
  const end = source.indexOf("import * as handlers", start);
  assert.ok(start >= 0 && end > start, 'known upstream registration boundary');
  let callback;
  vm.runInNewContext(source.slice(start, end), {
    ...schemas, ...meta, zodToJsonSchema,
    ListToolsRequestSchema: {}, server: { setRequestHandler: (_schema, fn) => { callback = fn; } },
    shouldShowMcpUiPreviews: async () => true,
    shouldIncludeTool: () => true,
    OS_GUIDANCE: 'WINDOWS TEST', DEV_TOOL_GUIDANCE: 'TEST', PATH_GUIDANCE: 'TEST', CMD_PREFIX_DESCRIPTION: 'TEST',
    logToStderr: () => {},
  }, { timeout: 2000 });
  return JSON.parse(JSON.stringify(await callback()));
}

test('real tools/list preserves all names, descriptions, schemas and annotations; only five UI metadata fields disappear', async () => {
  const original = await catalog(upstream + 'dist/server.js', originalMeta);
  const candidate = await catalog(new URL('./candidate/dist/server.js', import.meta.url), candidateMeta);
  const affected = original.tools.filter(t => t._meta).map(t => t.name).sort();
  assert.deepEqual(affected, ['edit_block', 'get_config', 'list_directory', 'read_file', 'write_file']);
  assert.ok(original.tools.length > 20);
  for (const tool of original.tools) delete tool._meta;
  assert.deepEqual(candidate, original);
  console.log(`Compared ${candidate.tools.length} tool descriptors; five UI links removed, other fields identical.`);
});
