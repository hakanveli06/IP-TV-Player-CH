/* api.js - Xtream Codes istemcisi */
'use strict';

var Api = {
  server: '', user: '', pass: '',
  cache: {},          /* bellek ici onbellek: sadece oturum boyunca */
  info: null,

  normalize: function (s) {
    return normalizeXtreamServer(s);
  },

  configure: function (server, user, pass) {
    this.server = this.normalize(server);
    this.user = String(user || '').trim();
    this.pass = String(pass || '').trim();
    this.cache = {};
  },

  base: function () {
    return this.baseFor(this.server, this.user, this.pass);
  },

  baseFor: function (server, user, pass) {
    return this.normalize(server) + '/player_api.php?username=' +
      encodeURIComponent(String(user || '').trim()) + '&password=' + encodeURIComponent(String(pass || '').trim());
  },

  /* Xtream bazen dizi yerine {} veya "" dondurur; hepsini diziye cevir */
  asArray: function (d) {
    if (!d) return [];
    if (Object.prototype.toString.call(d) === '[object Array]') return d;
    if (typeof d === 'object') {
      var out = [];
      for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) out.push(d[k]);
      return out;
    }
    return [];
  },

  request: function (url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { xhr.abort(); } catch (e) { }
        reject(new Error('Sunucu yanit vermedi (zaman asimi)'));
      }, timeoutMs || 25000);

      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4 || done) return;
        done = true;
        clearTimeout(timer);
        if (xhr.status === 0) { reject(new Error('Sunucuya ulasilamadi. Adresi ve internet baglantisini kontrol edin.')); return; }
        if (xhr.status < 200 || xhr.status >= 300) { reject(new Error('Sunucu hatasi: HTTP ' + xhr.status)); return; }
        var txt = xhr.responseText || '';
        try { resolve(Api.parseJsonResponse(txt)); }
        catch (e) { reject(e); }
      };
      try { xhr.send(); }
      catch (e) { done = true; clearTimeout(timer); reject(new Error('Istek gonderilemedi: ' + e.message)); }
    });
  },

  parseJsonResponse: function (text) {
    var txt = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!txt) return null;
    try { return JSON.parse(txt); }
    catch (e) {
      if (/^\s*</.test(txt)) {
        throw new Error('Sunucu JSON yerine bir web sayfasi dondurdu. Sunucu adresini kontrol edin; panel adresi veya tam M3U baglantisi kullanabilirsiniz.');
      }
      throw new Error('Sunucu beklenmeyen, JSON olmayan bir yanit dondurdu. Lutfen yeniden deneyin.');
    }
  },

  action: function (name, params, cacheKey) {
    var self = this;
    if (cacheKey && this.cache[cacheKey]) return Promise.resolve(this.cache[cacheKey]);
    var url = this.base() + '&action=' + name;
    if (params) {
      for (var k in params) {
        if (params[k] != null && params[k] !== '') url += '&' + k + '=' + encodeURIComponent(params[k]);
      }
    }
    return this.request(url).then(function (d) {
      if (cacheKey) self.cache[cacheKey] = d;
      return d;
    });
  },

  /* --- oturum --- */

  validateCredentials: function (server, user, pass) {
    return this.request(this.baseFor(server, user, pass), 20000).then(function (d) {
      if (!d || !d.user_info) throw new Error('Sunucu gecerli bir Xtream yaniti dondurmedi.');
      if (String(d.user_info.auth) === '0') throw new Error('Kullanici adi veya sifre hatali.');
      if (d.user_info.status && String(d.user_info.status).toLowerCase() !== 'active') {
        throw new Error('Hesap durumu: ' + d.user_info.status);
      }
      return d;
    });
  },

  login: function () {
    var self = this;
    return this.validateCredentials(this.server, this.user, this.pass).then(function (d) {
      self.info = d;
      return d;
    });
  },

  expiry: function () {
    if (!this.info || !this.info.user_info || !this.info.user_info.exp_date) return null;
    return new Date(parseInt(this.info.user_info.exp_date, 10) * 1000);
  },

  /* --- listeler --- */

  liveCategories: function () {
    var self = this;
    return this.action('get_live_categories', null, 'lcat').then(function (d) { return self.asArray(d); });
  },
  liveStreams: function (catId) {
    var self = this;
    return this.action('get_live_streams', { category_id: catId }, 'lst:' + catId)
      .then(function (d) { return self.asArray(d); });
  },
  vodCategories: function () {
    var self = this;
    return this.action('get_vod_categories', null, 'vcat').then(function (d) { return self.asArray(d); });
  },
  vodStreams: function (catId) {
    var self = this;
    return this.action('get_vod_streams', { category_id: catId }, 'vst:' + catId)
      .then(function (d) { return self.asArray(d); });
  },
  seriesCategories: function () {
    var self = this;
    return this.action('get_series_categories', null, 'scat').then(function (d) { return self.asArray(d); });
  },
  seriesList: function (catId) {
    var self = this;
    return this.action('get_series', { category_id: catId }, 'sls:' + catId)
      .then(function (d) { return self.asArray(d); });
  },
  seriesInfo: function (id) {
    return this.action('get_series_info', { series_id: id }, 'sinfo:' + id);
  },
  vodInfo: function (id) {
    return this.action('get_vod_info', { vod_id: id }, 'vinfo:' + id);
  },
  shortEpg: function (streamId, limit) {
    var self = this;
    return this.action('get_short_epg', { stream_id: streamId, limit: limit || 3 })
      .then(function (d) { return self.asArray(d && d.epg_listings ? d.epg_listings : d); });
  },

  /* --- akis adresleri --- */

  liveUrl: function (id, format) {
    var fmt = format || Settings.get('liveFormat') || 'ts';
    return this.server + '/live/' + encodeURIComponent(this.user) + '/' +
      encodeURIComponent(this.pass) + '/' + id + '.' + fmt;
  },
  liveCandidates: function (id) {
    var preferred = Settings.get('liveFormat') || 'ts';
    var alternate = preferred === 'ts' ? 'm3u8' : 'ts';
    return [
      { format: preferred, url: this.liveUrl(id, preferred) },
      { format: alternate, url: this.liveUrl(id, alternate) }
    ];
  },
  movieUrl: function (id, ext) {
    return this.server + '/movie/' + encodeURIComponent(this.user) + '/' +
      encodeURIComponent(this.pass) + '/' + id + '.' + (ext || 'mp4');
  },
  episodeUrl: function (id, ext) {
    return this.server + '/series/' + encodeURIComponent(this.user) + '/' +
      encodeURIComponent(this.pass) + '/' + id + '.' + (ext || 'mp4');
  }
};
