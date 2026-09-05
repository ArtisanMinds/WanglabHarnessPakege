import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const home = await mkdtemp(join(tmpdir(), 'wanglab-core-smoke-'));
const listener = createServer();
await new Promise((accept, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', accept);
});
const port = listener.address().port;
await new Promise(accept => listener.close(accept));

const child = spawn(process.execPath, [
  resolve('node_modules/@deepseek-ai/dsh/lib/bin.js'),
  '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open',
], {
  env: { ...process.env, DSH_HOME: home },
  detached: process.platform !== 'win32',
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let timer;
const exited = new Promise(accept => child.once('close', accept));

try {
  const url = await new Promise((accept, reject) => {
    timer = setTimeout(() => reject(new Error('Core startup timed out')), 60000);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Core exited before startup: ${code}`)));
    function capture(chunk) {
      output += chunk.toString();
      const match = output.match(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/[^\r\n]*)\r?\n/);
      if (match) accept(match[1]);
    }
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
  });
  clearTimeout(timer);
  let response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 303) {
    assert.equal(response.headers.get('location'), '/');
    const cookie = response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ');
    response = await fetch(new URL('/', url), {
      headers: { cookie },
      signal: AbortSignal.timeout(10000),
    });
  }
  assert.equal(response.status, 200, 'Core web entry must serve successfully');
  assert.match(await response.text(), /<html[\s>]/i);
  console.log('Wanglab Core started and served its web entry successfully');
} catch (error) {
  console.error(output.replace(/([?&]token=)[^\s&]+/g, '$1[REDACTED]'));
  throw error;
} finally {
  clearTimeout(timer);
  if (child.pid && child.exitCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    const force = setTimeout(() => child.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(force);
  }
  await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
