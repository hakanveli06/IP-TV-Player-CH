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
const css = read('css/app.css');
const client = read('js/servis.js');
const service = read('service/servis.js');

assert.strictEqual(pkg.version, '2.0.0');
assert(config.includes('version="2.0.0"'));
assert(app.includes("versionLabel: 'H&M.v2.0.0'"));

/* Servis 7: bayat adres tazeleme ve CORS (davranis testi: test-servis-tazeleme.js). */
assert(service.includes('var SURUM = 7;'));
assert(client.includes('GEREKEN_SURUM: 7,'), 'TV\'de kalan servis 6 otomatik yenilenmeli');
assert(service.includes("temelBasliklar('video/mp4', res)"), 'Video yanitlari Origin\'i dondurmeli');
assert(!service.includes("temelBasliklar('video/mp4')"), 'res\'siz CORS basligi kalmamali');
assert(service.includes('if (kod !== 206 && !tazelendi) {'));
assert(service.includes('if (e2 && !tazelendi) return tazeleVeTekrar(e2.message);'));
assert(service.includes('if (Date.now() - k.son <= TAZE_MS)'));

/* Tizen 6 surumunde kisisel ithaf rozeti yok. */
assert(!views.includes('about-dedication'), 'Hakkinda rozeti kaldirilmali');
assert(!css.includes('.about-dedication'), 'Rozet stili kaldirilmali');
assert(!views.includes('Ahmet &amp; Aylin'));
assert(views.includes('<div class="about-product">H&amp;M Player</div>'));

/* Tizen 3 ara surumunun izleri ana surumde bulunmaz. */
assert(!/legacyTizen|manualRefresh/.test(app), 'Tizen 3 hafif modu ana surumde olmamali');
assert(!read('tools/build.js').includes('--tizen3'), 'Tizen 3 paketleme modu ana surumde olmamali');
assert(!fs.existsSync(path.join(root, 'tools', 'legacy-tizen.js')));

console.log('v1.32.2 servis tazeleme, CORS ve Tizen 6 temizligi PASS');
