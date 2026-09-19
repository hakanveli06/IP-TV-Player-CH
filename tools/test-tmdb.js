#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const storage = {};
const mappings = {};
const sandbox = {
  window: { HM_PRIVATE: { tmdbToken: 'test-token' } },
  I18n: {
    tmdbLocale: function () { return 'tr-TR'; },
    resolvedRegion: function () { return 'TR'; },
    t: function (key) { return ({
      'tmdb.flatrate': 'Abonelik', 'tmdb.free': 'Ücretsiz', 'tmdb.ads': 'Reklamlı',
      'tmdb.rent': 'Kiralama', 'tmdb.buy': 'Satın alma',
      'tmdb.personalActive': 'Kişisel anahtar etkin', 'tmdb.familyActive': 'Family anahtarı etkin',
      'tmdb.unconfigured': 'Yapılandırılmamış'
    })[key] || key; }
  },
  Promise: Promise, Date: Date, Math: Math, Number: Number, String: String,
  Store: {
    get: function (key, fallback) { return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : fallback; },
    set: function (key, value) { storage[key] = value; return true; }
  },
  AccountData: {
    get: function (key, fallback) { return Object.prototype.hasOwnProperty.call(mappings, key) ? mappings[key] : fallback; },
    set: function (key, value) { mappings[key] = value; return true; }
  },
  norm: function (value) {
    return String(value || '').toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
      .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/tmdb.js'), 'utf8'), sandbox);
const Tmdb = sandbox.Tmdb;

assert.strictEqual(Tmdb.cleanTitle('TR DUB | Amerika Batıyor! (2023)'), 'Amerika Batıyor!');
assert.strictEqual(Tmdb.cleanTitle('4K - Sugar S01E03'), 'Sugar');
assert.strictEqual(Tmdb.year({ name: 'CODA (2021)' }, null), 2021);
assert(Tmdb.candidateScore('Sugar', 2024, { name: 'Sugar', first_air_date: '2024-04-04', vote_count: 500 }, 'tv') > 90);

function movie(id, overview) {
  return {
    id: id, title: 'Amerika Batıyor!', original_title: 'America Is Sinking',
    release_date: '2023-12-01', genres: [{ name: 'Aksiyon' }], runtime: 87,
    vote_average: 5.7, vote_count: 121, overview: overview,
    production_companies: [{ name: 'Test Yapım' }], production_countries: [{ name: 'ABD' }],
    budget: 25000000, revenue: 81500000,
    credits: { crew: [{ job: 'Director', name: 'Test Yönetmen' }], cast: [
      { name: 'Oyuncu A', profile_path: '/actor-a.jpg' }, { name: 'Oyuncu B' }, { name: 'Oyuncu C' }, { name: 'Oyuncu D' },
      { name: 'Oyuncu E' }, { name: 'Oyuncu F' }, { name: 'Oyuncu G' }, { name: 'Oyuncu H' },
      { name: 'Oyuncu I' }
    ] },
    external_ids: { imdb_id: 'tt0000001' }, release_dates: { results: [] }
  };
}

(async function () {
  Tmdb.request = function (endpoint, params) {
    if (endpoint === '/movie/1217986' && params.language === 'tr-TR') return Promise.resolve(movie(1217986, 'Türkçe kısa özet.'));
    if (endpoint === '/movie/1217986/watch/providers') return Promise.resolve({ results: { TR: {
      link: 'https://example.invalid',
      flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/netflix.jpg' }],
      rent: [{ provider_id: 2, provider_name: 'Apple TV', logo_path: '/apple.jpg' }]
    } } });
    throw new Error('Beklenmeyen istek: ' + endpoint);
  };
  let result = await Tmdb.lookup('movie', { stream_id: 7, name: 'Amerika Batıyor! (2023)' }, {
    info: { tmdb_id: '1217986', plot: 'Sağlayıcı özeti', rating: '4' }
  });
  assert.strictEqual(result.state, 'found');
  assert.strictEqual(result.data.id, 1217986);
  assert.strictEqual(result.data.overviewTr, 'Türkçe kısa özet.');
  assert.strictEqual(result.data.cast.length, 6);
  assert.strictEqual(result.data.cast[0].name, 'Oyuncu A');
  assert.strictEqual(result.data.cast[0].photo, 'https://image.tmdb.org/t/p/w185/actor-a.jpg');
  assert.strictEqual(result.data.productionCompanies[0], 'Test Yapım');
  assert.strictEqual(result.data.productionCountries[0], 'ABD');
  assert.strictEqual(result.data.budget, 25000000);
  assert.strictEqual(result.data.revenue, 81500000);
  assert.strictEqual(result.data.availability.status, 'available');
  assert.strictEqual(result.data.availability.groups[0].label, 'Abonelik');
  assert.strictEqual(result.data.availability.groups[0].providers[0].name, 'Netflix');
  assert.strictEqual(result.providerScore, '4');
  assert.strictEqual(result.matchSource, 'provider-id');

  Tmdb._cache = null;
  delete storage[Tmdb.cacheKey];
  Tmdb.request = function (endpoint) {
    if (endpoint === '/search/tv') return Promise.resolve({ results: [
      { id: 1, name: 'The Office', original_name: 'The Office', first_air_date: '2005-03-24', vote_count: 1000, overview: 'US' },
      { id: 2, name: 'The Office', original_name: 'The Office', first_air_date: '2001-07-09', vote_count: 1000, overview: 'UK' }
    ] });
    throw new Error('Ayrinti otomatik acilmamali');
  };
  result = await Tmdb.lookup('series', { series_id: 8, name: 'The Office' }, { info: {} });
  assert.strictEqual(result.state, 'candidates');
  assert.strictEqual(result.candidates.length, 2);

  Tmdb._cache = null;
  delete storage[Tmdb.cacheKey];
  Tmdb.request = function (endpoint, params) {
    if (endpoint === '/movie/99' && params.language === 'tr-TR') return Promise.resolve(movie(99, ''));
    if (endpoint === '/movie/99' && params.language === 'en-US') return Promise.resolve({ overview: 'English overview.' });
    if (endpoint === '/movie/99/watch/providers') return Promise.resolve({ results: {} });
    throw new Error('Beklenmeyen istek');
  };
  const detail = await Tmdb.details('movie', 99);
  assert.strictEqual(detail.overviewTr, '');
  assert.strictEqual(detail.overviewEn, 'English overview.');
  assert.strictEqual(detail.availability.status, 'unknown');
  console.log('TMDb eslestirme, ozet ve onbellek testleri PASS');
})()['catch'](function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
