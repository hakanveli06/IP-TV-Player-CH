#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const child = require('child_process');

const root = path.join(__dirname, '..');

function git(args) {
  return child.spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

const listed = git(['ls-files', '-co', '--exclude-standard']);
if (listed.status !== 0) throw new Error('Git dosya listesi alinamadi.');
const files = listed.stdout.split(/\r?\n/).filter(Boolean);
const suspicious = [];
const jwt = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const apiKey = /\b[a-fA-F0-9]{32}\b/;
const fixedAccount = /\b(?:password|username)\s*[:=]\s*["']([A-Za-z0-9._@-]{3,})["']/i;

files.forEach(function (name) {
  const normalized = name.replace(/\\/g, '/');
  if (normalized === 'tools/audit-public-source.js' || /^worker\/node_modules\//.test(normalized) ||
      /^worker\/(?:\.wrangler|\.wrangler-dry-run)\//.test(normalized) || /^dist\//.test(normalized)) return;
  const full = path.join(root, name);
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return;
  const data = fs.readFileSync(full);
  if (data.indexOf(0) !== -1) return;
  const text = data.toString('utf8');
  const testFixture = /^tools\/test-|^worker\/test\//i.test(normalized);
  if (jwt.test(text) || apiKey.test(text) || (!testFixture && fixedAccount.test(text))) suspicious.push(name);
});

if (suspicious.length) {
  throw new Error('Public kaynakta incelenmesi gereken hassas deger benzeri dosyalar: ' + suspicious.join(', '));
}

console.log('PUBLIC_SOURCE_OK files=' + files.length);
console.log('Public kaynak taramasi basarili; hassas degerler yazdirilmadi.');
