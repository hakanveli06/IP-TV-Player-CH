#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = function (name) { return fs.readFileSync(path.join(root, name), 'utf8'); };
const views = read('js/views.js');
const app = read('js/app.js');
const build = read('tools/build.js');

const values = { tmdbCredential: '' };
const fakeBearer = ['eyJheader', 'payload', 'signature'].join('.');
const fakeApiKey = new Array(33).join('a');
const sandbox = {
  window: { HM_RUNTIME: { tmdbProxyBase: 'https://proxy.example/tmdb/3', buildChannel: 'public-v2' } },
  Settings: { get: function (key) { return values[key] || ''; } },
  Promise: Promise, Date: Date, Math: Math, Number: Number, String: String,
  Store: { get: function (key, fallback) { return fallback; }, set: function () { return true; } },
  AccountData: { get: function (key, fallback) { return fallback; }, set: function () { return true; } },
  norm: function (value) { return String(value || '').toLowerCase(); }
};
vm.createContext(sandbox);
vm.runInContext(read('js/tmdb.js'), sandbox);
const Tmdb = sandbox.Tmdb;

assert.strictEqual(Tmdb.credentialKind(fakeApiKey), 'apiKey');
assert.strictEqual(Tmdb.credentialKind(fakeBearer), 'bearer');
assert.strictEqual(Tmdb.source(), 'proxy');
values.tmdbCredential = fakeApiKey;
assert.strictEqual(Tmdb.credential(), values.tmdbCredential, 'Kullanici anahtari Public proxyden once gelmeli');
assert.strictEqual(Tmdb.source(), 'user');
assert(views.indexOf('Views.tmdbSettings = function') !== -1, 'TMDb ayar ekrani eksik');
assert(views.indexOf("t('common.saveTest')") !== -1 && views.indexOf("t('tmdb.clear')") !== -1);
assert(/versionLabel:\s*'H&M\.v2\.0\.0'/.test(app));
assert(app.indexOf("'TMDb: ' + Tmdb.sourceLabel()") !== -1);
assert(build.indexOf("_Public.wgt") !== -1 && build.indexOf("_Family.wgt") === -1);
assert(build.indexOf("'js/runtime-config.js'") !== -1, 'Public runtime yapilandirmasi pakete eklenmeli');
console.log('v2.0.0 Public proxy ve kisisel TMDb yapilandirma testi PASS');
