/* util.js - ortak yardimcilar, ayar deposu, teshis katmani */
'use strict';

/* --- Chromium 76 icin eksik API'ler --- */
(function () {
  function def(obj, name, fn) {
    if (!obj[name]) {
      try { Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); }
      catch (e) { obj[name] = fn; }
    }
  }
  def(String.prototype, 'replaceAll', function (s, r) {
    var esc = String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.replace(new RegExp(esc, 'g'), r);
  });
  def(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
})();

var KEY = {
  LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40,
  ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8,
  PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413,
  FF: 417, RW: 412, INFO: 457,
  CH_UP: 427, CH_DOWN: 428,
  RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406,
  N0: 48, N9: 57
};

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
};

function el(tag, cls, html) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* SamsungOne bazi Unicode sembollerini cizgili kutu olarak gosterebiliyor.
   Arayuz simgeleri font glifine bagli kalmadan basit SVG ile cizilir. */
function uiIcon(name, cls) {
  var paths = {
    live: '<polygon points="9,6 20,12 9,18"></polygon>',
    movies: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><line x1="8" y1="5" x2="8" y2="19"></line><line x1="16" y1="5" x2="16" y2="19"></line>',
    series: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line>',
    favs: '<path d="M12 3.5l2.7 5.45 6.02.88-4.36 4.24 1.03 5.99L12 17.23l-5.39 2.83 1.03-5.99-4.36-4.24 6.02-.88z"></path>',
    recent: '<path d="M4.2 8.5A8.2 8.2 0 1 1 4 14"></path><polyline points="4,4 4,9 9,9"></polyline><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="13" x2="15.5" y2="15"></line>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6H3A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.38.35.72.6 1 .28.27.63.4 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6.6z"></path>',
    about: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="10.5" x2="12" y2="17"></line><circle cx="12" cy="7" r=".8" class="solid"></circle>',
    account: '<circle cx="12" cy="8" r="4"></circle><path d="M4.5 21c.6-4.2 3-6.5 7.5-6.5s6.9 2.3 7.5 6.5"></path>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="15.5" y1="15.5" x2="21" y2="21"></line>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"></path><circle cx="12" cy="12" r="2.7"></circle>',
    eyeoff: '<path d="M3 3l18 18"></path><path d="M9.5 6.4A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.7M6.2 7.1A17.5 17.5 0 0 0 2.5 12s3.5 6 9.5 6a10 10 0 0 0 2.5-.3"></path>'
  };
  return '<svg class="ui-icon ' + esc(cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
    (paths[name] || paths.about) + '</svg>';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Sunucu alanina yalnizca panel kok adresi yerine tam Xtream/M3U adresi de
   yapistirilabilir. Bilinen endpoint ve medya yollarini guvenle ayikla;
   panelin gercek bir alt dizinde calistigi kurulumlarda alt dizini koru. */
function normalizeXtreamServer(value) {
  var s = String(value || '').trim();
  if (!s) return '';
  if ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
      (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")) {
    s = s.slice(1, -1).trim();
  }
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;

  var endpointAt = s.search(/\/(?:player_api|get|xmltv)\.php(?:[\/?#]|$)/i);
  var mediaAt = s.search(/\/(?:live|movie|series)(?:\/|$)/i);
  var cutAt = -1;
  if (endpointAt >= 0 && mediaAt >= 0) cutAt = Math.min(endpointAt, mediaAt);
  else cutAt = endpointAt >= 0 ? endpointAt : mediaAt;
  if (cutAt >= 0) s = s.slice(0, cutAt);
  else {
    var suffixAt = s.search(/[?#]/);
    if (suffixAt >= 0) s = s.slice(0, suffixAt);
  }
  return s.replace(/\/+$/, '');
}

/* Turkce harfleri de sadelestiren arama normalizasyonu */
function norm(s) {
  s = String(s == null ? '' : s).toLowerCase();
  /* GÜN, GUN ve gün ayni arama sonucunu vermeli. */
  try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { }
  var map = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
  var out = '';
  for (var i = 0; i < s.length; i++) out += (map[s[i]] || s[i]);
  return out;
}

/* Zorunlu olmayan Samsung kumanda tuslari kaydedilmeden keydown uretmez. */
function registerRemoteKeys() {
  try {
    if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;

    var keyMap = {
      ChannelUp: 'CH_UP', ChannelDown: 'CH_DOWN', Info: 'INFO',
      MediaPlay: 'PLAY', MediaPause: 'PAUSE', MediaPlayPause: 'PLAYPAUSE',
      MediaStop: 'STOP', MediaFastForward: 'FF', MediaRewind: 'RW',
      ColorF0Red: 'RED', ColorF1Green: 'GREEN',
      ColorF2Yellow: 'YELLOW', ColorF3Blue: 'BLUE'
    };
    var names = Object.keys(keyMap);
    for (var n = 0; n <= 9; n++) names.push(String(n));

    /* Cihazin bildirdigi keyCode degerlerini tercih et. */
    try {
      var supported = tizen.tvinputdevice.getSupportedKeys();
      for (var i = 0; i < supported.length; i++) {
        if (keyMap[supported[i].name]) KEY[keyMap[supported[i].name]] = supported[i].code;
      }
    } catch (e) { }

    /* Tek tek kayit: bir tus desteklenmiyorsa diger kayitlar etkilenmesin. */
    for (var j = 0; j < names.length; j++) {
      try { tizen.tvinputdevice.registerKey(names[j]); } catch (e) { }
    }
  } catch (e) {
    Diag.add('Kumanda tuslari kaydedilemedi: ' + e.message);
  }
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function hhmm(d) {
  if (!d) return '';
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function mmss(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0 ? (h + ':' + pad2(m) + ':' + pad2(s)) : (m + ':' + pad2(s));
}

/* Xtream EPG alanlari base64 gelir */
function b64(s) {
  if (!s) return '';
  try { return decodeURIComponent(escape(window.atob(s))); }
  catch (e) { try { return window.atob(s); } catch (e2) { return s; } }
}

/* "2026-08-31 20:00:00" -> Date  (sunucu yerel saati varsayilir) */
function parseTs(s) {
  if (!s) return null;
  if (/^\d+$/.test(String(s))) return new Date(parseInt(s, 10) * 1000);
  var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

/* Teshis kayitlarinda Xtream kullanici adi ve sifresi gorunmemeli. */
function redactSecrets(value) {
  var s = String(value == null ? '' : value);
  s = s.replace(/\/(live|movie|series)\/[^\/\s?#]+\/[^\/\s?#]+\//gi, '/$1/***/***/');
  s = s.replace(/([?&](?:username|password)=)[^&\s]*/gi, '$1***');
  try {
    if (typeof Api !== 'undefined') {
      var secrets = [Api.user, Api.pass];
      for (var i = 0; i < secrets.length; i++) {
        if (secrets[i] && String(secrets[i]).length > 2) {
          s = s.split(String(secrets[i])).join('***');
          try { s = s.split(encodeURIComponent(String(secrets[i]))).join('***'); } catch (e) { }
        }
      }
    }
  } catch (e) { }
  return s;
}

/* --- Kalici depo --- */

var Store = {
  get: function (key, fallback) {
    try {
      var raw = localStorage.getItem('iptv.' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  set: function (key, val) {
    try { localStorage.setItem('iptv.' + key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  },
  del: function (key) {
    try { localStorage.removeItem('iptv.' + key); } catch (e) { }
  },
  removePrefix: function (prefix) {
    var full = 'iptv.' + String(prefix || '');
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && key.indexOf(full) === 0) localStorage.removeItem(key);
      }
    } catch (e) { }
  }
};

/* Hesaba bagli veriler sunucu + kullanici kimligine gore ayrilir.
   Sifre degisimi ayni profili korur; sifre hicbir zaman anahtara girmez. */
var AccountData = {
  scope: '',
  hash: function (value) {
    var h = 2166136261;
    value = String(value || '');
    for (var i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  },
  makeScope: function (server, user) {
    var s = String(server || '').trim().toLowerCase().replace(/\/+$/, '');
    var u = String(user || '').trim().toLowerCase();
    if (!s || !u) return '';
    return this.hash(s + '|' + u);
  },
  key: function (key) { return this.scope ? 'account.' + this.scope + '.' + key : ''; },
  get: function (key, fallback) { var k = this.key(key); return k ? Store.get(k, fallback) : fallback; },
  set: function (key, value) { var k = this.key(key); return k ? Store.set(k, value) : false; },
  del: function (key) { var k = this.key(key); if (k) Store.del(k); },
  removeScope: function (scope) {
    scope = String(scope || '');
    if (!scope) return;
    Store.removePrefix('account.' + scope + '.');
    if (this.scope === scope) this.clear();
  },
  use: function (server, user) {
    this.scope = this.makeScope(server, user);
    if (!this.scope) { this.reloadModels(); return ''; }

    /* v1.1'den kalan ortak veriyi yalnizca ilk kullanilan hesaba tasi. */
    var owner = Store.get('legacyDataOwner', null);
    if (!owner) {
      var keys = ['fav', 'resume', 'recent', 'lastLiveCat', 'lastLiveChannel',
        'liveHistory', 'categoryVisibility', 'liveBuffer'];
      for (var i = 0; i < keys.length; i++) {
        var oldValue = Store.get(keys[i], null);
        if (oldValue != null && this.get(keys[i], null) == null) this.set(keys[i], oldValue);
      }
      Store.set('legacyDataOwner', this.scope);
    }
    this.reloadModels();
    return this.scope;
  },
  clear: function () {
    this.scope = '';
    this.reloadModels();
  },
  reloadModels: function () {
    try { Favs.data = null; } catch (e) { }
    try { Resume.data = null; } catch (e) { }
    try { Recent.data = null; } catch (e) { }
    try { LiveHistory.data = null; } catch (e) { }
    try { CategoryVisibility.data = null; } catch (e) { }
    try { TrackPrefs.data = null; } catch (e) { }
    try { SubtitleCache.data = null; } catch (e) { }
    try { SubtitleStrategy.data = null; } catch (e) { }
    try { LiveBuffer.data = null; } catch (e) { }
    try { Settings.accountData = null; } catch (e) { }
  }
};

/* En fazla alti Xtream profili. Yalnizca aktif hesap acilista dogrulanir;
   diger kartlarda son basarili kontrolden saklanan durum gosterilir. */
var Accounts = {
  version: 1,
  max: 6,
  data: null,

  normalizeServer: function (value) {
    return normalizeXtreamServer(value);
  },
  identity: function (server, username) {
    return this.normalizeServer(server).toLowerCase() + '|' + String(username || '').trim().toLowerCase();
  },
  makeId: function () {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },
  autoName: function (server, username) {
    var user = String(username || '').trim();
    if (user) return user;
    return this.normalizeServer(server).replace(/^https?:\/\//i, '').split('/')[0] || 'IPTV hesabi';
  },
  load: function () {
    var raw = Store.get('accounts', null);
    var migratedLegacy = false;
    if (!raw || raw.version !== this.version || !(raw.items instanceof Array)) {
      raw = { version: this.version, activeId: '', items: [] };
    }
    if (raw.items.length > this.max) raw.items = raw.items.slice(0, this.max);

    /* Onceki surumde tam get.php/player_api.php adresi profil sunucusu olarak
       saklanmis olabilir. Bu profilleri acilista kendiliginden onar. */
    for (var n = 0; n < raw.items.length; n++) {
      raw.items[n].server = this.normalizeServer(raw.items[n].server);
    }

    /* v1.10 ve onceki tek hesabi kullanicidan tekrar bilgi istemeden tasi. */
    var legacy = Store.get('creds', null);
    if (!raw.items.length && legacy && legacy.server && legacy.username && legacy.password) {
      var profile = {
        id: this.makeId(), name: this.autoName(legacy.server, legacy.username),
        server: this.normalizeServer(legacy.server), username: String(legacy.username).trim(),
        password: String(legacy.password), createdAt: Date.now(), lastUsed: Date.now(),
        migrateSettings: true, status: null, oldScopes: []
      };
      raw.items.push(profile);
      raw.activeId = profile.id;
      migratedLegacy = true;
    }
    var activeExists = false;
    for (var i = 0; i < raw.items.length; i++) if (raw.items[i].id === raw.activeId) activeExists = true;
    if (!activeExists) raw.activeId = '';
    this.data = raw;
    if (this.save() && migratedLegacy) Store.del('creds');
    return this.data;
  },
  save: function () { return this.data ? Store.set('accounts', this.data) : false; },
  list: function () { if (!this.data) this.load(); return this.data.items.slice(0); },
  byId: function (id) {
    if (!this.data) this.load();
    for (var i = 0; i < this.data.items.length; i++) if (this.data.items[i].id === id) return this.data.items[i];
    return null;
  },
  active: function () { if (!this.data) this.load(); return this.byId(this.data.activeId); },
  findDuplicate: function (server, username, exceptId) {
    var identity = this.identity(server, username), items = this.list();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id !== exceptId && this.identity(items[i].server, items[i].username) === identity) return items[i];
    }
    return null;
  },
  add: function (values, info) {
    if (!this.data) this.load();
    if (this.data.items.length >= this.max) throw new Error('En fazla ' + this.max + ' hesap eklenebilir.');
    if (this.findDuplicate(values.server, values.username, null)) throw new Error('Bu sunucu ve kullanici zaten kayitli.');
    var item = {
      id: this.makeId(), name: String(values.name || '').trim() || this.autoName(values.server, values.username),
      server: this.normalizeServer(values.server), username: String(values.username || '').trim(),
      password: String(values.password || ''), createdAt: Date.now(), lastUsed: 0,
      migrateSettings: false, status: this.statusFrom(info), oldScopes: []
    };
    this.data.items.push(item); this.save(); return item;
  },
  update: function (id, values, info) {
    var item = this.byId(id);
    if (!item) throw new Error('Hesap bulunamadi.');
    if (this.findDuplicate(values.server, values.username, id)) throw new Error('Bu sunucu ve kullanici zaten kayitli.');
    var oldScope = AccountData.makeScope(item.server, item.username);
    var newScope = AccountData.makeScope(values.server, values.username);
    if (oldScope && newScope && oldScope !== newScope) {
      if (!(item.oldScopes instanceof Array)) item.oldScopes = [];
      if (item.oldScopes.indexOf(oldScope) === -1) item.oldScopes.push(oldScope);
    }
    item.name = String(values.name || '').trim() || this.autoName(values.server, values.username);
    item.server = this.normalizeServer(values.server);
    item.username = String(values.username || '').trim();
    if (values.password) item.password = String(values.password);
    item.status = this.statusFrom(info);
    this.save(); return item;
  },
  setActive: function (id) {
    var item = this.byId(id);
    if (!item) return null;
    this.data.activeId = id; item.lastUsed = Date.now(); this.save(); return item;
  },
  statusFrom: function (info, error) {
    var ui = info && info.user_info ? info.user_info : {};
    return {
      ok: !!(info && info.user_info), status: String(ui.status || (error ? 'Hata' : '')),
      expDate: ui.exp_date || '', activeCons: ui.active_cons || '0',
      maxConnections: ui.max_connections || '', checkedAt: Date.now(),
      error: error ? String(error.message || error) : ''
    };
  },
  updateStatus: function (id, info, error) {
    var item = this.byId(id); if (!item) return;
    item.status = this.statusFrom(info, error); this.save();
  },
  markSettingsMigrated: function (id) {
    var item = this.byId(id); if (!item || !item.migrateSettings) return;
    item.migrateSettings = false; this.save();
  },
  remove: function (id) {
    if (!this.data) this.load();
    var item = this.byId(id); if (!item) return false;
    var scopes = [AccountData.makeScope(item.server, item.username)].concat(item.oldScopes || []);
    for (var s = 0; s < scopes.length; s++) {
      if (!scopes[s]) continue;
      var shared = false;
      for (var p = 0; p < this.data.items.length; p++) {
        if (this.data.items[p].id === id) continue;
        if (AccountData.makeScope(this.data.items[p].server, this.data.items[p].username) === scopes[s]) shared = true;
      }
      if (!shared) AccountData.removeScope(scopes[s]);
    }
    var out = [];
    for (var i = 0; i < this.data.items.length; i++) if (this.data.items[i].id !== id) out.push(this.data.items[i]);
    this.data.items = out;
    if (this.data.activeId === id) this.data.activeId = '';
    this.save(); return true;
  }
};

var Settings = {
  data: null,
  accountData: null,
  accountKeys: { liveEngine: true, vodEngine: true, liveFormat: true, liveBufferMode: true },
  defaults: {
    engine: 'auto', liveEngine: 'auto', vodEngine: 'auto', liveFormat: 'ts', liveBufferMode: 'auto',
    railLabels: true, epg: true, aspect: 'auto', subtitleSize: 'normal',
    preferredAudio: 'auto', preferredSubtitle: 'off', settingsVersion: 4
  },
  load: function () {
    this.data = Store.get('settings', null) || {};
    /* Eski kurulumlarda m3u8 varsayilandi; bu surumde bir kez TS'e gecir. */
    if (!this.data.settingsVersion || this.data.settingsVersion < 2) {
      this.data.liveFormat = 'ts';
      this.data.settingsVersion = 2;
    }
    /* Eski tek motor tercihini iki yeni alana tasiyarak kullanici davranisini
       surum guncellemesinde degistirme. */
    if (this.data.settingsVersion < 3) {
      var oldEngine = this.data.engine || 'auto';
      if (!this.data.liveEngine) this.data.liveEngine = oldEngine;
      if (!this.data.vodEngine) this.data.vodEngine = oldEngine;
      this.data.settingsVersion = 3;
    }
    if (this.data.settingsVersion < 4) {
      if (!this.data.preferredAudio) this.data.preferredAudio = 'auto';
      if (!this.data.preferredSubtitle) this.data.preferredSubtitle = 'off';
      this.data.settingsVersion = 4;
    }
    for (var k in this.defaults) {
      if (!Object.prototype.hasOwnProperty.call(this.data, k)) this.data[k] = this.defaults[k];
    }
    Store.set('settings', this.data);
    return this.data;
  },
  bindAccount: function (useLegacy) {
    if (!this.data) this.load();
    if (!AccountData.scope) { this.accountData = null; return null; }
    var stored = AccountData.get('providerSettings', null), values = {};
    for (var k in this.accountKeys) {
      if (!Object.prototype.hasOwnProperty.call(this.accountKeys, k)) continue;
      if (stored && Object.prototype.hasOwnProperty.call(stored, k)) values[k] = stored[k];
      else values[k] = useLegacy ? this.data[k] : this.defaults[k];
    }
    this.accountData = values;
    AccountData.set('providerSettings', values);
    return values;
  },
  get: function (k) {
    if (!this.data) this.load();
    if (this.accountKeys[k] && AccountData.scope) {
      if (!this.accountData) this.bindAccount(false);
      return this.accountData[k];
    }
    return this.data[k];
  },
  set: function (k, v) {
    if (!this.data) this.load();
    if (this.accountKeys[k] && AccountData.scope) {
      if (!this.accountData) this.bindAccount(false);
      this.accountData[k] = v;
      AccountData.set('providerSettings', this.accountData);
      return;
    }
    this.data[k] = v; Store.set('settings', this.data);
  }
};

/* Favoriler: { live:[], movie:[], series:[] } */
var Favs = {
  data: null,
  load: function () {
    this.data = AccountData.get('fav', null) || { live: [], movie: [], series: [] };
    if (!this.data.live) this.data.live = [];
    if (!this.data.movie) this.data.movie = [];
    if (!this.data.series) this.data.series = [];
    return this.data;
  },
  has: function (kind, id) {
    if (!this.data) this.load();
    return this.data[kind].indexOf(String(id)) !== -1;
  },
  toggle: function (kind, id) {
    if (!this.data) this.load();
    id = String(id);
    var i = this.data[kind].indexOf(id);
    if (i === -1) this.data[kind].push(id); else this.data[kind].splice(i, 1);
    AccountData.set('fav', this.data);
    return i === -1;
  },
  moveLive: function (from, to) {
    if (!this.data) this.load();
    var list = this.data.live;
    from = parseInt(from, 10); to = parseInt(to, 10);
    if (isNaN(from) || isNaN(to) || from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return false;
    var item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    AccountData.set('fav', this.data);
    return true;
  },
  setLiveOrder: function (ids) {
    if (!this.data) this.load();
    this.data.live = (ids || []).map(function (id) { return String(id); });
    AccountData.set('fav', this.data);
  },
  list: function (kind) { if (!this.data) this.load(); return this.data[kind]; }
};

/* Canli kanallar icin son sekiz benzersiz kanal. Yalnizca basariyla tam ekran
   oynatilan kanallar eklenir; on izleme ve basarisiz acilislar listeyi kirletmez. */
var LiveHistory = {
  data: null,
  max: 8,
  load: function () {
    this.data = AccountData.get('liveHistory', null) || [];
    if (!(this.data instanceof Array)) this.data = [];
    this.data = this.data.slice(0, this.max);
    return this.data;
  },
  list: function () { if (!this.data) this.load(); return this.data.slice(0); },
  add: function (channel, context) {
    if (!channel || channel.stream_id == null) return;
    if (!this.data) this.load();
    var id = String(channel.stream_id), next = [];
    for (var i = 0; i < this.data.length; i++) {
      if (String(this.data[i].stream_id) !== id) next.push(this.data[i]);
    }
    next.unshift({
      stream_id: channel.stream_id,
      name: channel.name || 'Kanal',
      num: channel.num || '',
      stream_icon: channel.stream_icon || '',
      category_id: channel.category_id != null ? channel.category_id : (context && context.categoryId),
      category_name: (context && context.categoryName) || '',
      ts: Date.now()
    });
    this.data = next.slice(0, this.max);
    AccountData.set('liveHistory', this.data);
  },
  previous: function (currentId) {
    if (!this.data) this.load();
    currentId = String(currentId == null ? '' : currentId);
    for (var i = 0; i < this.data.length; i++) {
      if (String(this.data[i].stream_id) !== currentId) return this.data[i];
    }
    return null;
  },
  remove: function (id) {
    if (!this.data) this.load();
    id = String(id); var next = [];
    for (var i = 0; i < this.data.length; i++) if (String(this.data[i].stream_id) !== id) next.push(this.data[i]);
    this.data = next; AccountData.set('liveHistory', this.data);
  },
  clear: function () { this.data = []; AccountData.set('liveHistory', []); }
};

/* Saglayicinin kategori kimlikleri hesaplar arasinda degisebilir. Bu nedenle
   gorunurluk secimleri aktif hesabin yerel alaninda tutulur. */
var CategoryVisibility = {
  data: null,
  kinds: { live: true, movie: true, series: true },
  load: function () {
    this.data = AccountData.get('categoryVisibility', null) || { live: [], movie: [], series: [] };
    for (var kind in this.kinds) {
      if (!Object.prototype.hasOwnProperty.call(this.kinds, kind)) continue;
      if (!(this.data[kind] instanceof Array)) this.data[kind] = [];
    }
    return this.data;
  },
  hidden: function (kind, id) {
    if (!this.data) this.load();
    return !!(this.data[kind] && this.data[kind].indexOf(String(id)) !== -1);
  },
  visibleList: function (kind, list) {
    if (!this.data) this.load();
    var self = this;
    return (list || []).filter(function (item) {
      return !self.hidden(kind, item.category_id);
    });
  },
  toggle: function (kind, id) {
    if (!this.kinds[kind]) return true;
    if (!this.data) this.load();
    id = String(id); var list = this.data[kind], index = list.indexOf(id);
    if (index === -1) list.push(id); else list.splice(index, 1);
    AccountData.set('categoryVisibility', this.data);
    return index !== -1;
  },
  showAll: function (kind) {
    if (!this.data) this.load();
    if (this.kinds[kind]) this.data[kind] = [];
    AccountData.set('categoryVisibility', this.data);
  }
};

/* Izleme ilerlemesi: { "movie:12": {pos,dur,ts,name} } */
var Resume = {
  data: null,
  load: function () { this.data = AccountData.get('resume', null) || {}; return this.data; },
  key: function (kind, id) { return kind + ':' + id; },
  get: function (kind, id) {
    if (!this.data) this.load();
    return this.data[this.key(kind, id)] || null;
  },
  save: function (kind, id, pos, dur, name) {
    if (!this.data) this.load();
    if (!dur || dur < 60) return;
    var k = this.key(kind, id);
    if (pos < 30 || pos > dur - 60) { delete this.data[k]; }
    else { this.data[k] = { pos: Math.floor(pos), dur: Math.floor(dur), ts: Date.now(), name: name || '' }; }
    /* en fazla 200 kayit tut */
    var keys = Object.keys(this.data);
    if (keys.length > 200) {
      var self = this;
      keys.sort(function (a, b) { return self.data[a].ts - self.data[b].ts; });
      for (var i = 0; i < keys.length - 200; i++) delete this.data[keys[i]];
    }
    AccountData.set('resume', this.data);
  },
  clear: function () { this.data = {}; AccountData.set('resume', {}); }
};

/* Son izlenen film/diziler: en yeni basta, ayni yapim tek kayit, en fazla 16 oge. */
var Recent = {
  data: null,
  load: function () {
    this.data = AccountData.get('recent', null) || [];
    if (!(this.data instanceof Array)) this.data = [];
    if (this.data.length > 16) this.data = this.data.slice(0, 16);
    return this.data;
  },
  list: function () {
    if (!this.data) this.load();
    return this.data.slice(0);
  },
  key: function (it) { return String(it.kind) + ':' + String(it.id); },
  add: function (it) {
    if (!it || !it.kind || it.id == null) return;
    if (!this.data) this.load();
    var key = this.key(it), next = [];
    for (var i = 0; i < this.data.length; i++) {
      if (this.key(this.data[i]) !== key) next.push(this.data[i]);
    }
    it.ts = Date.now();
    next.unshift(it);
    this.data = next.slice(0, 16);
    AccountData.set('recent', this.data);
  },
  remove: function (kind, id) {
    if (!this.data) this.load();
    var key = String(kind) + ':' + String(id), next = [];
    for (var i = 0; i < this.data.length; i++) {
      if (this.key(this.data[i]) !== key) next.push(this.data[i]);
    }
    this.data = next;
    AccountData.set('recent', this.data);
  },
  clear: function () { this.data = []; AccountData.set('recent', []); }
};

/* Dizi bolumleri icin ses/altyazi tercihi. Parca indeksi bolumler arasinda
   degisebildigi icin dil/etiket anahtari saklanir. Filmler oturumluk kalir. */
var TrackPrefs = {
  data: null,
  max: 100,
  load: function () {
    this.data = AccountData.get('trackPrefs', null) || {};
    if (!this.data || typeof this.data !== 'object') this.data = {};
    return this.data;
  },
  contentKey: function (meta) {
    if (!meta || meta.kind !== 'ep' || meta.seriesId == null) return null;
    return 'series:' + String(meta.seriesId);
  },
  get: function (meta) {
    if (!this.data) this.load();
    var key = this.contentKey(meta);
    return key && this.data[key] ? this.data[key] : null;
  },
  set: function (meta, type, value) {
    if (type !== 'audio' && type !== 'text') return;
    var key = this.contentKey(meta);
    if (!key) return; /* Film tercihleri oynatma oturumunda kalir. */
    if (!this.data) this.load();
    var item = this.data[key] || {};
    item[type] = value;
    item.updated = Date.now();
    this.data[key] = item;
    var keys = Object.keys(this.data);
    if (keys.length > this.max) {
      var self = this;
      keys.sort(function (a, b) { return (self.data[a].updated || 0) - (self.data[b].updated || 0); });
      for (var i = 0; i < keys.length - this.max; i++) delete this.data[keys[i]];
    }
    AccountData.set('trackPrefs', this.data);
  }
};

/* Yazilimsal TX3G altyazilarini hesap ve icerik kimligine gore saklar.
   URL/kullanici/sifre tutulmaz. En son sekiz parca, TV depolamasini sisirmeden
   tekrar oynatmalari hizlandirir. */
var SubtitleCache = {
  data: null,
  max: 8,
  globalBudgetBytes: 1600 * 1024,
  load: function () {
    this.data = AccountData.get('subtitleCache', null) || {};
    if (!this.data || typeof this.data !== 'object') this.data = {};
    return this.data;
  },
  key: function (contentKey, sourceIndex) {
    return String(contentKey || '') + ':track:' + String(sourceIndex);
  },
  get: function (contentKey, sourceIndex, signature) {
    if (!contentKey) return null;
    if (!this.data) this.load();
    var key = this.key(contentKey, sourceIndex);
    var item = this.data[key];
    if (!item || item.signature !== signature || !Array.isArray(item.cues)) return null;
    item.used = Date.now();
    return item.cues;
  },
  buckets: function () {
    var out = [], currentKey = 'iptv.' + AccountData.key('subtitleCache');
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var storageKey = localStorage.key(i);
        if (!storageKey || !/^iptv\.account\.[^.]+\.subtitleCache$/.test(storageKey)) continue;
        var data;
        if (storageKey === currentKey) data = this.data || {};
        else {
          try { data = JSON.parse(localStorage.getItem(storageKey) || '{}'); }
          catch (e) { data = {}; }
        }
        if (!data || typeof data !== 'object') data = {};
        out.push({ storageKey: storageKey, data: data, changed: false });
      }
    } catch (e) { }
    var found = false;
    for (var n = 0; n < out.length; n++) if (out[n].storageKey === currentKey) found = true;
    if (currentKey !== 'iptv.' && !found) out.push({ storageKey: currentKey, data: this.data || {}, changed: false });
    return out;
  },
  pruneGlobal: function (forceOne) {
    var buckets = this.buckets(), entries = [], total = 0;
    for (var b = 0; b < buckets.length; b++) {
      var keys = Object.keys(buckets[b].data);
      for (var i = 0; i < keys.length; i++) {
        var item = buckets[b].data[keys[i]];
        var bytes = 0;
        try { bytes = JSON.stringify(item).length * 2; } catch (e) { bytes = this.globalBudgetBytes; }
        total += bytes;
        entries.push({ bucket: buckets[b], key: keys[i], used: item.used || 0, bytes: bytes });
      }
    }
    entries.sort(function (a, b) { return a.used - b.used; });
    var removed = 0;
    while (entries.length && (total > this.globalBudgetBytes || (forceOne && removed === 0))) {
      var old = entries.shift();
      delete old.bucket.data[old.key]; old.bucket.changed = true;
      total -= old.bytes; removed++;
    }
    for (var w = 0; w < buckets.length; w++) {
      if (!buckets[w].changed) continue;
      try { localStorage.setItem(buckets[w].storageKey, JSON.stringify(buckets[w].data)); } catch (e) { }
    }
    return removed > 0;
  },
  save: function () {
    this.pruneGlobal(false);
    if (AccountData.set('subtitleCache', this.data)) return true;
    /* Kota doluysa yalnizca en eski altyazi onbelleklerini at ve bir daha dene. */
    for (var i = 0; i < 16; i++) {
      if (!this.pruneGlobal(true)) break;
      if (AccountData.set('subtitleCache', this.data)) return true;
    }
    return false;
  },
  set: function (contentKey, sourceIndex, signature, cues) {
    if (!contentKey || !cues || !cues.length) return false;
    if (!this.data) this.load();
    var key = this.key(contentKey, sourceIndex);
    this.data[key] = { signature: signature, cues: cues, used: Date.now() };
    var keys = Object.keys(this.data), self = this;
    if (keys.length > this.max) {
      keys.sort(function (a, b) { return (self.data[a].used || 0) - (self.data[b].used || 0); });
      for (var i = 0; i < keys.length - this.max; i++) delete this.data[keys[i]];
    }
    return this.save();
  },
  clear: function () { this.data = {}; AccountData.set('subtitleCache', {}); }
};

/* Altyazi sunum yolunu hesap + motor + kapsayici ve icerik bazinda ogrenir.
   Bilinmeyen kaynakta yerlesik yol beklemesiz denenir; iki farkli icerigin ayni
   sonucu vermesi yeni icerikler icin saglayici profiline donusur. */
var SubtitleStrategy = {
  version: 1,
  data: null,
  ttl: 30 * 24 * 60 * 60 * 1000,
  maxContents: 120,
  maxManifests: 24,

  emptyData: function () {
    return { version: this.version, profiles: {}, contents: {}, manifests: {}, votes: {} };
  },

  load: function () {
    var raw = AccountData.get('subtitleStrategy', null);
    this.data = raw && raw.version === this.version ? raw : this.emptyData();
    if (!this.data.profiles) this.data.profiles = {};
    if (!this.data.contents) this.data.contents = {};
    if (!this.data.manifests) this.data.manifests = {};
    if (!this.data.votes) this.data.votes = {};
    this.prune();
    return this.data;
  },

  extension: function (value) {
    value = String(value || 'unknown').toLowerCase().replace(/^\./, '');
    return value.replace(/[^a-z0-9]/g, '') || 'unknown';
  },

  contentKey: function (ctx) {
    return String((ctx && ctx.engine) || 'unknown') + '|' +
      String((ctx && ctx.contentKey) || 'unknown');
  },

  profileKey: function (ctx) {
    return String((ctx && ctx.engine) || 'unknown') + '|' + this.extension(ctx && ctx.extension);
  },

  fresh: function (record) {
    return !!(record && (!record.updated || Date.now() - record.updated < this.ttl));
  },

  resolve: function (ctx) {
    if (!this.data) this.load();
    var content = this.data.contents[this.contentKey(ctx)];
    if (this.fresh(content)) return { mode: content.mode, source: 'content' };
    var profile = this.data.profiles[this.profileKey(ctx)];
    if (this.fresh(profile)) return { mode: profile.mode, source: 'provider' };
    return { mode: 'unknown', source: 'default' };
  },

  getManifest: function (ctx) {
    if (!this.data) this.load();
    var item = this.data.manifests[this.contentKey(ctx)];
    if (!this.fresh(item) || !item.tracks || !item.tracks.length) return null;
    item.used = Date.now();
    return { kind: item.kind || 'mp4', tracks: item.tracks };
  },

  note: function (ctx, mode, info) {
    if (mode !== 'native' && mode !== 'software') return;
    if (!this.data) this.load();
    var now = Date.now(), contentKey = this.contentKey(ctx), profileKey = this.profileKey(ctx);
    this.data.contents[contentKey] = { mode: mode, updated: now, used: now };

    if (mode === 'software' && info && info.tracks && info.tracks.length) {
      var tracks = [];
      for (var i = 0; i < info.tracks.length; i++) {
        tracks.push({
          sourceIndex: info.tracks[i].sourceIndex,
          lang: info.tracks[i].lang || 'und',
          signature: info.tracks[i].signature || '',
          manifestOnly: true
        });
      }
      this.data.manifests[contentKey] = { kind: info.kind || 'mp4', tracks: tracks, updated: now, used: now };
    }

    var votes = this.data.votes[profileKey] || { native: {}, software: {} };
    if (!votes.native) votes.native = {};
    if (!votes.software) votes.software = {};
    var contentId = String((ctx && ctx.contentKey) || 'unknown');
    /* Ayni icerik icin son dogrulama oncekini gecersiz kilar. Aksi halde bir
       kaynak yolu degistiginde ayni icerik iki tarafa da oy verip profil
       ogrenimini 30 gun boyunca gereksiz yere kilitleyebilirdi. */
    delete votes[mode === 'native' ? 'software' : 'native'][contentId];
    votes[mode][contentId] = now;
    this.data.votes[profileKey] = votes;
    if (mode === 'native') delete this.data.manifests[contentKey];

    var nativeCount = this.voteCount(votes.native, now);
    var softwareCount = this.voteCount(votes.software, now);
    if (nativeCount >= 2 && softwareCount === 0) {
      this.data.profiles[profileKey] = { mode: 'native', updated: now };
    } else if (softwareCount >= 2 && nativeCount === 0) {
      this.data.profiles[profileKey] = { mode: 'software', updated: now };
    } else if (nativeCount && softwareCount) {
      /* Ayni panel farkli ust kaynaklar kullanabilir; celiskide genelleme yapma. */
      delete this.data.profiles[profileKey];
    }
    this.prune();
    AccountData.set('subtitleStrategy', this.data);
  },

  voteCount: function (map, now) {
    var count = 0;
    for (var key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      if (now - map[key] >= this.ttl) delete map[key];
      else count++;
    }
    return count;
  },

  trimMap: function (map, max) {
    var keys = Object.keys(map), self = this;
    if (keys.length <= max) return;
    keys.sort(function (a, b) {
      return ((map[a].used || map[a].updated || 0) - (map[b].used || map[b].updated || 0));
    });
    for (var i = 0; i < keys.length - max; i++) delete map[keys[i]];
  },

  prune: function () {
    if (!this.data) return;
    var now = Date.now(), maps = [this.data.contents, this.data.manifests, this.data.profiles];
    for (var m = 0; m < maps.length; m++) {
      for (var key in maps[m]) {
        if (Object.prototype.hasOwnProperty.call(maps[m], key) && !this.fresh(maps[m][key])) delete maps[m][key];
      }
    }
    for (var voteKey in this.data.votes) {
      if (!Object.prototype.hasOwnProperty.call(this.data.votes, voteKey)) continue;
      var votes = this.data.votes[voteKey];
      if (!this.voteCount(votes.native || {}, now) && !this.voteCount(votes.software || {}, now)) delete this.data.votes[voteKey];
    }
    this.trimMap(this.data.contents, this.maxContents);
    this.trimMap(this.data.manifests, this.maxManifests);
  },

  noteNative: function (ctx) { this.note(ctx, 'native'); },
  noteSoftware: function (ctx, info) { this.note(ctx, 'software', info); },
  reset: function () { this.data = this.emptyData(); AccountData.set('subtitleStrategy', this.data); }
};

/* Canli TV tampon profilleri.
   Otomatik mod once kanali, iki farkli kanal ayni ihtiyaci dogrularsa kategoriyi
   ogrenir. Basarisiz olunan seviyenin bir ustu 30 gunluk guvenli taban olur. */
var LiveBuffer = {
  levels: [5, 10, 15, 20],
  version: 3,
  data: null,
  floorTtl: 30 * 24 * 60 * 60 * 1000,
  evidenceTtl: 14 * 24 * 60 * 60 * 1000,
  maxChannelRecords: 100,
  maxCategoryRecords: 100,

  emptyData: function () { return { version: this.version, categories: {}, channels: {} }; },

  load: function () {
    var raw = AccountData.get('liveBuffer', null);
    if (raw && raw.version === this.version && raw.categories && raw.channels) {
      this.data = raw;
    } else {
      /* v1.2 kategori kayitlarini kaybetmeden yeni yapida guvenli tabana tasi. */
      this.data = this.emptyData();
      if (raw && typeof raw === 'object') {
        for (var key in raw) {
          if (!Object.prototype.hasOwnProperty.call(raw, key) || !raw[key]) continue;
          var old = raw[key];
          if (this.levels.indexOf(old.level) === -1) continue;
          this.data.categories[key] = {
            level: old.level,
            safeFloor: old.level,
            safeFloorUntil: (old.updated || Date.now()) + this.floorTtl,
            stalls: old.stalls || 0,
            cleanSessions: [],
            votes: {},
            updated: old.updated || Date.now(),
            lastUsed: Date.now()
          };
        }
      }
      this.save();
    }
    this.prune();
    return this.data;
  },

  save: function () { if (this.data) AccountData.set('liveBuffer', this.data); },

  categoryKey: function (ctx) {
    ctx = ctx || {};
    return String(ctx.engine || 'avplay') + '|' + String(ctx.format || 'ts') + '|' +
      String(ctx.categoryId || '__unknown');
  },

  channelKey: function (ctx) {
    return this.categoryKey(ctx) + '|channel:' + String((ctx && ctx.channelId) || '__unknown');
  },

  resumeFor: function (playSeconds) {
    if (playSeconds <= 10) return 15;
    return 20;
  },

  validLevel: function (value, fallback) {
    value = parseInt(value, 10);
    return this.levels.indexOf(value) !== -1 ? value : fallback;
  },

  nextLevel: function (value) {
    var index = this.levels.indexOf(this.validLevel(value, 10));
    return index < this.levels.length - 1 ? this.levels[index + 1] : 20;
  },

  expireFloor: function (record, now) {
    if (!record) return;
    if (record.safeFloorUntil && record.safeFloorUntil <= now) {
      record.safeFloor = 5;
      record.safeFloorUntil = 0;
      record.failedAt = null;
      /* Sure dolduktan sonra inis icin uc yeni temiz oturum gereksin. */
      record.cleanSessions = [];
    }
  },

  normalizeRecord: function (record, fallbackLevel) {
    record = record || {};
    record.level = this.validLevel(record.level, fallbackLevel || 10);
    record.safeFloor = this.validLevel(record.safeFloor, 5);
    if (record.safeFloor > record.level) record.level = record.safeFloor;
    if (!(record.cleanSessions instanceof Array)) record.cleanSessions = [];
    if (!record.votes || typeof record.votes !== 'object') record.votes = {};
    return record;
  },

  resolve: function (ctx) {
    ctx = ctx || {};
    var mode = String(Settings.get('liveBufferMode') || 'auto');

    /* HTML5 tampon boyutunu uygulamanin belirleyecegi bir API sunmaz.
       Manuel bir sure secilmis olsa bile uygulanmis gibi raporlama. */
    if (String(ctx.engine || 'avplay') !== 'avplay') {
      return { mode: 'unsupported', play: 10, resume: 15, source: 'html5' };
    }

    if (mode !== 'auto') {
      var fixed = this.validLevel(mode, 10);
      return { mode: 'manual', play: fixed, resume: this.resumeFor(fixed), source: 'manual' };
    }

    if (!this.data) this.load();
    var now = Date.now();
    var categoryKey = this.categoryKey(ctx), channelKey = this.channelKey(ctx);
    var channel = this.data.channels[channelKey];
    var category = this.data.categories[categoryKey];
    this.expireFloor(channel, now);
    this.expireFloor(category, now);

    var source = 'default', record = null;
    if (channel) { source = 'channel'; record = this.normalizeRecord(channel, 10); }
    else if (category) { source = 'category'; record = this.normalizeRecord(category, 10); }
    var level = record ? record.level : 10;
    if (record) record.lastUsed = now;

    return {
      mode: 'auto', play: level, resume: this.resumeFor(level), source: source,
      categoryKey: categoryKey, channelKey: channelKey
    };
  },

  begin: function (ctx, profile) {
    return {
      context: ctx || {}, profile: profile, started: Date.now(), readyAt: 0, stalled: false
    };
  },

  markReady: function (session) {
    if (session && !session.readyAt) session.readyAt = Date.now();
  },

  resetClean: function (record) { if (record) record.cleanSessions = []; },

  noteStall: function (session, reason) {
    if (!session || session.stalled) return session && session.profile;
    session.stalled = true;
    var profile = session.profile, ctx = session.context || {};
    if (!profile || profile.mode !== 'auto' || String(ctx.engine || '') !== 'avplay') return profile;
    if (!this.data) this.load();

    var now = Date.now();
    var current = this.validLevel(profile.play, 10);
    var target = this.nextLevel(current);
    var channelId = String(ctx.channelId || '__unknown');
    var channelKey = profile.channelKey || this.channelKey(ctx);
    var categoryKey = profile.categoryKey || this.categoryKey(ctx);
    var channel = this.normalizeRecord(this.data.channels[channelKey], current);
    var category = this.normalizeRecord(this.data.categories[categoryKey], 10);

    channel.level = Math.max(channel.level, target);
    channel.safeFloor = Math.max(channel.safeFloor, target);
    channel.safeFloorUntil = now + this.floorTtl;
    channel.failedAt = current;
    channel.lastFailure = now;
    channel.lastReason = String(reason || 'buffering');
    channel.stalls = (channel.stalls || 0) + 1;
    channel.learnedFrom = 'stall';
    channel.updated = now;
    channel.lastUsed = now;
    channel.cleanSessions = [];
    this.data.channels[channelKey] = channel;

    /* Her yukselme kategori temiz sayacini da bozar. */
    category.cleanSessions = [];
    if (!category.votes[String(target)]) category.votes[String(target)] = {};
    var votes = category.votes[String(target)];
    for (var voter in votes) {
      if (Object.prototype.hasOwnProperty.call(votes, voter) && now - votes[voter] > this.evidenceTtl) {
        delete votes[voter];
      }
    }
    votes[channelId] = now;

    var distinct = Object.keys(votes).length;
    if (channelId !== '__unknown' && distinct >= 2) {
      category.level = Math.max(category.level, target);
      category.safeFloor = Math.max(category.safeFloor, target);
      category.safeFloorUntil = now + this.floorTtl;
      category.failedAt = current;
      category.lastFailure = now;
      category.lastReason = 'Iki farkli kanal ayni tampon ihtiyacini dogruladi';
      category.stalls = (category.stalls || 0) + 1;
      category.updated = now;
      category.lastUsed = now;
      category.cleanSessions = [];
      delete category.votes[String(target)];

      /* Kategoriye terfi eden tekil ariza kayitlari artik gereksizdir. */
      for (var key in this.data.channels) {
        if (!Object.prototype.hasOwnProperty.call(this.data.channels, key)) continue;
        var item = this.data.channels[key];
        if (key.indexOf(categoryKey + '|channel:') === 0 && item.learnedFrom === 'stall' &&
          this.validLevel(item.level, 10) <= category.level) delete this.data.channels[key];
      }
    }

    this.data.categories[categoryKey] = category;
    this.prune();
    this.save();
    return this.resolve(ctx);
  },

  cleanTarget: function (session) {
    var profile = session.profile;
    if (profile.source === 'channel' && this.data.channels[profile.channelKey]) {
      return { map: this.data.channels, key: profile.channelKey, type: 'channel' };
    }
    return { map: this.data.categories, key: profile.categoryKey, type: 'category' };
  },

  end: function (session) {
    if (!session || session.stalled || !session.profile || session.profile.mode !== 'auto') return;
    if (String((session.context || {}).engine || '') !== 'avplay' || !session.readyAt) return;
    var elapsed = Math.floor((Date.now() - session.readyAt) / 1000);
    if (elapsed < 600) return; /* Kanal gezinmesi temiz oturum sayilmasin. */
    if (!this.data) this.load();

    var now = Date.now();
    var target = this.cleanTarget(session);
    var record = this.normalizeRecord(target.map[target.key], session.profile.play);
    this.expireFloor(record, now);
    record.cleanSessions.push({
      channelId: String((session.context || {}).channelId || '__unknown'),
      at: now,
      seconds: elapsed
    });
    if (record.cleanSessions.length > 6) record.cleanSessions = record.cleanSessions.slice(-6);

    var canLower = record.cleanSessions.length >= 3;
    if (target.type === 'category' && canLower) {
      var distinct = {};
      for (var i = record.cleanSessions.length - 3; i < record.cleanSessions.length; i++) {
        distinct[record.cleanSessions[i].channelId] = true;
      }
      canLower = Object.keys(distinct).length >= 2;
    }

    if (canLower) {
      var index = this.levels.indexOf(record.level);
      var floorIndex = this.levels.indexOf(this.validLevel(record.safeFloor, 5));
      if (index > floorIndex) {
        record.level = this.levels[index - 1];
        if (record.level < record.safeFloor) record.level = record.safeFloor;
      }
      /* Tabanda beklerken eski oturumlar, taban suresi dolunca anlik inis yaratmasin. */
      record.cleanSessions = [];
    }

    record.updated = now;
    record.lastUsed = now;
    target.map[target.key] = record;
    this.prune();
    this.save();
  },

  pruneMap: function (map, maximum) {
    var keys = Object.keys(map);
    if (keys.length <= maximum) return;
    keys.sort(function (a, b) {
      return (map[a].lastUsed || map[a].updated || 0) - (map[b].lastUsed || map[b].updated || 0);
    });
    for (var i = 0; i < keys.length - maximum; i++) delete map[keys[i]];
  },

  prune: function () {
    if (!this.data) return;
    if (!this.data.categories) this.data.categories = {};
    if (!this.data.channels) this.data.channels = {};
    this.pruneMap(this.data.channels, this.maxChannelRecords);
    this.pruneMap(this.data.categories, this.maxCategoryRecords);
  },

  reset: function () { this.data = this.emptyData(); AccountData.set('liveBuffer', this.data); },

  modeLabel: function () {
    var mode = String(Settings.get('liveBufferMode') || 'auto');
    return mode === 'auto' ? 'Otomatik' : mode + ' sn';
  }
};

/* --- Ekran geri bildirimi --- */

var UI = {
  spin: function (on) {
    var s = document.getElementById('spinner');
    if (s) s.className = on ? 'on' : '';
  },
  toastTimer: null,
  toast: function (msg, ms) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'on';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(function () { t.className = ''; }, ms || 2200);
  }
};

/* --- Teshis: siyah ekran yerine hatayi goster --- */

var Diag = {
  page: 0,
  begin: function (kind) {
    this.status = { Surum: 'H&M.v1.15.0', Oturum: kind + ' · ' + new Date().toISOString() };
    this.page = 0;
  },
  move: function (delta) { this.page = Math.max(0, this.page + delta); this.render(); },
  persist: function () {
    try { localStorage.setItem('hm.diag.last', JSON.stringify({ status: this.status, errors: this.errors })); } catch (e) { }
  },
  loadLast: function () {
    try {
      var saved = JSON.parse(localStorage.getItem('hm.diag.last') || 'null');
      if (saved) { this.status = saved.status || {}; this.errors = saved.errors || []; }
    } catch (e) { }
    this.page = 0; this.render();
  },
  errors: [],
  status: {},
  add: function (msg) {
    this.errors.push(new Date().toISOString().slice(11, 19) + ' ' + redactSecrets(msg).slice(0, 1400));
    if (this.errors.length > 40) this.errors.shift();
    this.persist();
    if (this.visible) this.render();
  },
  set: function (key, value) {
    this.status[String(key)] = redactSecrets(value).slice(0, 6000);
    if (this.visible) this.render();
  },
  visible: false,
  render: function () {
    var d = document.getElementById('diag');
    if (!d) return;
    var lines = ['Tarayici: ' + navigator.userAgent, 'Motor: ' + (window.__engine || 'bilinmiyor')];
    var self = this;
    Object.keys(this.status).forEach(function (key) {
      var value = redactSecrets(key + ': ' + self.status[key]);
      for (var p = 0; p < value.length; p += 100) lines.push(value.slice(p, p + 100));
    });
    this.errors.slice().reverse().forEach(function (value) {
      for (var p = 0; p < value.length; p += 100) lines.push(value.slice(p, p + 100));
    });
    var pages = Math.max(1, Math.ceil(lines.length / 12));
    this.page = Math.min(this.page, pages - 1);
    d.innerHTML = '<b>H&M Teshis · ' + (this.page + 1) + '/' + pages + '</b>' +
      esc(lines.slice(this.page * 12, this.page * 12 + 12).join('\n\n')) +
      '\n\nYukari/Asagi: Sayfa · Geri/OK: Kapat';
    d.style.display = 'block'; this.visible = true; this.persist();
  },
  hide: function () {
    var d = document.getElementById('diag');
    if (d) d.style.display = 'none';
    this.visible = false;
  },
  toggle: function () { if (this.visible) this.hide(); else this.render(); }
};

window.addEventListener('error', function (e) {
  Diag.add((e && e.message ? e.message : 'Bilinmeyen hata') +
    (e && e.filename ? '\n  ' + e.filename + ':' + e.lineno : ''));
}, true);

window.addEventListener('unhandledrejection', function (e) {
  var r = e && e.reason;
  Diag.add('Promise hatasi: ' + (r && r.stack ? r.stack : r));
});
