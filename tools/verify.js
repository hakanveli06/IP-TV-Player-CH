#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const child = require('child_process');

const root = path.join(__dirname, '..');
const sources = ['runtime-config.js', 'i18n.js', 'util.js', 'nav.js', 'api.js', 'tmdb.js', 'tx3g.js', 'servis.js', 'player.js', 'views.js', 'app.js'];
const tests = ['test.js', 'test-strategy.js', 'test-preflight.js', 'test-accounts.js', 'test-range-discipline.js', 'test-subtitle-recovery.js', 'test-subtitle-ui.js', 'test-preview.js', 'test-final-features.js', 'test-aspect.js', 'test-v116.js', 'test-v117.js', 'test-v1171.js', 'test-tmdb.js', 'test-v118.js', 'test-v119.js', 'test-v1191.js', 'test-v120.js', 'test-v121.js', 'test-v122.js', 'test-v1228.js', 'test-v123.js', 'test-v124.js', 'test-v125.js', 'test-v126.js', 'test-v127.js', 'test-v128.js', 'test-v1281.js', 'test-v129.js', 'test-v130.js', 'test-v1301.js', 'test-v131.js', 'test-v132.js', 'test-v1321.js', 'test-v1322.js', 'test-v200.js', 'test-servis-tazeleme.js', 'test-tizen6-compat.js'];

function run(args) {
  const result = child.spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

sources.forEach(function (name) { run(['--check', path.join('js', name)]); });
run(['--check', path.join('service', 'servis.js')]);

const forbidden = [
  { re: /\?\./, label: 'optional chaining' },
  { re: /\?\?/, label: 'nullish coalescing' },
  { re: /\.at\s*\(/, label: 'Array.at' },
  { re: /\.flat\s*\(/, label: 'Array.flat' }
];
sources.forEach(function (name) {
  const text = fs.readFileSync(path.join(root, 'js', name), 'utf8');
  forbidden.forEach(function (rule) {
    if (rule.re.test(text)) throw new Error(name + ': Chromium 76 hedefiyle uyumsuz ' + rule.label);
  });
});

const config = fs.readFileSync(path.join(root, 'config.xml'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const configVersion = (config.match(/\bversion="(\d+\.\d+\.\d+)"/) || [])[1];
const labelVersion = (app.match(/versionLabel:\s*'H&M\.v(\d+\.\d+\.\d+)'/) || [])[1];
const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (!configVersion || configVersion !== labelVersion || configVersion !== packageVersion) {
  throw new Error('config.xml, package.json ve uygulama surumu eslesmiyor');
}

/* npm test ile npm run verify ayni testleri calistirmali: yeni bir test
   yalnizca birine eklenirse dogrulama sessizce eksik kalmasin. */
const npmTests = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts.test.match(/tools\/([\w.-]+\.js)/g) || [])
  .map(function (item) { return item.replace('tools/', ''); });
const eksik = npmTests.filter(function (name) { return tests.indexOf(name) === -1; });
const fazla = tests.filter(function (name) { return npmTests.indexOf(name) === -1; });
if (eksik.length || fazla.length) {
  throw new Error('verify.js ve package.json test listeleri farkli. Eksik: ' + (eksik.join(', ') || '-') +
    ' | Fazla: ' + (fazla.join(', ') || '-'));
}
tests.forEach(function (name) { run([path.join('tools', name)]); });
run([path.join('tools', 'build.js')]);
run([path.join('tools', 'audit-packages.js')]);
console.log('Dogrulama, test ve paketleme tamamlandi: v' + configVersion);
