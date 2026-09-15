'use strict';

/* TMDb ayrintilari IPTV medya baglantisindan tamamen bagimsizdir. Sorgular
   yalnizca kullanici "Puanlar ve ayrintilar" dugmesine bastiginda yapilir. */
var Tmdb = {
  base: 'https://api.themoviedb.org/3',
  cacheKey: 'tmdb.cache.v4',
  cacheMax: 180,
  successTtl: 30 * 24 * 60 * 60 * 1000,
  platformTtl: 24 * 60 * 60 * 1000,
  missTtl: 24 * 60 * 60 * 1000,
  _cache: null,

  locale: function () { return typeof I18n !== 'undefined' ? I18n.tmdbLocale() : 'en-US'; },
  region: function () { return typeof I18n !== 'undefined' ? I18n.resolvedRegion() : 'US'; },
  text: function (key, fallback) { return typeof I18n !== 'undefined' ? I18n.t(key) : fallback; },
  localeScope: function () { return this.locale() + ':' + this.region(); },
  clearLocaleCache: function () {
    this._cache = null;
    try { Store.del(this.cacheKey); } catch (e) { }
  },

  normalizeCredential: function (value) { return String(value || '').replace(/^\s+|\s+$/g, ''); },
  credentialKind: function (value) {
    value = this.normalizeCredential(value);
    if (/^[a-f0-9]{32}$/i.test(value)) return 'apiKey';
    if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return 'bearer';
    return '';
  },
  embeddedToken: function () {
    try { return this.normalizeCredential((window.HM_PRIVATE && window.HM_PRIVATE.tmdbToken) || ''); }
    catch (e) { return ''; }
  },
  userCredential: function () {
    try { return this.normalizeCredential(typeof Settings !== 'undefined' ? Settings.get('tmdbCredential') : ''); }
    catch (e) { return ''; }
  },
  credential: function () { return this.userCredential() || this.embeddedToken(); },
  configured: function () { return !!this.credentialKind(this.credential()); },
  source: function () {
    if (this.userCredential()) return 'user';
    if (this.embeddedToken()) return 'family';
    return 'none';
  },
  sourceLabel: function () {
    var source = this.source();
    return source === 'user' ? this.text('tmdb.personalActive', 'Kişisel anahtar etkin') :
      (source === 'family' ? this.text('tmdb.familyActive', 'Family anahtarı etkin') :
        this.text('tmdb.unconfigured', 'Yapılandırılmamış'));
  },
  masked: function (value) {
    value = this.normalizeCredential(value);
    if (!value) return '';
    if (value.length <= 10) return '••••••••';
    return value.slice(0, 4) + '••••••••' + value.slice(-4);
  },

  requestWithCredential: function (path, params, credential) {
    var self = this;
    return new Promise(function (resolve, reject) {
      credential = self.normalizeCredential(credential);
      var credentialKind = self.credentialKind(credential);
      if (!credentialKind) {
        reject(new Error('TMDb hizmeti bu pakette yapilandirilmamis.'));
        return;
      }
      var query = [], key;
      params = params || {};
      for (key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null && params[key] !== '') {
          query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
      }
      if (credentialKind === 'apiKey') query.push('api_key=' + encodeURIComponent(credential));
      var xhr = new XMLHttpRequest();
      xhr.open('GET', self.base + path + (query.length ? '?' + query.join('&') : ''), true);
      xhr.timeout = 18000;
      if (credentialKind === 'bearer') xhr.setRequestHeader('Authorization', 'Bearer ' + credential);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.onload = function () {
        var data = null;
        try { data = JSON.parse(xhr.responseText || '{}'); } catch (e) { }
        if (xhr.status >= 200 && xhr.status < 300 && data) { resolve(data); return; }
        if (xhr.status === 401 || xhr.status === 403) reject(new Error('TMDb yetkilendirmesi kabul edilmedi.'));
        else if (xhr.status === 404) reject(new Error('TMDb kaydi bulunamadi.'));
        else reject(new Error('TMDb bilgisi su anda alinamadi.'));
      };
      xhr.onerror = function () { reject(new Error('TMDb baglantisi kurulamadi.')); };
      xhr.ontimeout = function () { reject(new Error('TMDb istegi zaman asimina ugradi.')); };
      xhr.send();
    });
  },
  request: function (path, params) { return this.requestWithCredential(path, params, this.credential()); },
  testCredential: function (value) {
    value = this.normalizeCredential(value || this.credential());
    if (!this.credentialKind(value)) {
      return Promise.reject(new Error('32 karakterli TMDb API anahtarı veya API okuma erişim jetonu girin.'));
    }
    return this.requestWithCredential('/configuration', {}, value).then(function () { return true; });
  },

  loadCache: function () {
    if (this._cache) return this._cache;
    var data = Store.get(this.cacheKey, null);
    if (!data || data.version !== 4 || !data.items || !(data.order instanceof Array)) {
      data = { version: 4, items: {}, order: [] };
    }
    this._cache = data;
    return data;
  },
  cacheGet: function (key) {
    var data = this.loadCache(), row = data.items[key];
    if (!row) return null;
    if (!row.expires || row.expires <= Date.now()) {
      delete data.items[key];
      var old = data.order.indexOf(key);
      if (old !== -1) data.order.splice(old, 1);
      Store.set(this.cacheKey, data);
      return null;
    }
    var at = data.order.indexOf(key);
    if (at !== -1) data.order.splice(at, 1);
    data.order.push(key);
    return row.value;
  },
  cachePut: function (key, value, ttl) {
    var data = this.loadCache(), at = data.order.indexOf(key);
    if (at !== -1) data.order.splice(at, 1);
    data.items[key] = { expires: Date.now() + ttl, value: value };
    data.order.push(key);
    while (data.order.length > this.cacheMax) delete data.items[data.order.shift()];
    if (!Store.set(this.cacheKey, data)) {
      while (data.order.length > 100) delete data.items[data.order.shift()];
      Store.set(this.cacheKey, data);
    }
  },

  title: function (item) { return String((item && (item.name || item.title)) || '').trim(); },
  cleanTitle: function (value) {
    value = String(value || '')
      .replace(/^\s*(?:TR\s*(?:DUB|DUBLAJ)?|TURKCE|4K|UHD|HD|YENI|NETFLIX|APPLE\s*TV)\s*[|:\-]+\s*/i, '')
      .replace(/\bS\d{1,2}\s*E\d{1,3}\b/ig, ' ')
      .replace(/\((?:19|20)\d{2}\)/g, ' ')
      .replace(/\[(?:19|20)\d{2}\]/g, ' ')
      .replace(/\b(?:19|20)\d{2}\b\s*$/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return value;
  },
  year: function (item, info) {
    var meta = (info && (info.info || info)) || {};
    var values = [meta.releaseDate, meta.releasedate, meta.first_air_date, meta.year,
      item && item.year, item && item.releaseDate, this.title(item)];
    for (var i = 0; i < values.length; i++) {
      var m = String(values[i] || '').match(/\b(19|20)\d{2}\b/);
      if (m) return parseInt(m[0], 10);
    }
    return 0;
  },
  normal: function (value) {
    try { return norm(String(value || '')).replace(/[^a-z0-9]+/g, ' ').trim(); }
    catch (e) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  },
  titleScore: function (query, candidate) {
    var a = this.normal(query), b = this.normal(candidate);
    if (!a || !b) return 0;
    if (a === b) return 72;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 48;
    var aa = a.split(' '), bb = b.split(' '), hit = 0;
    for (var i = 0; i < aa.length; i++) if (bb.indexOf(aa[i]) !== -1) hit++;
    return Math.round(40 * hit / Math.max(aa.length, bb.length));
  },
  candidateYear: function (row, type) {
    var value = type === 'movie' ? row.release_date : row.first_air_date;
    var m = String(value || '').match(/^(\d{4})/);
    return m ? parseInt(m[1], 10) : 0;
  },
  candidateScore: function (query, year, row, type) {
    var score = Math.max(this.titleScore(query, row.title || row.name),
      this.titleScore(query, row.original_title || row.original_name));
    var cy = this.candidateYear(row, type);
    if (year && cy === year) score += 25;
    else if (year && cy && Math.abs(cy - year) === 1) score += 12;
    else if (year && cy && Math.abs(cy - year) > 1) score -= 18;
    if (+row.vote_count > 30) score += 3;
    return score;
  },

  providerMeta: function (item, info) {
    var meta = (info && (info.info || info)) || {};
    var movie = (info && info.movie_data) || {};
    return {
      plot: String(meta.plot || meta.description || (item && item.description) || ''),
      score: meta.rating || meta.rating_5based || (item && item.rating) || (item && item.rating_5based) || '',
      tmdbId: String(meta.tmdb_id || meta.tmdb || movie.tmdb_id || movie.tmdb || (item && item.tmdb_id) || (item && item.tmdb) || '').replace(/\D/g, '')
    };
  },
  mappingKey: function (kind, item) {
    return kind + ':' + String(kind === 'movie' ? item.stream_id : item.series_id);
  },
  loadMappings: function () {
    var data = AccountData.get('tmdbMap', null);
    if (!data || data.version !== 1 || !data.items || !(data.order instanceof Array)) {
      data = { version: 1, items: {}, order: [] };
    }
    return data;
  },
  mappingGet: function (kind, item, query, year) {
    var data = this.loadMappings(), key = this.mappingKey(kind, item), row = data.items[key];
    if (!row || row.title !== this.normal(query) || (year && row.year && row.year !== year)) return 0;
    return +row.tmdbId || 0;
  },
  mappingPut: function (kind, item, query, year, tmdbId) {
    var data = this.loadMappings(), key = this.mappingKey(kind, item), at = data.order.indexOf(key);
    if (at !== -1) data.order.splice(at, 1);
    data.items[key] = { title: this.normal(query), year: year || 0, tmdbId: +tmdbId, ts: Date.now() };
    data.order.push(key);
    while (data.order.length > 240) delete data.items[data.order.shift()];
    AccountData.set('tmdbMap', data);
  },

  certification: function (data, type) {
    var rows, i, j, value = '', region = this.region();
    if (type === 'movie') {
      rows = (data.release_dates && data.release_dates.results) || [];
      for (i = 0; i < rows.length; i++) if (rows[i].iso_3166_1 === region) {
        for (j = 0; j < rows[i].release_dates.length; j++) {
          value = rows[i].release_dates[j].certification;
          if (value) return value;
        }
      }
      for (i = 0; i < rows.length; i++) if (rows[i].iso_3166_1 === 'US') {
        for (j = 0; j < rows[i].release_dates.length; j++) {
          value = rows[i].release_dates[j].certification;
          if (value) return value;
        }
      }
    } else {
      rows = (data.content_ratings && data.content_ratings.results) || [];
      for (i = 0; i < rows.length; i++) if (rows[i].iso_3166_1 === region && rows[i].rating) return rows[i].rating;
      for (i = 0; i < rows.length; i++) if (rows[i].iso_3166_1 === 'US' && rows[i].rating) return rows[i].rating;
    }
    return '';
  },
  compact: function (data, type, overviewEn, locale) {
    var crew = (data.credits && data.credits.crew) || [], director = [];
    for (var i = 0; i < crew.length && director.length < 3; i++) {
      if (crew[i].job === 'Director') director.push(crew[i].name);
    }
    var creators = [], created = data.created_by || [];
    for (i = 0; i < created.length && creators.length < 3; i++) creators.push(created[i].name);
    var cast = [], people = (data.credits && data.credits.cast) || [];
    for (i = 0; i < people.length && cast.length < 6; i++) {
      cast.push({
        name: people[i].name || '',
        photo: people[i].profile_path ? 'https://image.tmdb.org/t/p/w185' + people[i].profile_path : ''
      });
    }
    var genres = [];
    for (i = 0; i < (data.genres || []).length; i++) genres.push(data.genres[i].name);
    var companies = [];
    for (i = 0; i < (data.production_companies || []).length && companies.length < 3; i++) {
      if (data.production_companies[i].name) companies.push(data.production_companies[i].name);
    }
    var countries = [];
    for (i = 0; i < (data.production_countries || []).length && countries.length < 3; i++) {
      if (data.production_countries[i].name) countries.push(data.production_countries[i].name);
    }
    if (!countries.length) {
      for (i = 0; i < (data.origin_country || []).length && countries.length < 3; i++) {
        if (data.origin_country[i]) countries.push(data.origin_country[i]);
      }
    }
    return {
      id: +data.id, type: type,
      title: data.title || data.name || '',
      originalTitle: data.original_title || data.original_name || '',
      year: this.candidateYear(data, type), genres: genres,
      runtime: type === 'movie' ? (+data.runtime || 0) : (+((data.episode_run_time || [])[0]) || 0),
      seasons: type === 'tv' ? (+data.number_of_seasons || 0) : 0,
      voteAverage: +data.vote_average || 0, voteCount: +data.vote_count || 0,
      overviewLocalized: data.overview || '', overviewEn: overviewEn || '', overviewLocale: locale || this.locale(),
      /* Eski arayuz/testlerle geriye uyumluluk. */
      overviewTr: data.overview || '',
      ageRating: this.certification(data, type),
      directors: type === 'movie' ? director : creators,
      productionCompanies: companies, productionCountries: countries,
      budget: type === 'movie' ? (+data.budget || 0) : 0,
      revenue: type === 'movie' ? (+data.revenue || 0) : 0,
      cast: cast, imdbId: (data.external_ids && data.external_ids.imdb_id) || data.imdb_id || '',
      poster: data.poster_path ? 'https://image.tmdb.org/t/p/w342' + data.poster_path : ''
    };
  },
  details: function (type, id) {
    var self = this, locale = this.locale(), key = 'details:' + this.localeScope() + ':' + type + ':' + id, cached = this.cacheGet(key);
    var metadata;
    if (cached) metadata = Promise.resolve(cached);
    else {
      var append = type === 'movie' ? 'credits,external_ids,release_dates' : 'credits,external_ids,content_ratings';
      metadata = this.request('/' + type + '/' + id, { language: locale, append_to_response: append }).then(function (localized) {
        if (localized.overview || locale === 'en-US') return self.compact(localized, type, '', locale);
        return self.request('/' + type + '/' + id, { language: 'en-US' }).then(function (en) {
          return self.compact(localized, type, en.overview || '', locale);
        })['catch'](function () { return self.compact(localized, type, '', locale); });
      }).then(function (result) {
        self.cachePut(key, result, self.successTtl);
        return result;
      });
    }
    return metadata.then(function (result) {
      return self.watchProviders(type, id).then(function (availability) {
        result.availability = availability;
        return result;
      })['catch'](function () {
        result.availability = { status: 'error', groups: [] };
        return result;
      });
    });
  },

  watchProviders: function (type, id) {
    var self = this, region = this.region(), key = 'platforms:' + region + ':' + this.locale() + ':' + type + ':' + id, cached = this.cacheGet(key);
    if (cached) return Promise.resolve(cached);
    return this.request('/' + type + '/' + id + '/watch/providers').then(function (response) {
      var regionData = response && response.results && response.results[region];
      if (!regionData) {
        var missing = { status: 'unknown', groups: [], region: region };
        self.cachePut(key, missing, self.platformTtl);
        return missing;
      }
      var definitions = [
        { key: 'flatrate', label: self.text('tmdb.flatrate', 'Abonelik') },
        { key: 'free', label: self.text('tmdb.free', 'Ücretsiz') },
        { key: 'ads', label: self.text('tmdb.ads', 'Reklamlı') },
        { key: 'rent', label: self.text('tmdb.rent', 'Kiralama') },
        { key: 'buy', label: self.text('tmdb.buy', 'Satın alma') }
      ];
      var groups = [];
      for (var i = 0; i < definitions.length; i++) {
        var rows = regionData[definitions[i].key] || [], providers = [], seen = {};
        for (var j = 0; j < rows.length; j++) {
          var providerId = String(rows[j].provider_id || rows[j].provider_name || '');
          if (!providerId || seen[providerId]) continue;
          seen[providerId] = true;
          providers.push({
            name: rows[j].provider_name || '',
            logo: rows[j].logo_path ? 'https://image.tmdb.org/t/p/w45' + rows[j].logo_path : ''
          });
        }
        if (providers.length) groups.push({ label: definitions[i].label, providers: providers });
      }
      var result = { status: groups.length ? 'available' : 'none', groups: groups, link: regionData.link || '', region: region };
      self.cachePut(key, result, self.platformTtl);
      return result;
    });
  },
  validateDirect: function (data, query, year) {
    if (year && data.year && Math.abs(data.year - year) > 1) return false;
    if (year && data.year) return true;
    return Math.max(this.titleScore(query, data.title), this.titleScore(query, data.originalTitle)) >= 40;
  },
  search: function (type, query, year) {
    var self = this, key = 'search:' + this.locale() + ':' + type + ':' + this.normal(query) + ':' + (year || 0);
    var cached = this.cacheGet(key);
    if (cached) return Promise.resolve(cached);
    var params = { language: this.locale(), query: query, include_adult: 'false' };
    if (year) params[type === 'movie' ? 'year' : 'first_air_date_year'] = year;
    return this.request('/search/' + type, params).then(function (res) {
      var rows = (res.results || []).slice(0, 20), ranked = [];
      for (var i = 0; i < rows.length; i++) {
        var score = self.candidateScore(query, year, rows[i], type);
        if (score >= 38) ranked.push({
          id: +rows[i].id, type: type, score: score,
          title: rows[i].title || rows[i].name || '',
          originalTitle: rows[i].original_title || rows[i].original_name || '',
          year: self.candidateYear(rows[i], type),
          overview: rows[i].overview || '',
          poster: rows[i].poster_path ? 'https://image.tmdb.org/t/p/w185' + rows[i].poster_path : ''
        });
      }
      ranked.sort(function (a, b) { return b.score - a.score; });
      ranked = ranked.slice(0, 3);
      self.cachePut(key, ranked, ranked.length ? self.successTtl : self.missTtl);
      return ranked;
    });
  },
  resolveById: function (kind, item, query, year, id, source) {
    var self = this, type = kind === 'movie' ? 'movie' : 'tv';
    return this.details(type, id).then(function (data) {
      if (!self.validateDirect(data, query, year)) return null;
      self.mappingPut(kind, item, query, year, data.id);
      return { state: 'found', data: data, matchSource: source };
    })['catch'](function () { return null; });
  },
  lookup: function (kind, item, info) {
    var self = this, type = kind === 'movie' ? 'movie' : 'tv';
    var query = this.cleanTitle(this.title(item)), year = this.year(item, info), provider = this.providerMeta(item, info);
    var mapped = this.mappingGet(kind, item, query, year);
    function withProvider(result) {
      if (!result) return null;
      result.providerPlot = provider.plot;
      result.providerScore = provider.score;
      result.query = query;
      result.year = year;
      return result;
    }
    function doSearch() {
      return self.search(type, query, year).then(function (rows) {
        if (!rows.length) return withProvider({ state: 'notfound' });
        if (rows[0].score >= 76 && (!rows[1] || rows[0].score - rows[1].score >= 12)) {
          return self.resolveById(kind, item, query, year, rows[0].id, 'search').then(function (found) {
            return withProvider(found || { state: 'notfound' });
          });
        }
        return withProvider({ state: 'candidates', candidates: rows, kind: kind, item: item });
      });
    }
    if (mapped) return this.resolveById(kind, item, query, year, mapped, 'cache').then(function (found) { return found ? withProvider(found) : doSearch(); });
    if (provider.tmdbId) return this.resolveById(kind, item, query, year, provider.tmdbId, 'provider-id').then(function (found) { return found ? withProvider(found) : doSearch(); });
    return doSearch();
  },
  choose: function (context, candidate) {
    var self = this;
    return this.details(candidate.type, candidate.id).then(function (data) {
      self.mappingPut(context.kind, context.item, context.query, context.year, data.id);
      return {
        state: 'found', data: data, matchSource: 'manual',
        providerPlot: context.providerPlot, providerScore: context.providerScore,
        query: context.query, year: context.year
      };
    });
  }
};
