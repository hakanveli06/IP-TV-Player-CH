#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = function (name) { return fs.readFileSync(path.join(root, name), 'utf8'); };
const app = read('js/app.js');
const tmdb = read('js/tmdb.js');
const css = read('css/app.css');

assert(/versionLabel:\s*'H&M\.v2\.0\.0'/.test(app));
assert(tmdb.indexOf("'/watch/providers'") !== -1 || tmdb.indexOf("'/watch/providers") !== -1, 'Türkiye platform sorgusu eksik');
assert(/cast\.length < (?:8|6)/.test(tmdb), 'Oyuncu siniri eksik');
assert(tmdb.indexOf('productionCompanies') !== -1 && tmdb.indexOf('productionCountries') !== -1);
assert(tmdb.indexOf("budget: type === 'movie'") !== -1 && tmdb.indexOf("revenue: type === 'movie'") !== -1);
assert(app.indexOf("t('tmdb.justwatch')") !== -1, 'JustWatch kaynak bildirimi eksik');
assert(app.indexOf("t('tmdb.unknown')") !== -1, 'Bos platform sonucu mesaji eksik');
assert(app.indexOf("t('tmdb.noSummary')") !== -1, 'Ozet yok durumu eksik');
assert(css.indexOf('.tmdb-platforms') !== -1 && css.indexOf('.tmdb-facts') !== -1);
console.log('v1.19.0 TMDb ayrinti kapsam testi PASS');
