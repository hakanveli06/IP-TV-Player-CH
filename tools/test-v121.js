#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = function (name) { return fs.readFileSync(path.join(root, name), 'utf8'); };

const values = { uiLanguage: 'tr', contentRegion: 'TR', tmdbCredential: '' };
const sandbox = {
  navigator: { language: 'de-DE' }, document: { documentElement: {} },
  Settings: { get: function (key) { return values[key]; } },
  window: { HM_PRIVATE: { tmdbToken: '' } }, Promise: Promise, Date: Date, Math: Math,
  Number: Number, String: String,
  Store: { get: function (key, fallback) { return fallback; }, set: function () { return true; }, del: function () {} },
  AccountData: { get: function (key, fallback) { return fallback; }, set: function () { return true; } },
  norm: function (value) { return String(value || '').toLowerCase(); }
};
vm.createContext(sandbox);
vm.runInContext(read('js/i18n.js'), sandbox);
vm.runInContext(read('js/tmdb.js'), sandbox);

assert.strictEqual(sandbox.I18n.selected(), 'tr');
assert.strictEqual(sandbox.I18n.tmdbLocale(), 'tr-TR');
assert.strictEqual(sandbox.I18n.resolvedRegion(), 'TR');
assert.strictEqual(sandbox.I18n.t('tmdb.availableIn', { region: 'Türkiye' }), 'Türkiye bölgesinde izlenebilir');
values.uiLanguage = 'auto'; values.contentRegion = 'auto';
assert.strictEqual(sandbox.I18n.selected(), 'de');
assert.strictEqual(sandbox.I18n.resolvedRegion(), 'DE');
assert.strictEqual(sandbox.Tmdb.localeScope(), 'de-DE:DE');

const views = read('js/views.js'), app = read('js/app.js'), build = read('tools/build.js');
assert(views.indexOf('Views.languageSetup = function') !== -1, 'Ilk kurulum dil ekrani eksik');
assert(views.indexOf('Views.regionSettings = function') !== -1, 'Icerik bolgesi ekrani eksik');
assert(app.indexOf("versionLabel: 'H&M.v1.21.0'") !== -1);
assert(build.indexOf("'js/i18n.js'") !== -1, 'i18n dosyasi pakete eklenmemis');
assert(read('config.xml').indexOf('version="1.21.0"') !== -1);
console.log('v1.21.0 coklu dil, kurulum ve TMDb bolge testi PASS');
