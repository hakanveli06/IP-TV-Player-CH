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
const util = read('js/util.js');
const nav = read('js/nav.js');
const tmdb = read('js/tmdb.js');
const css = read('css/app.css');

assert(/^2\.\d+\.\d+$/.test(pkg.version), 'v2 surum hatti kullanilmali');
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

assert(nav.includes('openIme: function') && nav.includes('closeIme: function'));
assert(nav.includes("this.closeIme('back')"), 'Ilk Geri tusu IME odagini serbest birakmali');
assert(app.includes('choiceDialog: function'), 'Filtre ve ayarlar tam secenek listesi acmali');
assert(app.includes("this.currentCat.category_id === '__all'"), 'VOD aramasi secili buketi tanimali');
assert(app.includes('VodSearchHistory.list(kind)'));

assert(views.includes('Views.settings = function'));
assert(views.includes('settings-search') && app.includes('categories: function'));
assert(views.includes('Views.home = function') && css.includes('.home-screen'));
assert(app.includes("{ id: 'home', ic: 'home'"));
assert(app.includes("AccountData.set('homeLatest', { ts: Date.now(), items: latest })"));

assert(util.includes('var SeriesUpdates ='));
assert(views.includes('episode-new') && views.includes('episode-overview'));
assert(views.includes('loading="lazy"'));
assert(tmdb.includes('season: function') && tmdb.includes('backdrop'));
assert(views.includes('detail-backdrop') && css.includes('.detail-screen'));
assert(!views.includes('İzleme konumunu sıfırla'));

assert(views.includes('live-now') && views.includes('live-row-progress'));
assert(app.includes('daily-now') && css.includes('.daily-now'));
assert(app.includes('seekFeedback') && app.includes('seekVod: function'));
assert(util.includes('toastLastAt') && util.includes('now - this.toastLastAt < 900'));

console.log('v1.24 Family ana ekran, gezinme, detay, EPG ve oynatici deneyimi PASS');
