import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { acceptsModel, apiURL, fetchModels, listRouteProviders, loadFamilyProvider, loadProvider, selectFamilyProvider } from './providers.mjs';
import { createCatalogServer, createFamilyServer } from './relay.mjs';

async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(accept => server.close(accept));
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'wanglab-routes-'));
  const file = join(dir, 'cc-switch.db');
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE providers(id TEXT, app_type TEXT, name TEXT, settings_config TEXT,
    is_current INTEGER DEFAULT 0, sort_index INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0,
    PRIMARY KEY (id, app_type)); CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT);`);
  t.after(async () => { db.close(); await rm(dir, { recursive: true, force: true }); });
  const requests = [];
  const origin = await listen(t, http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() });
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.endsWith('/models')) {
      const data = path.startsWith('/empty/') ? [{ id: 'gpt-6' }] : [
        { id: 'gpt-6' }, { id: 'claude-fable-5' }, { id: 'deepseek-new' }, { id: 'grok-4.6' },
      ];
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data }));
    } else {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"ok":true}\n\n');
      res.end('data: [DONE]\n\n');
    }
  }));
  function add(id, models = {}, path = id, options = {}) {
    db.prepare('INSERT OR REPLACE INTO providers(id, app_type, name, settings_config) VALUES (?, ?, ?, ?)')
      .run(id, 'opencode', id, JSON.stringify({ models, options: { baseURL: `${origin}/${path}/v1`, apiKey: `key-${id}`, ...options } }));
  }
  add('deepseek-a', { 'deepseek-old': {} });
  add('grok-a', { 'grok-old': {} });
  add('shared');
  add('empty');
  for (const [id, active] of [['codex-a', 1], ['codex-b', 0]]) {
    db.prepare('INSERT INTO providers(id, app_type, name, settings_config, is_current) VALUES (?, ?, ?, ?, ?)')
      .run(id, 'codex', id, JSON.stringify({ auth: { OPENAI_API_KEY: `key-${id}` }, config: `model_provider = "custom"\n[model_providers.custom]\nbase_url = "${origin}/${id}/v1"\n` }), active);
  }
  return { db, file, origin, add, requests };
}

test('DeepSeek and Grok switch independently using cc-switch OpenCode suppliers', async t => {
  const { db, file, origin, add, requests } = await fixture(t);
  const deepseek = await listen(t, createFamilyServer('deepseek', file));
  const grok = await listen(t, createFamilyServer('grok', file));
  const catalog = await listen(t, createCatalogServer(file));
  assert.equal(loadFamilyProvider('deepseek', file).id, 'deepseek-a');
  assert.equal(loadFamilyProvider('grok', file).id, 'grok-a');
  assert.equal(listRouteProviders('deepseek', file).filter(row => row.selected).length, 1);

  const selected = await selectFamilyProvider('deepseek', 'shared', file);
  assert.deepEqual(selected.models, ['deepseek-new']);
  assert.equal(loadFamilyProvider('grok', file).id, 'grok-a');
  assert.equal(loadProvider('codex', undefined, file).apiKey, 'key-codex-a');
  assert.ok(db.prepare('SELECT is_current FROM providers WHERE app_type = ?').all('opencode').every(row => row.is_current === 0));

  let response = await fetch(`${deepseek}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer client-key' },
    body: JSON.stringify({ model: 'deepseek-new', messages: [], stream: true }),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'data: {"ok":true}\n\ndata: [DONE]\n\n');
  assert.equal(requests.at(-1).path, '/shared/v1/chat/completions');
  assert.equal(requests.at(-1).headers.authorization, 'Bearer key-shared');
  assert.ok(!JSON.stringify(listRouteProviders('deepseek', file)).includes('key-shared'));

  response = await fetch(`${grok}/responses`, { method: 'POST', body: JSON.stringify({ model: 'grok-4.6', input: 'hello' }) });
  await response.text();
  assert.equal(response.status, 200);
  assert.equal(requests.at(-1).path, '/grok-a/v1/responses');
  await selectFamilyProvider('grok', 'shared', file);
  assert.equal(loadFamilyProvider('deepseek', file).id, 'shared');
  assert.equal(loadFamilyProvider('grok', file).id, 'shared');

  add('shared', {}, 'edited', { apiKey: 'rotated-key', anthropicBaseURL: `${origin}/messages-service/v1` });
  response = await fetch(`${deepseek}/anthropic/v1/messages`, { method: 'POST', body: JSON.stringify({ model: 'deepseek-new', messages: [] }) });
  await response.text();
  assert.equal(requests.at(-1).path, '/messages-service/v1/messages');
  assert.equal(requests.at(-1).headers.authorization, 'Bearer rotated-key');
  assert.equal(requests.at(-1).headers['x-api-key'], 'rotated-key');
  assert.equal(requests.at(-1).headers['anthropic-version'], '2023-06-01');
  response = await fetch(`${deepseek}/v1/models`);
  assert.deepEqual((await response.json()).data.map(model => model.id), ['deepseek-new']);
  assert.equal(requests.at(-1).path, '/edited/v1/models');

  db.exec("UPDATE providers SET is_current = CASE WHEN id = 'codex-b' THEN 1 ELSE 0 END WHERE app_type = 'codex'");
  response = await fetch(`${catalog}/openai/v1/models`);
  assert.deepEqual((await response.json()).data.map(model => model.id), ['gpt-6']);
  assert.equal(requests.at(-1).headers.authorization, 'Bearer key-codex-b');
  assert.equal(loadFamilyProvider('grok', file).id, 'shared');
});

