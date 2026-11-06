import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { createRequire, registerHooks, syncBuiltinESMExports } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [dist, testHome] = process.argv.slice(2);
if (!dist || !testHome) throw new Error('Explicit test paths required');
// Test harness boundary, NOT a production security sandbox.
os.homedir = () => testHome;
const denyNetwork = () => { throw new Error('Network disabled in preview lab'); };
http.request = http.get = https.request = https.get = net.connect = net.createConnection = tls.connect = denyNetwork;
globalThis.fetch = async () => { throw new Error('Network disabled in preview lab'); };
syncBuiltinESMExports();
process.env.DESKTOP_COMMANDER_DISABLE_TELEMETRY = '1';
globalThis.disableOnboarding = true;
// Synchronous hooks also cover upstream's createRequire-based PDF imports.
const upstreamRequire = createRequire(new URL('./runtime-deps/node_modules/@wonderwhy-er/desktop-commander/package.json', import.meta.url));
let resolvingDependency = false;
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/dc-preview-lab/candidate/dist/') && !resolvingDependency && !specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.includes(':')) {
    if (context.conditions.includes('require')) {
      resolvingDependency = true;
      try { return next(upstreamRequire.resolve(specifier), context); }
      finally { resolvingDependency = false; }
    }
    return next(specifier, { ...context, parentURL: new URL('./runtime-deps/node_modules/@wonderwhy-er/desktop-commander/dist/index.js', import.meta.url).href });
  }
  return next(specifier, context);
} });
const load = file => import(pathToFileURL(`${dist}/${file}`));
const { FilteredStdioServerTransport } = await load('custom-stdio.js');
const transport = new FilteredStdioServerTransport();
globalThis.mcpTransport = transport;
const { configManager } = await load('config-manager.js');
await configManager.loadConfig();
const { server } = await load('server.js');
server.oninitialized = () => transport.enableNotifications();
// No index.js: skip flag refresh, browser downloads and CLI/Remote entrypoints.
await server.connect(transport);
