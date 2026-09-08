import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(resolve('package.json'));
assert.equal(process.versions.node.split('.')[0], '22', 'Packaged Core requires Node 22');
assert.equal(process.versions.modules, '127', 'Native modules must use the Node 22 ABI');
assert.equal(typeof require('koffi').load, 'function', 'FFI native module must load');

let fsExtPath;
try {
  fsExtPath = require.resolve('fs-ext');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}
if (fsExtPath) assert.equal(typeof require(fsExtPath).flock, 'function');

const pty = require('node-pty');
const marker = 'WANGLAB_NATIVE_TERMINAL_OK';
const windows = process.platform === 'win32';
const terminal = pty.spawn(windows ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh',
  windows ? ['/d', '/c', `echo ${marker}`] : ['-c', `printf '${marker}\\n'`], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: process.env,
  });

try {
  await new Promise((accept, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error('Native terminal did not finish within 15 seconds'));
    }, 15000);
    terminal.onData(chunk => { output += chunk; });
    terminal.onExit(({ exitCode }) => {
      clearTimeout(timer);
      try {
        assert.equal(exitCode, 0, 'Native shell must exit successfully');
        assert.ok(output.includes(marker), 'Native shell must return its output');
        accept();
      } catch (error) {
        reject(error);
      }
    });
  });
} finally {
  // ConPTY keeps its output worker alive until the terminal is disposed.
  terminal.kill();
}

console.log(`Native modules and terminal passed with Node ${process.versions.node}, ABI ${process.versions.modules}`);