test('unsupported selections and deleted suppliers never fall back to another provider', async t => {
  const { db, file, requests } = await fixture(t);
  await selectFamilyProvider('deepseek', 'shared', file);
  await assert.rejects(selectFamilyProvider('deepseek', 'empty', file), /no deepseek models/);
  assert.equal(loadFamilyProvider('deepseek', file).id, 'shared');
  const relay = await listen(t, createFamilyServer('deepseek', file));
  let response = await fetch(`${relay}/v1/chat/completions`, { method: 'POST', body: JSON.stringify({ model: 'grok-4.6' }) });
  assert.equal(response.status, 400);
  const count = requests.length;
  db.prepare('DELETE FROM providers WHERE id = ? AND app_type = ?').run('shared', 'opencode');
  response = await fetch(`${relay}/v1/models`);
  assert.equal(response.status, 503);
  assert.equal(requests.length, count);
  assert.equal(loadFamilyProvider('grok', file).id, 'grok-a');
});

test('ambiguous legacy providers require an explicit family selection', async t => {
  const { file, add } = await fixture(t);
  add('deepseek-b', { 'deepseek-new': {} });
  assert.throws(() => loadFamilyProvider('deepseek', file), /cc-switch route deepseek/);
  await selectFamilyProvider('deepseek', 'deepseek-b', file);
  assert.equal(loadFamilyProvider('deepseek', file).id, 'deepseek-b');
});

test('Messages addresses derive from the selected supplier', async t => {
  const { file, add } = await fixture(t);
  add('official', {}, '', { baseURL: 'https://api.deepseek.com/v1' });
  add('third-party', {}, '', { baseURL: 'https://gateway.invalid/prefix/v1' });
  assert.equal(loadProvider('opencode', 'official', file).anthropicUpstream.href, 'https://api.deepseek.com/anthropic/v1');
  assert.equal(loadProvider('opencode', 'third-party', file).anthropicUpstream.href, 'https://gateway.invalid/prefix/v1');
  assert.equal(apiURL('https://gateway.invalid/prefix/v1/', '/v1/messages').href, 'https://gateway.invalid/prefix/v1/messages');
  assert.equal(apiURL('https://gateway.invalid', '/responses').href, 'https://gateway.invalid/v1/responses');
});

test('catalog pagination is filtered without adding historical models', async t => {
  const origin = await listen(t, http.createServer((req, res) => {
    const next = new URL(req.url, 'http://localhost').searchParams.has('after_id');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(next ? { data: [{ id: 'deepseek-next' }, { id: 'gpt-6' }] }
      : { data: [{ id: 'deepseek-new' }, { id: 'grok-4.6' }], has_more: true, last_id: 'page-1' }));
  }));
  const models = await fetchModels({ upstream: new URL(origin), apiKey: 'test' }, 'deepseek');
  assert.deepEqual(models.map(model => model.id), ['deepseek-new', 'deepseek-next']);
  assert.ok(acceptsModel('openai', 'gpt-6-astra'));
  assert.ok(!acceptsModel('openai', 'gpt-4o-realtime-preview'));
  assert.ok(!acceptsModel('unknown', 'gpt-6'));
});
