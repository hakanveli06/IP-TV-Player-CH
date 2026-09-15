#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const child = require('child_process');

const root = path.join(__dirname, '..');
const privateFile = path.join(root, '.private', 'tmdb-token.txt');
const localToken = String(process.env.HM_TMDB_TOKEN ||
  (fs.existsSync(privateFile) ? fs.readFileSync(privateFile, 'utf8') : '')).trim();

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
  if (name === 'tools/audit-public-source.js' || /_Family\.(?:wgt|zip)$/i.test(name)) return;
  const full = path.join(root, name);
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return;
  const data = fs.readFileSync(full);
  if (data.indexOf(0) !== -1) return;
  const text = data.toString('utf8');
  const testFixture = /^tools\/test-/i.test(name.replace(/\\/g, '/'));
  if ((localToken && text.indexOf(localToken) !== -1) || jwt.test(text) || apiKey.test(text) ||
      (!testFixture && fixedAccount.test(text))) {
    suspicious.push(name);
  }
});

if (suspicious.length) {
  throw new Error('Public kaynakta incelenmesi gereken hassas deger benzeri dosyalar: ' + suspicious.join(', '));
}

if (localToken) {
  const revisions = git(['rev-list', '--all']);
  if (revisions.status !== 0) throw new Error('Git gecmisi okunamadi.');
  const commits = revisions.stdout.split(/\r?\n/).filter(Boolean), hits = [];
  for (let i = 0; i < commits.length; i++) {
    const found = git(['grep', '-I', '-l', '-F', localToken, commits[i], '--']);
    if (found.status === 0 && found.stdout.trim()) {
      found.stdout.trim().split(/\r?\n/).forEach(function (line) {
        const colon = line.indexOf(':');
        hits.push(commits[i].slice(0, 12) + ':' + (colon === -1 ? line : line.slice(colon + 1)));
      });
    } else if (found.status !== 0 && found.status !== 1) {
      throw new Error('Git gecmisi sir taramasi tamamlanamadi.');
    }
  }
  if (hits.length) throw new Error('Yerel Family jetonu Git gecmisinde bulundu: ' + hits.join(', '));
}

console.log('PUBLIC_SOURCE_OK files=' + files.length + ' historyExactToken=clean');
console.log('Public kaynak taramasi basarili; hassas degerler yazdirilmadi.');
