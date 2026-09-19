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
const nav = read('js/nav.js');
const util = read('js/util.js');
const css = read('css/app.css');

assert(/^2\.\d+\.\d+$/.test(pkg.version));
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

/* Modern, kalici ve Tizen-dostu VOD kontrol katmani. */
assert(app.includes('ensureVodOsd: function'));
assert(app.includes('updateVodOsd: function'));
assert(app.includes('id="vod-modern-osd"'));
assert(app.includes("progress.style.transform = 'scaleX("));
assert(app.includes('vodOsdActionSignature'));
assert(app.includes("{ id: 'play'"));
assert(app.includes("{ id: 'rewind'"));
assert(app.includes("{ id: 'forward'"));
assert(util.includes("play: '<polygon"));
assert(css.includes('.vod-action.round'));
assert(css.includes('.vod-action.focus'));

/* Ayrintilar zaman olayindan korunur; bolumler video uzerinde acilir. */
assert(app.includes("this.vodPanel = 'details'; this.osdOn = true"));
assert(app.includes("this.vodPanel = 'episodes'; this.osdOn = true"));
assert(app.includes('renderEpisodePanel: function'));
assert(app.includes("if (this.vodPanel === 'episodes')"));
assert(css.includes('.vod-episodes-panel'));
assert(app.includes("UI.toast('Bolumun basina donuldu')"));

/* VOD konum cubugu ve kanal tuslariyla sayfalama. */
assert(views.includes('id="g-position"'));
assert(views.includes('updateVodPosition'));
assert(nav.includes('Grid.prototype.positionInfo'));
assert(nav.includes('rowsPerPage'));
assert(nav.includes('KEY.CH_UP'));
assert(nav.includes('KEY.CH_DOWN'));
assert(css.includes('.vod-position'));

console.log('v1.28.0 modern oynatici, bolum paneli ve hizli VOD gezinmesi PASS');
