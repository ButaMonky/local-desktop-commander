// Reproduce the single Compact modification from the pinned npm dependency.
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const upstream = path.join(root, 'runtime-deps/node_modules/@wonderwhy-er/desktop-commander');
const pkg = JSON.parse(await readFile(path.join(upstream, 'package.json'), 'utf8'));
if (pkg.version !== '0.2.52') throw new Error('Expected Desktop Commander 0.2.52');
const candidate = path.join(root, 'candidate');
try { await access(candidate); throw new Error('candidate already exists; use a fresh checkout to rebuild.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const source = await readFile(path.join(upstream, 'dist/ui/contracts.js'), 'utf8');
if (!source.includes('export function buildUiToolMeta(')) throw new Error('Unexpected upstream UI contract');
await mkdir(candidate);
await cp(path.join(upstream, 'dist'), path.join(candidate, 'dist'), { recursive: true });
await cp(path.join(upstream, 'LICENSE'), path.join(candidate, 'LICENSE'));
await writeFile(path.join(candidate, 'package.json'), JSON.stringify({name:'desktop-commander-compact-runtime',private:true,type:'module'}, null, 2));
await cp(path.join(root, 'patches/contracts.js'), path.join(candidate, 'dist/ui/contracts.js'));
console.log('Built Compact from Desktop Commander 0.2.52; only dist/ui/contracts.js is modified.');
