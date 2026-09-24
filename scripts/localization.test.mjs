import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const personaFiles = [
  'node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml',
  'node_modules/@deepseek-ai/dsh-sdk-app/cordis.patch.yml',
  'node_modules/@deepseek-ai/dsh-headless/cordis.patch.yml',
  'node_modules/@deepseek-ai/dsh-acp-app/cordis.patch.yml',
  'node_modules/@deepseek-ai/dsh-agent-presets/presets/standard/agent.cordis.yml',
  'node_modules/@deepseek-ai/dsh-agent-presets/presets/ptc/agent.cordis.yml',
  'node_modules/@deepseek-ai/dsh-agent-presets/presets/cordis/agent.cordis.yml',
];

test('first-run introduction uses About Us and the English copy in every locale', () => {
  const path = resolve('node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js');
  const before = readFileSync(path, 'utf8');
  const titles = [...before.matchAll(/welcomeTitle: "([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(titles, ['About Us', 'About Us']);
  const bodies = [...before.matchAll(/welcomeBody: "([^"]+)"/g)].map(match => match[1]);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.match(bodies[0], /^Wanglab is affiliated with School of Mechanical Engineering/);
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'apply-wanglab-localization.mjs')]);
  assert.equal(readFileSync(path, 'utf8'), before, 'reapplying localization must preserve the introduction');
});

test('model-facing identity and personas identify Wanglab without claiming a fixed model', () => {
  const systemPrompt = readFileSync(
    resolve('node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js'),
    'utf8',
  );
  assert.match(systemPrompt, /You are an AI coding agent powered by Wanglab Harness\./);
  assert.doesNotMatch(systemPrompt, /You are an AI agent powered by DeepSeek Harness\./);

  for (const file of personaFiles) {
    const source = readFileSync(resolve(file), 'utf8');
    assert.match(source, /You operate through the model provider selected by the user\./, file);
    assert.doesNotMatch(source, /You are a coding agent powered by the \{\{model\}\} model/, file);
    assert.doesNotMatch(source, /deepseek-flash model/, file);
    assert.doesNotMatch(source, /You are a coding agent operating through/, file);
  }
});

test('chat presents the system context source as Wanglab while preserving its durable id', () => {
  const chat = readFileSync(
    resolve('node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js'),
    'utf8',
  );
  assert.match(
    chat,
    /plugin === "@deepseek-ai\/dsh-system-prompt" \? "Wanglab Harness" : plugin \?\? kind/,
  );

  const agentLoop = readFileSync(
    resolve('node_modules/@deepseek-ai/dsh-agent-loop/lib/index.js'),
    'utf8',
  );
  assert.match(agentLoop, /const SOURCE = "@deepseek-ai\/dsh-system-prompt";/);
  assert.equal(
    JSON.parse(readFileSync(resolve('node_modules/@deepseek-ai/dsh-system-prompt/package.json'), 'utf8')).name,
    '@deepseek-ai/dsh-system-prompt',
  );
});

test('all conversation branding patches are idempotent', () => {
  const files = [
    'node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js',
    'node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js',
    ...personaFiles,
  ];
  const before = new Map(files.map(file => [file, readFileSync(resolve(file), 'utf8')]));
  execFileSync(process.execPath, [resolve(import.meta.dirname, 'apply-wanglab-localization.mjs')]);
  for (const file of files) {
    assert.equal(readFileSync(resolve(file), 'utf8'), before.get(file), file);
  }
});
