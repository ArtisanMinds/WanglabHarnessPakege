import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parse } from 'smol-toml';

export const DATABASE = process.env.WANGLAB_CC_SWITCH_DB || join(homedir(), '.cc-switch/cc-switch.db');
export const FAMILIES = ['deepseek', 'grok'];
const MAX_BYTES = 4 * 1024 * 1024;

function openDatabase(database, readOnly = true) {
  const db = new DatabaseSync(database, { readOnly });
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function routeKey(family) {
  if (!FAMILIES.includes(family)) throw new Error('Route must be deepseek or grok');
  return `wanglab.route.${family}`;
}

function settingsOf(row) {
  try {
    return JSON.parse(row.settings_config);
  } catch {
    throw new Error('cc-switch provider settings are invalid');
  }
}

function endpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('cc-switch endpoint is invalid'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('cc-switch endpoint must be an HTTP(S) base URL');
  return url;
}

function validateProvider(baseURL, apiKey, auth) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.includes('SET_ME'))
    throw new Error('cc-switch credential is missing');
  return { upstream: endpoint(baseURL), apiKey: apiKey.trim(), auth };
}

function configOf(row, appType) {
  const settings = settingsOf(row);
  if (appType === 'claude') {
    return validateProvider(settings.env?.ANTHROPIC_BASE_URL,
      settings.env?.ANTHROPIC_AUTH_TOKEN || settings.env?.ANTHROPIC_API_KEY, 'anthropic');
  }
  if (appType === 'opencode') {
    const config = validateProvider(settings.options?.baseURL, settings.options?.apiKey, 'bearer');
    if (settings.options?.anthropicBaseURL) {
      config.anthropicUpstream = endpoint(settings.options.anthropicBaseURL);
    } else if (config.upstream.hostname === 'api.deepseek.com' && /^\/(?:v1\/?|)$/.test(config.upstream.pathname)) {
      config.anthropicUpstream = new URL('/anthropic/v1', config.upstream);
    } else {
      config.anthropicUpstream = new URL(config.upstream);
    }
    return { ...config, id: row.id, name: row.name };
  }
  if (appType !== 'codex') throw new Error('Unsupported cc-switch application');
  let parsed;
  try { parsed = parse(settings.config); } catch { throw new Error('cc-switch Codex settings are invalid'); }
  const provider = parsed.model_providers?.[parsed.model_provider];
  return validateProvider(provider?.base_url, settings.auth?.OPENAI_API_KEY, 'bearer');
}

export function loadProvider(appType, providerId, database = DATABASE) {
  const db = openDatabase(database);
  try {
    const rows = providerId
      ? db.prepare('SELECT id, name, settings_config FROM providers WHERE app_type = ? AND id = ?').all(appType, providerId)
      : db.prepare('SELECT id, name, settings_config FROM providers WHERE app_type = ? AND is_current = 1').all(appType);
    if (rows.length !== 1) throw new Error('Exactly one cc-switch provider must be selected');
    return configOf(rows[0], appType);
  } finally { db.close(); }
}

export function acceptsModel(family, id) {
  if (typeof id !== 'string') return false;
  if (family === 'deepseek') return /^deepseek[-/]/i.test(id);
  if (family === 'grok') return /^grok-/i.test(id);
  if (family === 'anthropic') return /^claude-/i.test(id);
  if (family !== 'openai') return false;
  return /^(gpt-\d|o\d)/i.test(id) && !/(?:audio|realtime|transcribe|tts)/i.test(id);
}

function selectedRow(db, family) {
  const key = routeKey(family);
  const saved = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
  const rows = db.prepare('SELECT id, name, settings_config FROM providers WHERE app_type = ?').all('opencode');
  if (saved) {
    const row = rows.find(row => row.id === saved);
    if (!row) throw new Error(`Selected ${family} provider was removed; run cc-switch route ${family}`);
    return row;
  }
  // Existing single-family configurations continue working before a selection is saved.
  const candidates = rows.filter(row => {
    try {
      return Object.keys(settingsOf(row).models || {}).some(id => acceptsModel(family, id));
    } catch { return false; }
  });
  if (candidates.length !== 1) throw new Error(`Select a supplier with cc-switch route ${family}`);
  return candidates[0];
}

export function loadFamilyProvider(family, database = DATABASE) {
  const db = openDatabase(database);
  try { return configOf(selectedRow(db, family), 'opencode'); }
  finally { db.close(); }
}

export function listRouteProviders(family, database = DATABASE) {
  routeKey(family);
  const db = openDatabase(database);
  try {
    let selected;
    try { selected = selectedRow(db, family).id; } catch {}
    return db.prepare('SELECT id, name, settings_config FROM providers WHERE app_type = ? ORDER BY sort_index, created_at, id').all('opencode')
      .map(row => ({ id: row.id, name: row.name, selected: row.id === selected }));
  } finally { db.close(); }
}

export function apiURL(base, path) {
  const url = new URL(base);
  const prefix = url.pathname.replace(/\/+$/, '');
  const versioned = /\/v1$/.test(prefix) ? prefix : `${prefix}/v1`;
  url.pathname = versioned + '/' + path.replace(/^\/?(?:v1\/)?/, '');
  return url;
}

export async function fetchModels(config, family) {
  const url = apiURL(config.upstream, 'models');
  const headers = { accept: 'application/json', authorization: `Bearer ${config.apiKey}` };
  if (config.auth === 'anthropic') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }
  const models = new Map();
  const signal = AbortSignal.timeout(20_000);
  let total = 0;
  for (let page = 0; page < 20; page++) {
    const response = await fetch(url, { headers, signal, redirect: 'error' });
    if (!response.ok) throw new Error(`Model endpoint returned HTTP ${response.status}`);
    const chunks = [];
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > MAX_BYTES) {
        await response.body.cancel().catch(() => {});
        throw new Error('Model response is too large');
      }
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks)); }
    catch { throw new Error('Model endpoint did not return valid JSON'); }
    if (!Array.isArray(body.data)) throw new Error('Model endpoint did not return a data array');
    for (const model of body.data) {
      if (acceptsModel(family, model?.id)) models.set(model.id, model);
    }
    if (!body.has_more) return [...models.values()];
    if (!body.last_id || body.last_id === url.searchParams.get('after_id')) throw new Error('Invalid model pagination');
    url.searchParams.set('after_id', body.last_id);
  }
  throw new Error('Model pagination limit exceeded');
}

export async function selectFamilyProvider(family, providerId, database = DATABASE) {
  const key = routeKey(family);
  const config = loadProvider('opencode', providerId, database);
  const models = await fetchModels(config, family);
  if (!models.length) throw new Error(`Supplier returned no ${family} models; selection was not changed`);
  const db = openDatabase(database, false);
  try {
    db.exec('BEGIN IMMEDIATE');
    const row = db.prepare('SELECT id, name, settings_config FROM providers WHERE app_type = ? AND id = ?').get('opencode', providerId);
    if (!row) throw new Error('Provider was removed during verification');
    const current = configOf(row, 'opencode');
    if (current.upstream.href !== config.upstream.href || current.apiKey !== config.apiKey
      || current.anthropicUpstream.href !== config.anthropicUpstream.href)
      throw new Error('Provider changed during verification; retry the selection');
    db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, providerId);
    db.exec('COMMIT');
    return { id: row.id, name: row.name, models: models.map(model => model.id) };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally { db.close(); }
}
