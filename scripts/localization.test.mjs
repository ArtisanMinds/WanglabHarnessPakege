import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

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
