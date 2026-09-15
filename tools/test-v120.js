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
  window: { HM_PRIVATE: { tmdbToken: fakeBearer, buildChannel: 'family' } },
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
assert.strictEqual(Tmdb.source(), 'family');
values.tmdbCredential = fakeApiKey;
assert.strictEqual(Tmdb.credential(), values.tmdbCredential, 'Kullanici anahtari Family jetonundan once gelmeli');
assert.strictEqual(Tmdb.source(), 'user');
assert(views.indexOf('Views.tmdbSettings = function') !== -1, 'TMDb ayar ekrani eksik');
assert(views.indexOf("t('common.saveTest')") !== -1 && views.indexOf("t('tmdb.clear')") !== -1);
assert(app.indexOf("versionLabel: 'H&M.v1.21.0'") !== -1);
assert(app.indexOf("'TMDb: ' + Tmdb.sourceLabel()") !== -1);
assert(build.indexOf("_Public.wgt") !== -1 && build.indexOf("_Family.wgt") !== -1);
assert(build.indexOf('Public pakete sizdi') !== -1, 'Public paket sir sizinti denetimi eksik');
console.log('v1.20.0 Public/Family TMDb yapilandirma geriye uyumluluk testi PASS');
