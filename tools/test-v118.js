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
const runtimeConfig = read('js/runtime-config.js');

assert(/versionLabel:\s*'H&M\.v2\.0\.0'/.test(app));
assert(app.indexOf("var order = ['auto', 'legacySync', 'standard']") !== -1, 'Uyumluluk ayari uc son kullanici secenegi olmali');
assert(player.indexOf('legacyPause') === -1 && player.indexOf('legacyReload') === -1, 'Deneysel eski-TV yontemleri uretim oynaticisinda kalmamali');
assert(views.indexOf("t('detail.ratings')") !== -1, 'VOD detay dugmesi eksik');
assert(views.indexOf('This product uses the TMDB API but is not endorsed or certified by TMDB.') !== -1, 'TMDb kaynak bildirimi eksik');
assert(views.indexOf('./assets/tmdb-logo.svg') !== -1, 'Onayli TMDb logosu Hakkinda ekraninda olmali');
assert(runtimeConfig.indexOf('tmdbToken') === -1, 'Public runtime yapilandirmasi jeton alani icermemeli');
assert(runtimeConfig.indexOf("buildChannel: 'public-v2'") !== -1, 'Public v2 kanal etiketi eksik');
assert(build.indexOf('privateToken') === -1 && build.indexOf('_Family.wgt') === -1,
  'Public v2 paketleyicisi Family anahtari veya paketi uretmemeli');
assert(build.indexOf("'js/runtime-config.js'") !== -1, 'Runtime yapilandirmasi pakete eklenmeli');
assert(build.indexOf("'js/tmdb.js'") !== -1 && build.indexOf("'assets/tmdb-logo.svg'") !== -1);
console.log('v1.18.0 uretim kapsam testi PASS');
