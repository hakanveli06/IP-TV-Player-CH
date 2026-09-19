#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const pkg = JSON.parse(read('package.json'));
const config = read('config.xml');
const app = read('js/app.js');
const views = read('js/views.js');

assert.strictEqual(pkg.version, '2.0.0');
assert(config.includes('version="2.0.0"'));
assert(app.includes("versionLabel: 'H&M.v2.0.0'"));

/* Yeni eklenenler: her uygulama acilisinda bir kez yenilenir, sureli onbellek yok. */
assert(app.includes('launchChecked: false,'), 'Acilis bayragi tanimli olmali');
assert(app.includes('if (this.launchChecked && cached && cached.items instanceof Array)'),
  'Onbellek yalnizca bu acilista yenileme yapildiktan sonra kullanilmali');
assert(!app.includes('12 * 60 * 60 * 1000'), 'Yeni eklenenler icin 12 saatlik sure kaldirilmali');
assert(app.includes('self.launchChecked = true;'), 'Basarili yenilemeden sonra bayrak kurulmali');
assert(app.includes('App.home.launchChecked = false;'), 'Kataloğu güncelle bayragi sifirlamali');
assert(app.includes('this.home.launchChecked = false;'), 'Hesap degisiminde bayrak sifirlanmali');
assert(!app.includes('ttlFor: function'), 'Acik oturumda sureli katalog yenilemesi eklenmemeli');

/* Kanal listesi satirindaki EPG ilerlemesi de saat diliminden bagimsiz zaman kullanir. */
assert(views.includes('start = epgStart(current), end = epgEnd(current)'));
assert(!/parseTs\(current\.(start|end)/.test(views), 'Kanal satirinda parseTs kalmamali');

console.log('v1.32.0 acilista katalog yenileme ve kanal satiri EPG saat dilimi PASS');
