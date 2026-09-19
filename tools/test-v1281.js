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
const css = read('css/app.css');

assert(/^2\.\d+\.\d+$/.test(pkg.version));
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

assert(app.includes("label: 'Ses, altyazı ve görüntü'"));
assert(app.includes("group: 'transport'"));
assert(app.includes("group: 'content'"));
assert(app.includes("group: 'utility'"));
assert(app.includes('vod-action-group transport'));
assert(css.includes('.vod-action-group.utility'));
assert(css.includes('.vod-action.utility-action'));

assert(views.includes("if (Nav.zone === grid) grid.page(e.keyCode === KEY.CH_UP ? -1 : 1)"));
assert(nav.includes('Math.ceil(this.height() / this.rowH)'));
assert(nav.includes('this.cols > 1 ? visibleRows'));
assert(!views.includes('KEY.VOL_UP'));
assert(!views.includes('KEY.VOL_DOWN'));

assert(app.includes('}, 6000);'));
assert(css.includes('animation:vod-pause-fade .45s'));
assert(css.includes('@keyframes vod-pause-fade'));

console.log('v1.28.1 kontrol yerlesimi, kanal tusu sayfalama ve gecikmeli duraklatma PASS');
