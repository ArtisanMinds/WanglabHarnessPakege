import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve('node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js');
let source = readFileSync(file, 'utf8');
function replace(before, after) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Model discovery anchor missing: ${before.slice(0, 100)}`);
  source = source.replaceAll(before, after);
}

replace('function resolveRouteModels(request) {', 'import { isWanglabEndpoint, modelDefaults } from "./wanglab-model-rules.js";\nfunction resolveRouteModels(request) {');
replace('const entries = configured.length > 0 ? configured :', 'const entries = (isWanglabEndpoint(request.baseURL) || configured.length > 0) ? configured :');
replace('if (entries.length === 0) invalid(provider,', 'if (entries.length === 0 && !isWanglabEndpoint(request.baseURL)) invalid(provider,');
replace('const base = defaults.get(entry.id);', 'const base = isWanglabEndpoint(request.baseURL) ? modelDefaults(defaults, provider, entry.id) : defaults.get(entry.id);');
replace('if (request.provider !== void 0) {\n\t\tconst installed = catalogModels(request.provider);', 'if (request.provider !== void 0 && !request.baseURL) {\n\t\tconst installed = catalogModels(request.provider);');
replace('const LISTABLE_PROTOCOLS = new Set(["openai-completions", "openai-responses"]);', 'const LISTABLE_PROTOCOLS = new Set(["openai-completions", "openai-responses", "anthropic-messages"]);');
replace('const url = listingUrl(request.baseURL);', 'const base = request.baseURL.replace(/\\/+$/, "");\n\tconst url = listingUrl(api === "anthropic-messages" && !base.endsWith("/v1") ? `${base}/v1` : base);');
replace('if (apiKey !== void 0) headers.set("authorization", `Bearer ${apiKey}`);', 'if (apiKey !== void 0) headers.set("authorization", `Bearer ${apiKey}`);\n\t\tif (api === "anthropic-messages") {\n\t\t\theaders.set("anthropic-version", "2023-06-01");\n\t\t\tif (apiKey !== void 0) headers.set("x-api-key", apiKey);\n\t\t}');

writeFileSync(file, source);
copyFileSync(resolve(import.meta.dirname, 'wanglab-model-rules.mjs'), resolve(file, '../wanglab-model-rules.js'));
console.log('Wanglab endpoint model discovery applied');
