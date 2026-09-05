import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import http from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all';
import { modelDefaults } from './wanglab-model-rules.mjs';

const library = pathToFileURL(resolve('node_modules/@deepseek-ai/dsh-llm-pi-ai/lib/index.js'));
const fixture = new URL(`./.wanglab-test-${process.pid}.mjs`, library);
writeFileSync(fixture, `${readFileSync(library, 'utf8')}\nexport { discoverModels, resolveRouteModels };\n`);
const { discoverModels, resolveRouteModels } = await import(fixture.href);
unlinkSync(fixture);
let server;
let base;
let requests = [];
before(async () => {
  server = http.createServer((req, res) => {
    requests.push({ path: req.url, headers: req.headers });
    res.setHeader('content-type', 'application/json');
    if (req.headers.authorization !== 'Bearer sk-test') {
      res.writeHead(401);
      res.end('{}');
      return;
    }
    res.end(JSON.stringify({ data: [{ id: 'remote-only-model', context_window: 123456 }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('native OpenAI uses the configured endpoint and returns only its advertised models', async () => {
  const models = await discoverModels({ provider: 'openai', api: 'openai-responses', baseURL: `${base}/prefix/v1`, apiKey: 'sk-test' });
  assert.deepEqual(models, [{ id: 'remote-only-model', contextWindow: 123456 }]);
  assert.equal(requests.at(-1).path, '/prefix/v1/models');
});

test('Anthropic discovers using its own credential and /v1/models path', async () => {
  await discoverModels({ provider: 'anthropic', api: 'anthropic-messages', baseURL: base }, () => ({ resolveApiKey: () => 'sk-test' }));
  assert.equal(requests.at(-1).path, '/v1/models');
  assert.equal(requests.at(-1).headers['x-api-key'], 'sk-test');
  assert.equal(requests.at(-1).headers['anthropic-version'], '2023-06-01');
});

test('failed endpoint authentication never falls back to the installed model catalog', async () => {
  await assert.rejects(discoverModels({ provider: 'openai', api: 'openai-responses', baseURL: base, apiKey: 'sk-wrong' }), /401/);
});

test('a provider-only request discovers from its saved connection instead of historical builtins', async () => {
  let reads = 0;
  const models = await discoverModels({ provider: 'anthropic' }, () => {
    reads++;
    return { baseURL: base, api: 'anthropic-messages', resolveApiKey: () => 'sk-test' };
  });
  assert.equal(reads, 1);
  assert.deepEqual(models.map(model => model.id), ['remote-only-model']);
  assert.equal(requests.at(-1).path, '/v1/models');
  assert.equal(requests.at(-1).headers['x-api-key'], 'sk-test');
});

test('a saved connection error and an explicitly cleared URL never produce builtin models', async () => {
  const saved = () => ({ baseURL: `${base}/v1`, api: 'openai-responses', resolveApiKey: () => 'sk-wrong' });
  await assert.rejects(discoverModels({ provider: 'openai' }, saved), /401/);
  await assert.rejects(discoverModels({ provider: 'openai', baseURL: '' }, saved), /set a baseURL/);
});

test('an empty Wanglab model list stays empty during an offline first launch', () => {
  const resolved = resolveRouteModels({ provider: 'openai', api: 'openai-responses', baseURL: 'https://10.201.2.89:31415/v1', models: [], defaultContextWindow: 262144, defaultMaxTokens: 32768, defaultInput: ['text'] });
  assert.deepEqual(resolved.models, []);
});

test('Grok keeps xAI metadata while using the requested Responses protocol', () => {
  const resolved = resolveRouteModels({ provider: 'xai', api: 'openai-responses', baseURL: 'https://10.201.2.89:31418/v1', models: [{ id: 'grok-4.6' }], defaultContextWindow: 262144, defaultMaxTokens: 32768, defaultInput: ['text'] });
  assert.equal(resolved.models[0].api, 'openai-responses');
  assert.equal(resolved.models[0].id, 'grok-4.6');
  assert.equal(resolved.models[0].contextWindow, getBuiltinModels('xai').find(model => model.id === 'grok-4.6').contextWindow);
});

test('new GPT IDs use family metadata without maintaining a separate effort table', () => {
  const catalog = new Map(getBuiltinModels('openai').map(model => [model.id, model]));
  assert.equal(modelDefaults(catalog, 'openai', 'gpt-6-astra'), catalog.get('gpt-5.5'));
  assert.equal(modelDefaults(catalog, 'openai', 'gpt-5.6-sol'), catalog.get('gpt-5.6-sol'));
  assert.equal(modelDefaults(catalog, 'openai', 'unrelated-model'), undefined);
});
