#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = function (name) { return fs.readFileSync(path.join(root, name), 'utf8'); };
const app = read('js/app.js');
const tmdb = read('js/tmdb.js');
const views = read('js/views.js');
const css = read('css/app.css');

assert(/versionLabel:\s*'H&M\.v1\.(?:19\.1|20\.0|21\.0)'/.test(app));
assert(tmdb.indexOf('cast.length < 6') !== -1, 'Oyuncu sayisi 6 olmali');
assert(tmdb.indexOf("'https://image.tmdb.org/t/p/w185'") !== -1, 'Oyuncu fotografi adresi eksik');
assert(app.indexOf('tmdb-person-photo') !== -1 && app.indexOf("t('tmdb.cast')") !== -1);
assert(app.indexOf('this.scroll(-390)') !== -1 && app.indexOf('this.scroll(390)') !== -1);
assert(app.indexOf('id="tmdb-scroll"') !== -1 && app.indexOf('tmdb-scroll-thumb') !== -1);
assert(css.indexOf('.tmdb-scrollbar.visible') !== -1 && css.indexOf('.tmdb-cast-cards') !== -1);
assert(app.indexOf('savedSearch: null') !== -1 && app.indexOf('restoreSearchRequested') !== -1);
assert(app.indexOf('items: this.grid.items.slice(0)') !== -1, 'Arama sonucu anlik goruntusu saklanmali');
assert(app.indexOf('this.grid.jumpTo') !== -1, 'Arama odagi geri yuklenmeli');
assert(views.indexOf('state.clearSearchResults()') !== -1, 'Arama listesindeki ikinci Geri aramayi temizlemeli');

const start = app.indexOf('function makeVod(kind) {');
const end = app.indexOf('  App.vod.movie = makeVod', start);
assert(start !== -1 && end !== -1, 'VOD durum fabrikasi bulunamadi');
const nodes = {
  'g-search-state': { textContent: '' },
  'g-title': { textContent: '' },
  'g-count': { textContent: '' }
};
let focused = '';
const sandbox = {
  UI: { spin: function () {}, toast: function () {} },
  Nav: { focus: function (id) { focused = id; } },
  document: { getElementById: function (id) { return nodes[id] || null; } },
  norm: function (value) { return String(value || '').toLowerCase(); },
  Api: {}, clearTimeout: function () {}, setTimeout: setTimeout, Promise: Promise
};
vm.createContext(sandbox);
vm.runInContext(app.slice(start, end) + '\nthis.makeVodForTest = makeVod;', sandbox);
const state = sandbox.makeVodForTest('movie');
const cat = { category_id: '12', category_name: 'Filmler' };
state.currentCat = cat;
state.cats = { index: 3 };
state.grid = { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], index: 2 };
state.searchInput = { value: 'Sugar' };
state.searchQuery = 'sugar';
state.searchBaseIndex = 5;
state.remember();
assert.strictEqual(state.savedSearch.items.length, 3);
assert.strictEqual(state.savedSearch.gridIndex, 2);
state.beginView(true);
assert.strictEqual(state.restoreSearchRequested, true);
assert.strictEqual(state.searchInput.value, 'Sugar');
let restoredItems = null, restoredIndex = -1;
state.currentCat = cat;
state.grid = {
  emptyText: '',
  setItems: function (items) { restoredItems = items; },
  jumpTo: function (index) { restoredIndex = index; }
};
state.restoreSearch();
assert.strictEqual(restoredItems.length, 3);
assert.strictEqual(restoredIndex, 2);
assert.strictEqual(focused, 'grid');
let loadedCat = null;
state._load = function (value) { loadedCat = value; };
state.clearSearchResults();
assert.strictEqual(state.searchQuery, '');
assert.strictEqual(state.searchInput.value, '');
assert.strictEqual(loadedCat, cat);
console.log('v1.19.1 arama geri donusu, kaydirma ve oyuncu kartlari PASS');
