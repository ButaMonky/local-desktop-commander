// Compact UI launcher: run the pinned upstream index.js and all startup services.
import './candidate/dist/bootstrap.js';
import os from 'node:os';
import path from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const lab = fileURLToPath(new URL('.', import.meta.url));
const upstream = path.join(lab, 'runtime-deps/node_modules/@wonderwhy-er/desktop-commander');
const [variant = 'candidate', stateArg = 'full-state'] = process.argv.slice(2);
if (!['candidate', 'original'].includes(variant) || process.argv.length > 4) {
  throw new Error('Only original/candidate comparison startup is supported.');
}
const state = path.resolve(lab, stateArg);
const relativeState = path.relative(lab, state);
if (!relativeState || relativeState.startsWith('..') || path.isAbsolute(relativeState)) {
  throw new Error('State must be in a dedicated directory inside the preview lab.');
}
const dist = variant === 'candidate' ? path.join(lab, 'candidate/dist') : path.join(upstream, 'dist');
const configFile = path.join(state, 'config.json');
await mkdir(state, { recursive: true });
try {
  await readFile(configFile);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const config = JSON.parse(await readFile(path.join(os.homedir(), '.claude-server-commander/config.json'), 'utf8'));
  // Preserve existing tool limits, allowed paths and blocked commands in a private copy.
  Object.assign(config, { telemetryEnabled: false, welcomeOnboardingEligible: false,
    pendingWelcomeOnboarding: false, abTest_McpUiPreviews: 'showMCPUi' });
  await writeFile(configFile, JSON.stringify(config, null, 2), { flag: 'wx' });
}
process.env.DESKTOP_COMMANDER_DISABLE_TELEMETRY = '1';
// Tunnel credentials belong to the parent tunnel process, never to file/terminal tools.
delete process.env.CONTROL_PLANE_API_KEY;

const upstreamRequire = createRequire(path.join(upstream, 'package.json'));
const upstreamEntry = pathToFileURL(path.join(upstream, 'dist/index.js')).href;
const distUrl = pathToFileURL(dist + path.sep).href;
const configUrl = pathToFileURL(path.join(dist, 'config.js')).href;
const redirectedModules = [];
let resolvingDependency = false;
registerHooks({
  resolve(specifier, context, next) {
    if (variant === 'candidate' && context.parentURL?.startsWith(distUrl) &&
        !resolvingDependency && !specifier.startsWith('.') &&
        !specifier.startsWith('/') && !specifier.includes(':')) {
      if (context.conditions.includes('require')) {
        resolvingDependency = true;
        try { return next(upstreamRequire.resolve(specifier), context); }
        finally { resolvingDependency = false; }
      }
      return next(specifier, { ...context, parentURL: upstreamEntry });
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === configUrl) {
      redirectedModules.push('config.js');
      // Redirect only DC persistence. Keep the real home, network and tool handlers intact.
      return { format: 'module', shortCircuit: true, source:
        `export const USER_HOME=${JSON.stringify(os.homedir())};\n` +
        `export const CONFIG_FILE=${JSON.stringify(configFile)};\n` +
        `export const TOOL_CALL_FILE=${JSON.stringify(path.join(state, 'claude_tool_call.log'))};\n` +
        'export const TOOL_CALL_FILE_MAX_SIZE=10485760;\nexport const DEFAULT_COMMAND_TIMEOUT=1000;\n' };
    }
    for (const [file, expression, destination] of [
      ['utils/toolHistory.js', "path.join(os.homedir(), '.claude-server-commander')", state],
      ['utils/fuzzySearchLogger.js', "path.join(os.homedir(), '.claude-server-commander-logs')", path.join(state, 'logs')]
    ]) {
      if (url === pathToFileURL(path.join(dist, file)).href) {
        const loaded = next(url, context);
        const source = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8');
        if (!source.includes(expression)) throw new Error(`Unexpected storage implementation in ${file}`);
        redirectedModules.push(file);
        return { ...loaded, source: source.replace(expression, JSON.stringify(destination)) };
      }
    }
    return next(url, context);
  }
});
const entry = path.join(dist, 'index.js');
process.argv = [process.execPath, entry, '--no-onboarding'];
await import(pathToFileURL(entry));
await writeFile(path.join(state, 'runtime-layout.json'), JSON.stringify({
  variant, entry, state, realHome: os.homedir(), redirectedModules,
  networkMonkeypatch: false, runtimeCredentialRemoved: !process.env.CONTROL_PLANE_API_KEY
}, null, 2));
