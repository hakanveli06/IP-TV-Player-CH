#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = function (name) { return fs.readFileSync(path.join(root, name), 'utf8'); };
const app = read('js/app.js');
const views = read('js/views.js');
const player = read('js/player.js');
const build = read('tools/build.js');
const privateConfig = read('js/private-config.js');

assert(/versionLabel:\s*'H&M\.v1\.(?:18|19|20|21)\.\d+'/.test(app));
assert(app.indexOf("var order = ['auto', 'legacySync', 'standard']") !== -1, 'Uyumluluk ayari uc son kullanici secenegi olmali');
assert(player.indexOf('legacyPause') === -1 && player.indexOf('legacyReload') === -1, 'Deneysel eski-TV yontemleri uretim oynaticisinda kalmamali');
assert(views.indexOf("t('detail.ratings')") !== -1, 'VOD detay dugmesi eksik');
assert(views.indexOf('This product uses the TMDB API but is not endorsed or certified by TMDB.') !== -1, 'TMDb kaynak bildirimi eksik');
assert(views.indexOf('./assets/tmdb-logo.svg') !== -1, 'Onayli TMDb logosu Hakkinda ekraninda olmali');
assert(privateConfig.indexOf("tmdbToken: ''") !== -1, 'Takip edilen yapilandirma jeton icermemeli');
assert(build.indexOf("collect(false)") !== -1, 'Git arsivi icin WGT sir icermeden uretilmeli');
assert(build.indexOf("familyEntries = collect(true)") !== -1, 'Yerel jeton yalnizca aile paylasim paketine eklenmeli');
assert(build.indexOf(".private', 'tmdb-token.txt") !== -1, 'Yerel jeton Git disindaki dosyadan okunmali');
assert(build.indexOf("'js/tmdb.js'") !== -1 && build.indexOf("'assets/tmdb-logo.svg'") !== -1);
console.log('v1.18.0 uretim kapsam testi PASS');
