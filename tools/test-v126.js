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
const util = read('js/util.js');
const css = read('css/app.css');

assert(/^2\.\d+\.\d+$/.test(pkg.version));
assert(config.includes('version="' + pkg.version + '"'));
assert(app.includes("versionLabel: 'H&M.v" + pkg.version + "'"));

assert(util.includes('function searchNorm(s)'));
assert(app.includes('prepareSearchResults: function'));
assert(app.includes('searchAllCategories: function'));
assert(app.includes("Nav.focus('searchAll')"));
assert(app.includes("this.search(this.searchInput ? this.searchInput.value : this.searchQuery)"));
assert(app.includes("merged[i].__searchCategoryLabel"));
assert(views.includes('vod-category-badge'));
assert(views.includes('id="g-search-all"'));
assert(views.includes("id: 'searchAll'"));

assert(views.includes("image.className = 'detail-backdrop-image'"));
assert(views.includes('tryCandidate(index + 1)'));
assert(views.includes('Views.detailLoading'));
assert(css.includes('.detail-backdrop-image'));
assert(css.includes('.detail-seasons .listbox, .detail-episodes .listbox { background:transparent'));
assert(css.includes('.detail-episodes .row.focus'));
assert(!css.includes('.detail-seasons { width:250px; flex:0 0 250px; margin-right:22px; background:rgba(13,24,33,.9); }'));

const vodMarker = app.indexOf('film / dizi durum nesneleri');
const start = app.indexOf('(function () {', vodMarker);
const end = app.indexOf('})();', start);
assert(start >= 0 && end > start);
const sandbox = {
  App: { vod: {} },
  document: { getElementById: () => null },
  searchNorm: value => String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim()
};
vm.createContext(sandbox);
vm.runInContext(app.slice(start, end + 5), sandbox);
const state = sandbox.App.vod.movie;
state.categoryNames = { 10: 'Netflix', 20: 'Apple' };
state.currentCat = { category_id: '__all', category_name: 'Tümü' };
const merged = state.prepareSearchResults([
  { stream_id: 1, name: 'Kaptan', year: 2024, category_id: 10 },
  { stream_id: 2, name: 'Kaptan', year: 2024, category_id: 20 },
  { stream_id: 3, name: 'Kaptan', year: 2023, category_id: 20 }
]);
assert.strictEqual(merged.length, 2);
assert.strictEqual(merged[0].__searchCategoryLabel, 'Netflix + 1 kategori');

let searched = '';
state.cats = { setCurrent: () => {}, items: [] };
state.searchInput = { value: 'kaptan' };
state.searchQuery = 'kaptan';
state.search = value => { searched = value; };
state.activateCategory({ category_id: 20, category_name: 'Apple' }, true);
assert.strictEqual(searched, 'kaptan');
assert.strictEqual(state.currentCat.category_name, 'Apple');

console.log('v1.26.0 sinematik detay ve kapsam-korumali VOD aramasi PASS');
