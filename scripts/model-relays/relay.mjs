import http from 'node:http';
import https from 'node:https';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { acceptsModel, apiURL, DATABASE, fetchModels, loadFamilyProvider, loadProvider } from './providers.mjs';

const MAX_BODY_BYTES = 32 * 1024 * 1024;
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

function jsonResponse(res, status, data) {
  if (res.destroyed) return;
  if (res.headersSent) { res.destroy(); return; }
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function copyHeaders(headers, extra = []) {
  const blocked = new Set([...HOP_HEADERS, ...extra]);
  for (const name of String(headers.connection || '').split(',')) blocked.add(name.trim().toLowerCase());
  return Object.fromEntries(Object.entries(headers).filter(([name, value]) => value !== undefined && !blocked.has(name.toLowerCase())));
}

function forward(req, res, body, config, messages) {
  const incoming = new URL(req.url, 'http://localhost');
  const target = apiURL(messages ? config.anthropicUpstream : config.upstream, messages ? 'messages' : incoming.pathname);
  target.search = incoming.search;
  const headers = copyHeaders(req.headers, ['authorization', 'x-api-key', 'host', 'content-length']);
  headers.authorization = `Bearer ${config.apiKey}`;
  headers['content-length'] = body.length;
  if (messages) {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] ||= '2023-06-01';
  }
  const transport = target.protocol === 'https:' ? https : http;
  const upstream = transport.request(target, { method: req.method, headers, timeout: 600_000 }, response => {
    response.on('error', () => jsonResponse(res, 502, { error: { message: 'Upstream connection failed' } }));
    if (res.destroyed) { response.destroy(); return; }
    res.writeHead(response.statusCode || 502, copyHeaders(response.headers));
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Upstream timeout')));
  upstream.on('error', () => jsonResponse(res, 502, { error: { message: 'Upstream unavailable' } }));
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
  upstream.end(body);
}

export function createFamilyServer(family, database = DATABASE) {
  if (!['deepseek', 'grok'].includes(family)) throw new Error('Unsupported model family');
  return http.createServer(async (req, res) => {
    try {
      const path = new URL(req.url || '/', 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/health') {
        jsonResponse(res, 200, { ok: true, service: `wanglab-${family}-relay` });
        return;
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' });
        res.end();
        return;
      }
      const config = loadFamilyProvider(family, database);
      if (req.method === 'GET' && ['/models', '/v1/models'].includes(path)) {
        jsonResponse(res, 200, { object: 'list', data: await fetchModels(config, family) });
        return;
      }
      const messages = family === 'deepseek' && ['/messages', '/v1/messages', '/anthropic/v1/messages'].includes(path);
      const completion = ['/chat/completions', '/v1/chat/completions', '/responses', '/v1/responses'].includes(path);
      const files = family === 'deepseek' && /^\/(?:v1\/)?files(?:\/|$)/.test(path);
      if (!(req.method === 'POST' && (messages || completion)) && !(files && ['GET', 'POST', 'DELETE'].includes(req.method))) {
        jsonResponse(res, 404, { error: { message: 'Relay route not found' } });
        return;
      }
      const body = await readBody(req);
      if (messages || completion) {
        let payload;
        try { payload = JSON.parse(body); }
        catch { jsonResponse(res, 400, { error: { message: 'Invalid JSON request' } }); return; }
        if (!acceptsModel(family, payload.model)) {
          jsonResponse(res, 400, { error: { message: `A ${family} model is required for this route` } });
          return;
        }
      }
      forward(req, res, body, config, messages);
    } catch {
      jsonResponse(res, 503, { error: { message: `${family} supplier unavailable; check cc-switch route ${family}` } });
    }
  });
}

export function createCatalogServer(database = DATABASE) {
  return http.createServer(async (req, res) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') {
      jsonResponse(res, 200, { ok: true, service: 'wanglab-model-catalog' });
      return;
    }
    const routes = { '/openai/v1/models': ['codex', 'openai'], '/anthropic/v1/models': ['claude', 'anthropic'] };
    const route = routes[path];
    if (req.method !== 'GET' || !route) {
      jsonResponse(res, 404, { error: { message: 'Catalog route not found' } });
      return;
    }
    try {
      const data = await fetchModels(loadProvider(route[0], undefined, database), route[1]);
      jsonResponse(res, 200, { object: 'list', data });
    } catch {
      jsonResponse(res, 503, { error: { message: 'Model catalog unavailable' } });
    }
  });
}

export function startRelays() {
  const entries = [
    [createFamilyServer('deepseek'), 15724],
    [createCatalogServer(), 15725],
    [createFamilyServer('grok'), 15726],
  ];
  for (const [server, port] of entries) {
    server.on('error', error => {
      console.error(`[wanglab-relays] Port ${port}: ${error.code || 'listen failed'}`);
      process.exitCode = 1;
      for (const [active] of entries) active.close();
    });
    server.listen(port, '127.0.0.1', () => console.log(`[wanglab-relays] Listening on 127.0.0.1:${port}`));
  }
  function shutdown() {
    for (const [server] of entries) server.close();
    setTimeout(() => process.exit(0), 500).unref();
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startRelays();
