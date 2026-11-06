// Test-only guard: fail and record any attempt by this child to mutate original DC state.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';
const audit = process.env.DC_PREVIEW_WRITE_AUDIT;
if (!audit) throw new Error('Explicit audit output required');
const append = fs.appendFileSync.bind(fs);
const roots = ['.claude-server-commander', '.claude-server-commander-logs'].map(p => path.resolve(os.homedir(), p).toLowerCase());
function check(method, input) {
  if (typeof input !== 'string' && !(input instanceof URL)) return;
  const target = path.resolve(input instanceof URL ? fileURLToPath(input) : input).toLowerCase();
  if (roots.some(root => target === root || target.startsWith(root + path.sep))) {
    append(audit, JSON.stringify({ method, target }) + '\n');
    throw new Error('Test guard rejected mutation of original DC state');
  }
}
for (const method of ['writeFile', 'appendFile', 'mkdir', 'unlink', 'rm', 'rmdir', 'rename', 'truncate']) {
  for (const [api, name] of [[fsp, method], [fs, method], [fs, method + 'Sync']]) {
    const original = api[name];
    if (!original) continue;
    api[name] = function (...args) {
      check(name, args[0]);
      if (method === 'rename') check(name, args[1]);
      return Reflect.apply(original, this, args);
    };
  }
}
syncBuiltinESMExports();
