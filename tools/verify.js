#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const child = require('child_process');

const root = path.join(__dirname, '..');
const sources = ['util.js', 'nav.js', 'api.js', 'tx3g.js', 'player.js', 'views.js', 'app.js'];
const tests = ['test.js', 'test-strategy.js', 'test-preflight.js', 'test-accounts.js', 'test-range-discipline.js', 'test-subtitle-recovery.js', 'test-subtitle-ui.js', 'test-preview.js', 'test-final-features.js'];

function run(args) {
  const result = child.spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

sources.forEach(function (name) { run(['--check', path.join('js', name)]); });

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

tests.forEach(function (name) { run([path.join('tools', name)]); });
run([path.join('tools', 'build.js')]);
console.log('Dogrulama, test ve paketleme tamamlandi: v' + configVersion);
