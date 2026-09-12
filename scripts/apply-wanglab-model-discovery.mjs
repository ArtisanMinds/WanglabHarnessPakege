import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve('node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js');
let source = readFileSync(file, 'utf8');
function replace(before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Model discovery anchor missing: ${before.slice(0, 100)}`);
  source = source.replaceAll(before, after);
}

replace('function resolveRouteModels(request, validation = "strict") {', 'import { isWanglabEndpoint, modelDefaults } from "./wanglab-model-rules.js";\nfunction resolveRouteModels(request, validation = "strict") {');
replace('const entries = configured.length > 0 ? configured :', 'const entries = (isWanglabEndpoint(request.baseURL) || configured.length > 0) ? configured :');
replace('if (entries.length === 0) invalid(provider,', 'if (entries.length === 0 && !isWanglabEndpoint(request.baseURL)) invalid(provider,');
replace('const base = defaults.get(entry.id);', 'const base = isWanglabEndpoint(request.baseURL) ? modelDefaults(defaults, provider, entry.id) : defaults.get(entry.id);');
replace('if (request.provider !== void 0) {\n\t\tconst installed = catalogModels(request.provider);', 'if (request.provider !== void 0 && request.baseURL === void 0) {\n\t\tconst installed = catalogModels(request.provider);');
replace('async function discoverModels(request, storedProfile) {', 'async function discoverModels(request, storedProfile) {\n\tconst saved = storedProfile?.();\n\trequest = { ...request, baseURL: request.baseURL ?? saved?.baseURL, api: request.api ?? saved?.api };');
replace('const stored = storedProfile?.();', 'const stored = saved;');
replace('headers: profile.headers,\n\t\t\tresolveApiKey:', 'baseURL: profile.baseURL,\n\t\t\tapi: profile.api,\n\t\t\theaders: profile.headers,\n\t\t\tresolveApiKey:');

writeFileSync(file, source);
copyFileSync(resolve(import.meta.dirname, 'wanglab-model-rules.mjs'), resolve(file, '../wanglab-model-rules.js'));
console.log('Wanglab endpoint model discovery applied');
