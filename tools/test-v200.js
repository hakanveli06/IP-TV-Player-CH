#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = function (name) { return fs.readFileSync(path.join(root, name), 'utf8'); };
const values = { tmdbCredential: '' };
const calls = [];

function FakeXhr() { this.headers = {}; this.status = 0; this.responseText = ''; }
FakeXhr.prototype.open = function (method, url) { this.method = method; this.url = url; };
FakeXhr.prototype.setRequestHeader = function (key, value) { this.headers[key] = value; };
FakeXhr.prototype.send = function () {
  calls.push({ method: this.method, url: this.url, headers: this.headers });
  this.status = 200;
  this.responseText = '{"ok":true}';
  this.onload();
};

const sandbox = {
  window: { HM_RUNTIME: { tmdbProxyBase: 'https://proxy.example/tmdb/3', buildChannel: 'public-v2' } },
  Settings: { get: function (key) { return values[key] || ''; } },
  XMLHttpRequest: FakeXhr,
  Promise: Promise, Date: Date, Math: Math, Number: Number, String: String,
  Store: { get: function (key, fallback) { return fallback; }, set: function () { return true; }, del: function () {} },
  AccountData: { get: function (key, fallback) { return fallback; }, set: function () { return true; } },
  norm: function (value) { return String(value || '').toLowerCase(); }
};

vm.createContext(sandbox);
vm.runInContext(read('js/tmdb.js'), sandbox);
const Tmdb = sandbox.Tmdb;

(async function () {
  assert.strictEqual(Tmdb.configured(), true);
  assert.strictEqual(Tmdb.source(), 'proxy');
  await Tmdb.request('/configuration', {});
  assert.strictEqual(calls[0].url, 'https://proxy.example/tmdb/3/configuration');
  assert.strictEqual(calls[0].headers.Authorization, undefined);

  values.tmdbCredential = new Array(33).join('a');
  assert.strictEqual(Tmdb.source(), 'user');
  await Tmdb.request('/configuration', {});
  assert(calls[1].url.indexOf('https://api.themoviedb.org/3/configuration?api_key=') === 0);

  const runtime = read('js/runtime-config.js');
  const index = read('index.html');
  const build = read('tools/build.js');
  const worker = read('worker/src/index.js');
  assert(runtime.indexOf('tmdbToken') === -1 && runtime.indexOf('TMDB_READ_TOKEN') === -1);
  assert(index.indexOf('js/runtime-config.js') !== -1 && index.indexOf('private-config.js') === -1);
  assert(build.indexOf('_Family.wgt') === -1 && build.indexOf('privateToken') === -1);
  assert(worker.indexOf('env.TMDB_READ_TOKEN') !== -1);
  assert(worker.indexOf("Authorization: 'Bearer ' + env.TMDB_READ_TOKEN") !== -1);
  console.log('v2.0.0 Public TMDb proxy, kisisel anahtar ve paket guvenligi PASS');
})()['catch'](function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
