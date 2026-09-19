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
const player = read('js/player.js');
const util = read('js/util.js');
const api = read('js/api.js');
const webService = read('js/servis.js');
const nodeService = read('service/servis.js');

assert(/^2\.\d+\.\d+$/.test(pkg.version));
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

assert(app.includes('if (ms === 0) return;'));
assert(util.includes('home: function (recent, limit)'));
assert(app.includes('var favorites = Favs.home(recent, 6)'));
assert(util.includes("version: 4"));
assert(util.includes('return Math.min(5'));
assert(util.includes('channel.recentStalls.length < 3'));
assert(player.includes("self._emitStall('tampon ilerlemesi durdu')"));
assert(app.includes('2000 : 5000'));
assert(player.includes('this.live && canFallback'));
assert(util.includes('_persistTimer'));
assert(api.includes('pending: {}'));
assert(api.includes('5 * 60 * 1000'));
assert((app.match(/self\.updatePreviewCaption\(\)/g) || []).length >= 2);
assert(webService.includes('PORT: 18631'));
assert(webService.includes("PAKET: 'HV9K26T901'"));
assert(nodeService.includes("var PAKET = 'HV9K26T901'"));
assert(nodeService.includes("hata: 'POST gerekli'"));

console.log('v1.29.0 favoriler, duraklatma ve canli yayin kararliligi PASS');
