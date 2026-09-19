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
const css = read('css/app.css');

assert(/^2\.\d+\.\d+$/.test(pkg.version));
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

/* Oynatici icindeki en-boy orani genel ayari degistirmemeli. */
assert(app.includes('var name = Player.setAspect(mode);'));
assert(!app.includes("Player.setAspect(mode, 'aspect')"));
assert(app.includes("meta._sessionAspect || Settings.get('aspect')"));
assert(app.includes('meta._sessionAspect = Player.aspect'));

/* Film/diziye ozel birincil kontroller ve ikincil teknik panel. */
assert(app.includes("{ id: 'previous', label: 'Başa / Önceki'"));
assert(app.includes("{ id: 'next', label: 'Sonraki'"));
assert(app.includes("{ id: 'details', label: 'Ayrıntılar'"));
assert(app.includes('vodToolControls: function'));
assert(app.includes('vodClockHtml: function'));
assert(app.includes('previousEpisodeArmUntil = now + 5000'));
assert(views.includes('flat[fi].__prev'));
assert(views.includes('flat[fi].__next'));

/* Bolum bitisi ve varsayilan otomatik gecis. */
assert(util.includes('nextEpisodeAutoplay: true'));
assert(app.includes("this.nextCountdown = Settings.get('nextEpisodeAutoplay') ? 10 : 0"));
assert(app.includes('showCompletion: function'));
assert(css.includes('.vod-completion-shade'));

/* Kategori gorunurlugu ve Son Izlediklerim icin ayri X odagi. */
assert(views.includes('detail-categories'));
assert(views.includes('vod-list-category'));
assert(views.includes('recent-remove'));
assert(app.includes('confirmRemove: function'));
assert(css.includes('.recent-remove.focus'));

/* Oynaticidan cikmadan acilan sag ayrinti paneli. */
assert(app.includes('openPlayerDetails: function'));
assert(app.includes('playerMode: true'));
assert(css.includes('.tmdb-player-modal'));

console.log('v1.27.0 oturumluk oran, kategori, son izlenenler ve gelismis VOD oynatici PASS');
