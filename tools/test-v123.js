#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const app = read('js/app.js');
const views = read('js/views.js');
const util = read('js/util.js');
const nav = read('js/nav.js');
const css = read('css/app.css');

assert(css.includes('grid-template-columns:repeat(5,224px)'), 'VOD kart gorunumu 5 sutun olmali');
assert(css.includes('.grid.vod-list'), 'VOD liste gorunumu eksik');
assert(views.includes('id="g-view"') && views.includes('id="g-sort"') && views.includes('id="g-filter"'));
assert(views.includes("id: 'search'") && views.includes("id: 'options'"), 'Arama ve secenekler ayri odak bolgeleri olmali');
assert(views.includes("neighbors: { left: 'options', right: 'options', down: 'cats' }"));
assert(views.includes("neighbors: { left: 'search', right: 'search', down: 'grid' }"));
assert(nav.includes('this.screen.onImeClose'), 'TV klavyesinden cikis kancasi eksik');
assert(app.includes("sort: ['provider', 'az', 'za', 'newest', 'oldest', 'ratingDesc', 'ratingAsc']"));
assert(app.includes("pref.sort === 'ratingDesc' || pref.sort === 'ratingAsc'"));
assert(util.includes('var ProviderRating'), 'Saglayici puani normalizasyonu eksik');
assert(views.includes('vod-rating-badge') && views.includes('Sağlayıcı puanı'));
assert(app.includes("filter: ['all', 'continue', 'unwatched', 'completed', 'favorites']"));
assert(util.includes('var VodPrefs') && util.includes('var WatchState') && util.includes('var EpisodeSources'));
assert(nav.includes('Grid.prototype.setLayout'));
assert(views.includes('representative.__candidates = candidates'));
assert(app.includes('tryAlternateEpisodeSource') && app.includes('EpisodeSources.note'));
assert(app.includes('handleVodError') && app.includes('startLocalMp4Fallback'));
assert(app.includes("this.vodPanel = 'next'") && app.includes('nextEpisodeAutoplay'));
assert(app.includes('openSubtitleAppearance') && css.includes('.subtitle-style-panel'));
assert(css.includes('.vod-error-friendly') && !/vod-error-note[^}]*PLAYER_ERROR/.test(css));
assert(app.includes("includeAdultSearch") && app.includes('adultCategoryIds'));

const ratingStart = util.indexOf('var ProviderRating =');
const ratingEnd = util.indexOf('\n};', ratingStart) + 3;
assert(ratingStart !== -1 && ratingEnd > ratingStart, 'Saglayici puani yardimcisi ayrilamadi');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(util.slice(ratingStart, ratingEnd), sandbox);
assert.strictEqual(sandbox.ProviderRating.score({ rating: '8.4', rating_5based: '4.2' }), 8.4);
assert.strictEqual(sandbox.ProviderRating.text({ rating: '8.4' }), '8,4');
assert.strictEqual(sandbox.ProviderRating.score({ rating: '0', rating_5based: '4.5' }), 9);
assert.strictEqual(sandbox.ProviderRating.text({ rating: '0', rating_5based: '4.5' }), '4,5/5');
assert.strictEqual(sandbox.ProviderRating.score({ rating: '0' }), null);

console.log('v1.23 VOD gorunum, siralama, kaynak kurtarma ve altyazi gorunumu PASS');
