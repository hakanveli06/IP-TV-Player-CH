#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const pkg = JSON.parse(read('package.json'));
const config = read('config.xml');
const app = read('js/app.js');
const views = read('js/views.js');
const player = read('js/player.js');
const util = read('js/util.js');
const css = read('css/app.css');
const apiSource = read('js/api.js');

assert(/^2\.\d+\.\d+$/.test(pkg.version));
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

assert(util.includes("startupScreen: 'home'"));
assert(app.includes("['home', 'live', 'movies', 'series']"));
assert(app.includes("title: 'Açılış ekranı'"));

assert(views.includes("layout: 'portrait'") || app.includes("layout: 'portrait'"));
assert(app.includes("layout: 'landscape'"));
assert(css.includes('.home-card.portrait') && css.includes('.home-card.landscape'));

assert(views.includes('providerSeasonMap(info)'));
assert(views.includes('applyBackdropCandidates'));
assert(!views.includes('probe = new Image()'));
assert(views.includes("image.className = 'detail-backdrop-image'"));
assert(views.includes('image.onerror = function'));
assert(!views.includes("layers.join(',')"));
assert(views.includes("if (e.keyCode === KEY.INFO) { App.tmdb.show(kind, item, info); return true; }"));
assert(views.includes("viewImageUrl(provider.movie_image || provider.cover_big || tm.still || '', 'w300')"));
assert(views.includes('state.activateCategory(c, true)'));
assert(app.includes('activateCategory: function'));
assert(app.includes('this.cats.setCurrent(cat.category_id)'));

assert(player.includes('needsSubtitleLabelDiscovery: function'));
assert(app.includes('Altyazi dilleri otomatik olarak belirleniyor'));
assert(app.includes('showPauseCinema: function'));
assert(app.includes('vodIdentityHtml: function'));
assert(css.includes('.vod-pause-cinema') && css.includes('.vod-identity'));

assert(app.includes("VodPrefs.set(leavingKind, 'filter', 'all')"));

const sandbox = {
  Promise, setTimeout, clearTimeout, encodeURIComponent,
  normalizeXtreamServer: value => String(value || ''),
  Settings: { get: () => 'ts' },
  Diag: { add: () => {} }
};
vm.createContext(sandbox);
vm.runInContext(apiSource, sandbox);
const wrapped = { data: { result: { episodes: { '2': [
  { id: 77, episode_num: 3, container_extension: 'mp4' }
] } } } };
assert.strictEqual(sandbox.Api.findEpisodes(wrapped)['2'][0].id, 77);
assert.strictEqual(sandbox.Api.findEpisodes([{ payload: { episodes: [
  { id: 88, episode_number: 1 }
] } }])[0].id, 88);
assert.strictEqual(sandbox.Api.findEpisodes({ seasons: [{ season_number: 1 }] }), null);
assert(apiSource.includes("return this.action('get_series_info', { series_id: id }, 'sinfo:' + id)"));
assert(!apiSource.includes('&hm_refresh='));
assert(util.includes('this.persist();\n    if (this.visible) this.render();'));

console.log('v1.25.3 Family referans VOD akisi ve Tizen 6 ayrinti duzeni PASS');
