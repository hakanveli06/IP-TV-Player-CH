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
const player = read('js/player.js');
const util = read('js/util.js');

assert.strictEqual(pkg.version, '2.0.0');
assert(config.includes('version="2.0.0"'));
assert(app.includes("versionLabel: 'H&M.v2.0.0'"));

const favoritesAt = app.indexOf("{ title: 'Favorileriniz'");
const updatesAt = app.indexOf("{ title: 'Yeni bölümler'");
assert(favoritesAt > 0 && updatesAt > favoritesAt, 'Yeni bolumler Favorileriniz satirinin altinda olmali');
assert(views.includes("index === 1) App.go('favs')"));
assert(views.includes("index === 2) App.go('series')"));

assert(app.includes("title: 'Kataloğu güncelle'"));
assert(app.includes("AccountData.del('homeLatest')"));
assert(!app.includes('ttlFor: function'), 'Acik oturumda sureli katalog yenilemesi eklenmemeli');

assert(app.includes("{ id: 'contentInfo', label: 'İçerik Hakkında' }"));
assert(app.includes('renderVodContentInfo: function'));
assert(app.includes("this.vodPanel = 'content-info'"));
assert(app.includes('this.technicalStatsHtml(stats)'));

assert(app.includes('60 sn kararlilik bekleniyor'));
assert(!app.includes("self.recoveryTimes = [];\n          self.scheduleLiveStableReset()"));
assert(app.includes('On izleme: otomatik yenileme sinirina ulasildi'));
assert(util.includes('function epgStart(program)'));
assert(util.includes('function epgEnd(program)'));
assert(player.includes("self.errorText(err, 'AVPlay hatasi')"));
assert(player.includes('if (fixed.width && fixed.height) this._playbackStaticStats = fixed'));
assert(player.includes('this._playbackStaticStats = null;\n      Diag.set(\'Secili ses\''));

console.log('v1.31.0 ana sayfa, teknik icerik, manuel katalog ve canli TV duzeltmeleri PASS');
