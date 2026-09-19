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
    home: '<path d="M3 11.2L12 3l9 8.2"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9.5 21v-6h5v6"></path>',
    live: '<polygon points="9,6 20,12 9,18"></polygon>',
    movies: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><line x1="8" y1="5" x2="8" y2="19"></line><line x1="16" y1="5" x2="16" y2="19"></line>',
    series: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><line x1="8" y1="9" x2="16" y2="9"></line><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line>',
    favs: '<path d="M12 3.5l2.7 5.45 6.02.88-4.36 4.24 1.03 5.99L12 17.23l-5.39 2.83 1.03-5.99-4.36-4.24 6.02-.88z"></path>',
    recent: '<path d="M4.2 8.5A8.2 8.2 0 1 1 4 14"></path><polyline points="4,4 4,9 9,9"></polyline><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="13" x2="15.5" y2="15"></line>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1H9.6V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1V9.6H3A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.38.35.72.6 1 .28.27.63.4 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6.6z"></path>',
    about: '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="10.5" x2="12" y2="17"></line><circle cx="12" cy="7" r=".8" class="solid"></circle>',
    account: '<circle cx="12" cy="8" r="4"></circle><path d="M4.5 21c.6-4.2 3-6.5 7.5-6.5s6.9 2.3 7.5 6.5"></path>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"></circle><line x1="15.5" y1="15.5" x2="21" y2="21"></line>',
    play: '<polygon class="solid" points="8,5 20,12 8,19"></polygon>',
    pause: '<rect class="solid" x="6" y="5" width="4" height="14" rx="1"></rect><rect class="solid" x="14" y="5" width="4" height="14" rx="1"></rect>',
    rewind: '<path d="M11 7l-5 5 5 5"></path><path d="M18 7l-5 5 5 5"></path>',
    forward: '<path d="M6 7l5 5-5 5"></path><path d="M13 7l5 5-5 5"></path>',
    restart: '<path d="M4.4 9A8 8 0 1 1 5 16.2"></path><polyline points="4,4 4,9 9,9"></polyline>',
    previous: '<line x1="6" y1="5" x2="6" y2="19"></line><polygon class="solid" points="19,5 9,12 19,19"></polygon>',
    next: '<line x1="18" y1="5" x2="18" y2="19"></line><polygon class="solid" points="5,5 15,12 5,19"></polygon>',
    episodes: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><line x1="8" y1="9" x2="17" y2="9"></line><line x1="8" y1="13" x2="17" y2="13"></line><line x1="8" y1="17" x2="14" y2="17"></line>',
    audio: '<path d="M5 10v4h4l5 4V6l-5 4z"></path><path d="M17 9a4 4 0 0 1 0 6"></path><path d="M19 6.5a8 8 0 0 1 0 11"></path>',
    aspect: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M7 9V7h3M17 9V7h-3M7 15v2h3M17 15v2h-3"></path>',
    more: '<circle class="solid" cx="6" cy="12" r="1.4"></circle><circle class="solid" cx="12" cy="12" r="1.4"></circle><circle class="solid" cx="18" cy="12" r="1.4"></circle>',
    close: '<line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line>',
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

/* VOD aramasinda noktalama, farkli bosluklar ve Turkce karakterler sonucu
   degistirmemeli. Genel norm() baska depolama anahtarlarinda da kullanildigi
   icin daha agresif sadeleştirme ayri tutulur. */
function searchNorm(s) {
  return norm(s).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isAdultCategoryName(name) {
  var value = norm(name).replace(/[^a-z0-9]+/g, ' ');
  return /(^| )(adult|xxx|erotik|yetiskin|porn|18)( |$)/.test(value);
}

/* Zorunlu olmayan Samsung kumanda tuslari kaydedilmeden keydown uretmez. */
function registerRemoteKeys() {
  try {
    if (typeof tizen === 'undefined' || !tizen.tvinputdevice) return;

    var keyMap = {
      ChannelUp: 'CH_UP', ChannelDown: 'CH_DOWN', Info: 'INFO',
      MediaPlay: 'PLAY', MediaPause: 'PAUSE', MediaPlayPause: 'PLAYPAUSE',
      MediaStop: 'STOP', MediaFastForward: 'FF', MediaRewind: 'RW',
      ColorF1Green: 'GREEN', ColorF2Yellow: 'YELLOW'
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

/* Unix EPG alanlari saat diliminden bagimsizdir. Eski panellerde metin
   alanlari geriye uyumluluk icin kullanilir. */
function epgStart(program) {
  var value = program && program.start_timestamp;
  if (value != null && /^\d+$/.test(String(value))) return new Date(parseInt(value, 10) * 1000);
  return parseTs(program && program.start);
}

function epgEnd(program) {
  var value = program && program.stop_timestamp;
  if (value != null && /^\d+$/.test(String(value))) return new Date(parseInt(value, 10) * 1000);
  return parseTs(program && (program.end || program.stop));
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
  lastCriticalWarning: 0,
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
  clearSubtitleCaches: function () {
    var removed = 0;
    try {
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var key = localStorage.key(i);
        if (key && /^iptv\.account\.[^.]+\.subtitleCache$/.test(key)) {
          localStorage.removeItem(key); removed++;
        }
      }
    } catch (e) { }
    try { if (typeof SubtitleCache !== 'undefined') SubtitleCache.data = {}; } catch (e2) { }
    return removed;
  },
  setCritical: function (key, val) {
    if (this.set(key, val)) return true;
    /* Altyazi onbellegi yeniden uretilebilir; ayar, favori ve izleme
       konumundan once vazgecilecek ilk veri odur. */
    this.clearSubtitleCaches();
    if (this.set(key, val)) return true;
    var now = Date.now();
    if (now - this.lastCriticalWarning > 30000) {
      this.lastCriticalWarning = now;
      try {
        if (typeof Diag !== 'undefined') Diag.add('Kritik veri kaydedilemedi: ' + key);
        if (typeof UI !== 'undefined') UI.toast('Depolama dolu · bazı tercihler kaydedilemedi', 4500);
      } catch (e) { }
    }
    return false;
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
  setCritical: function (key, value) { var k = this.key(key); return k ? Store.setCritical(k, value) : false; },
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
    try { VodPrefs.data = null; } catch (e) { }
    try { WatchState.data = null; } catch (e) { }
    try { EpisodeSources.data = null; } catch (e) { }
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
    railLabels: true, epg: true, liveAspect: 'auto', aspect: 'auto', subtitleSize: 'normal',
    subtitleColor: 'white', subtitleBackground: 'shadow', subtitlePosition: 'bottom',
    nextEpisodeAutoplay: true, includeAdultSearch: false,
    preferredAudio: 'auto', preferredSubtitle: 'off', avplayCompatibility: 'auto',
    tmdbCredential: '', uiLanguage: 'auto', languageChosen: false,
    contentRegion: 'auto', startupScreen: 'home', settingsVersion: 10
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
    if (this.data.settingsVersion < 5) {
      if (this.data.aspect === 'fullscreen') this.data.aspect = 'ratio16x9';
      else if (this.data.aspect === 'letterbox') this.data.aspect = 'auto';
      if (!this.data.liveAspect) this.data.liveAspect = 'auto';
      this.data.settingsVersion = 5;
    }
    if (this.data.settingsVersion < 6) {
      if (!this.data.avplayCompatibility) this.data.avplayCompatibility = 'auto';
      this.data.settingsVersion = 6;
    }
    /* v1.17.1 ara surumundeki deneysel duraklat/yeniden-ac seceneklerini
       dogrulanan kesintisiz eski-TV yontemine tasi. */
    if (this.data.settingsVersion < 7) {
      if (this.data.avplayCompatibility === 'legacyPause' || this.data.avplayCompatibility === 'legacyReload') {
        this.data.avplayCompatibility = 'legacySync';
      }
      this.data.settingsVersion = 7;
    }
    /* Public pakette kullanici kendi TMDb API anahtarini veya okuma jetonunu
       girebilir. Bu tercih IPTV hesabindan bagimsiz, televizyon geneline aittir. */
    if (this.data.settingsVersion < 8) {
      if (!this.data.tmdbCredential) this.data.tmdbCredential = '';
      this.data.settingsVersion = 8;
    }
    /* Arayuz dili ile TMDb platform bolgesi birbirinden bagimsizdir. Mevcut
       kurulumlar guncelleme sonrasinda ilk-kurulum ekranina zorlanmaz. */
    if (this.data.settingsVersion < 9) {
      if (!this.data.uiLanguage) this.data.uiLanguage = 'auto';
      if (!this.data.contentRegion) this.data.contentRegion = 'auto';
      var existing = Store.get('accounts', null), legacyCreds = Store.get('creds', null);
      if (this.data.languageChosen == null) {
        this.data.languageChosen = !!((existing && existing.items && existing.items.length) || legacyCreds);
      }
      this.data.settingsVersion = 9;
    }
    /* Uygulama girisinden sonra acilacak ana bolum. Eski kurulumlar davranis
       degistirmeden Ana Sayfa ile devam eder. */
    if (this.data.settingsVersion < 10) {
      if (!this.data.startupScreen) this.data.startupScreen = 'home';
      this.data.settingsVersion = 10;
    }
    for (var k in this.defaults) {
      if (!Object.prototype.hasOwnProperty.call(this.data, k)) this.data[k] = this.defaults[k];
    }
    Store.setCritical('settings', this.data);
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
    AccountData.setCritical('providerSettings', values);
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
      AccountData.setCritical('providerSettings', this.accountData);
      return;
    }
    this.data[k] = v; Store.setCritical('settings', this.data);
  }
};

/* Favoriler: kimlik dizileri geriye uyumluluk icin korunur. meta alani ana
   sayfanin hic oynatilmamis favorileri de katalog indirmeden gostermesini saglar. */
var Favs = {
  data: null,
  save: function () {
    return AccountData.setCritical('fav', this.data);
  },
  load: function () {
    this.data = AccountData.get('fav', null) || { live: [], movie: [], series: [] };
    if (!this.data.live) this.data.live = [];
    if (!this.data.movie) this.data.movie = [];
    if (!this.data.series) this.data.series = [];
    if (!this.data.meta || typeof this.data.meta !== 'object') this.data.meta = {};
    return this.data;
  },
  metaKey: function (kind, id) { return String(kind) + ':' + String(id); },
  summary: function (kind, id, item) {
    item = item || {};
    return {
      id: String(id), kind: kind,
      name: item.name || item.title || '',
      icon: item.stream_icon || item.cover || item.movie_image || '',
      ts: Date.now()
    };
  },
  remember: function (kind, id, item, touch) {
    if (!this.data) this.load();
    if (id == null || !this.data[kind]) return false;
    var key = this.metaKey(kind, id), old = this.data.meta[key], next = this.summary(kind, id, item);
    if (old && touch === false) next.ts = old.ts || next.ts;
    if (old) {
      if (!next.name) next.name = old.name || '';
      if (!next.icon) next.icon = old.icon || '';
    }
    if (old && old.name === next.name && old.icon === next.icon && old.ts === next.ts) return false;
    this.data.meta[key] = next;
    this.save();
    return true;
  },
  info: function (kind, id) {
    if (!this.data) this.load();
    return this.data.meta[this.metaKey(kind, id)] || null;
  },
  has: function (kind, id) {
    if (!this.data) this.load();
    return this.data[kind].indexOf(String(id)) !== -1;
  },
  toggle: function (kind, id, item) {
    if (!this.data) this.load();
    if (id == null || !this.data[kind]) return false;
    id = String(id);
    var i = this.data[kind].indexOf(id);
    if (i === -1) {
      this.data[kind].push(id);
      this.data.meta[this.metaKey(kind, id)] = this.summary(kind, id, item);
    } else {
      this.data[kind].splice(i, 1);
      delete this.data.meta[this.metaKey(kind, id)];
    }
    this.save();
    return i === -1;
  },
  moveLive: function (from, to) {
    if (!this.data) this.load();
    var list = this.data.live;
    from = parseInt(from, 10); to = parseInt(to, 10);
    if (isNaN(from) || isNaN(to) || from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return false;
    var item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    this.save();
    return true;
  },
  setLiveOrder: function (ids) {
    if (!this.data) this.load();
    this.data.live = (ids || []).map(function (id) { return String(id); });
    this.save();
  },
  list: function (kind) { if (!this.data) this.load(); return this.data[kind]; },
  home: function (recent, limit) {
    if (!this.data) this.load();
    recent = recent || []; limit = limit || 6;
    var fallbacks = {}, out = [], kinds = ['movie', 'series'];
    for (var r = 0; r < recent.length; r++) {
      var row = recent[r], raw = row && row.raw;
      if (!raw || kinds.indexOf(row.kind) === -1) continue;
      var rid = row.kind === 'movie' ? raw.stream_id : raw.series_id;
      fallbacks[this.metaKey(row.kind, rid)] = raw;
    }
    for (var k = 0; k < kinds.length; k++) {
      var kind = kinds[k], ids = this.data[kind] || [];
      for (var i = 0; i < ids.length; i++) {
        var key = this.metaKey(kind, ids[i]), meta = this.data.meta[key], rawItem = fallbacks[key];
        if (!meta && rawItem) meta = this.summary(kind, ids[i], rawItem);
        if (!meta || !meta.name) continue;
        out.push({ kind: kind, raw: rawItem || {
          name: meta.name,
          stream_id: kind === 'movie' ? ids[i] : undefined,
          series_id: kind === 'series' ? ids[i] : undefined,
          stream_icon: meta.icon,
          cover: meta.icon
        }, name: meta.name, icon: meta.icon || '', sub: kind === 'movie' ? 'Film' : 'Dizi', ts: meta.ts || 0 });
      }
    }
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out.slice(0, limit);
  }
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
    AccountData.setCritical('resume', this.data);
  },
  remove: function (kind, id) {
    if (!this.data) this.load();
    delete this.data[this.key(kind, id)];
    AccountData.setCritical('resume', this.data);
  },
  clear: function () { this.data = {}; AccountData.setCritical('resume', {}); }
};

/* Film ve dizi kutuphanelerinin gorunum/siralama tercihleri hesap bazinda,
   birbirinden bagimsiz saklanir. */
var VodPrefs = {
  data: null,
  defaults: { view: 'card', sort: 'provider', filter: 'all' },
  load: function () {
    this.data = AccountData.get('vodPrefs', null) || {};
    return this.data;
  },
  get: function (kind) {
    if (!this.data) this.load();
    var saved = this.data[kind] || {}, out = {}, key;
    for (key in this.defaults) out[key] = saved[key] || this.defaults[key];
    return out;
  },
  set: function (kind, key, value) {
    if (!this.data) this.load();
    if (!this.data[kind]) this.data[kind] = {};
    this.data[kind][key] = value;
    AccountData.set('vodPrefs', this.data);
  }
};

/* Film ve dizi aramalarinin son besi hesap bazinda saklanir. */
var VodSearchHistory = {
  data: null,
  load: function () {
    this.data = AccountData.get('vodSearchHistory', null) || { movie: [], series: [] };
    if (!(this.data.movie instanceof Array)) this.data.movie = [];
    if (!(this.data.series instanceof Array)) this.data.series = [];
    return this.data;
  },
  list: function (kind) { if (!this.data) this.load(); return this.data[kind].slice(0, 5); },
  add: function (kind, value) {
    if (!this.data) this.load();
    value = String(value || '').trim(); if (!value) return;
    var rows = [], normalized = norm(value);
    for (var i = 0; i < this.data[kind].length; i++) if (norm(this.data[kind][i]) !== normalized) rows.push(this.data[kind][i]);
    rows.unshift(value); this.data[kind] = rows.slice(0, 5); AccountData.set('vodSearchHistory', this.data);
  },
  clear: function (kind) {
    if (!this.data) this.load(); this.data[kind] = []; AccountData.set('vodSearchHistory', this.data);
  }
};

/* Kutuphane puani saglayicinin Xtream listesinden gelir; burada TMDb istegi
   yapilmaz. rating 10, rating_5based 5 uzerinden kabul edilir. Sifir ve
   gecersiz degerler "puan yok" sayilir. */
var ProviderRating = {
  info: function (item) {
    item = item || {};
    var raw = parseFloat(String(item.rating == null ? '' : item.rating).replace(',', '.'));
    var scale = 10;
    if (!(raw > 0 && raw <= 10)) {
      raw = parseFloat(String(item.rating_5based == null ? '' : item.rating_5based).replace(',', '.'));
      scale = 5;
    }
    if (!(raw > 0 && raw <= scale)) return null;
    return { value: raw, scale: scale, score: scale === 5 ? raw * 2 : raw };
  },
  text: function (item) {
    var info = this.info(item);
    if (!info) return '';
    var rounded = Math.round(info.value * 10) / 10;
    var text = String(rounded).replace('.', ',');
    return info.scale === 5 ? text + '/5' : text;
  },
  score: function (item) {
    var info = this.info(item);
    return info ? info.score : null;
  }
};

/* Sanallastirilmis VOD listesi yalnizca gorunen posterleri DOM'a ekler.
   Oturum icinde hata veren adresleri yeniden istemeyerek bos/bozuk posterlerin
   kaydirma sirasinda agi tekrar tekrar mesgul etmesini engeller. */
var PosterFailures = {
  data: {},
  has: function (url) { return !!this.data[String(url || '')]; },
  mark: function (url) { if (url) this.data[String(url)] = true; }
};

if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('error', function (event) {
  var node = event.target;
  if (!node || String(node.className || '').indexOf('vod-poster-img') === -1) return;
  PosterFailures.mark(node.getAttribute('src'));
  node.style.display = 'none';
  if (node.parentNode) node.parentNode.className += ' poster-failed';
}, true);

/* Bitmis/izlenmis durumu Resume'dan ayridir; Resume tamamlanan icerigi bilerek
   sildigi icin filtreler ve bolum isaretleri bu kalici kaydi kullanir. */
var WatchState = {
  data: null, max: 600,
  load: function () { this.data = AccountData.get('watchState', null) || {}; return this.data; },
  key: function (kind, id) { return String(kind) + ':' + String(id); },
  episodeKey: function (seriesId, season, episode) {
    return 'series:' + String(seriesId) + ':s' + String(season || 0) + 'e' + String(episode || 0);
  },
  has: function (kind, id) {
    if (!this.data) this.load();
    return !!this.data[this.key(kind, id)];
  },
  hasSeries: function (seriesId) {
    if (!this.data) this.load();
    var prefix = 'series:' + String(seriesId) + ':';
    for (var key in this.data) if (key.indexOf(prefix) === 0) return true;
    return false;
  },
  episodeWatched: function (seriesId, season, episode) {
    if (!this.data) this.load();
    return !!this.data[this.episodeKey(seriesId, season, episode)];
  },
  set: function (key, watched, name) {
    if (!this.data) this.load();
    if (watched) this.data[key] = { watched: true, name: name || '', ts: Date.now() };
    else delete this.data[key];
    var keys = Object.keys(this.data), self = this;
    if (keys.length > this.max) {
      keys.sort(function (a, b) { return (self.data[a].ts || 0) - (self.data[b].ts || 0); });
      for (var i = 0; i < keys.length - this.max; i++) delete this.data[keys[i]];
    }
    AccountData.setCritical('watchState', this.data);
  },
  setContent: function (kind, id, watched, name) { this.set(this.key(kind, id), watched, name); },
  setEpisode: function (seriesId, season, episode, watched, name) {
    this.set(this.episodeKey(seriesId, season, episode), watched, name);
  }
};

/* Dizi guncellemeleri hesap bazinda kanonik sezon/bolum anahtarlariyla izlenir.
   last_modified yalnizca ucuz bir aday sinyalidir; gercek "Yeni" isareti ancak
   detay cevabinda daha once bulunmayan bir bolum gorulurse uretilir. */
var SeriesUpdates = {
  data: null, max: 300,
  load: function () {
    this.data = AccountData.get('seriesUpdates', null) || {};
    return this.data;
  },
  lm: function (item, info) {
    var meta = (info && (info.info || info)) || {};
    return parseInt((item && item.last_modified) || meta.last_modified || 0, 10) || 0;
  },
  candidate: function (item) {
    if (!item || item.series_id == null) return false;
    if (!this.data) this.load();
    var row = this.data[String(item.series_id)], current = this.lm(item, null);
    return !!(row && row.lm && current && current > row.lm);
  },
  inspect: function (seriesId, episodeKeys, lastModified) {
    if (!this.data) this.load();
    var id = String(seriesId), row = this.data[id], now = Date.now(), i;
    var keys = {}, pending = {};
    for (i = 0; i < episodeKeys.length; i++) keys[String(episodeKeys[i])] = true;
    if (!row) {
      this.data[id] = { keys: keys, pending: {}, lm: lastModified || 0, ts: now };
      this.trim(); this.save(); return {};
    }
    row.keys = row.keys || {}; row.pending = row.pending || {};
    for (i = 0; i < episodeKeys.length; i++) {
      var key = String(episodeKeys[i]);
      if (!row.keys[key]) row.pending[key] = true;
    }
    for (var old in row.pending) {
      if (!keys[old]) delete row.pending[old];
      else {
        var match = /^s([^e]+)e(.+)$/.exec(old);
        if (match && typeof WatchState !== 'undefined' && WatchState.episodeWatched(id, match[1], match[2])) {
          delete row.pending[old];
        } else pending[old] = true;
      }
    }
    row.keys = keys; row.lm = lastModified || row.lm || 0; row.ts = now;
    this.trim(); this.save(); return pending;
  },
  trim: function () {
    var ids = Object.keys(this.data), self = this;
    if (ids.length <= this.max) return;
    ids.sort(function (a, b) { return (self.data[a].ts || 0) - (self.data[b].ts || 0); });
    for (var i = 0; i < ids.length - this.max; i++) delete this.data[ids[i]];
  },
  save: function () { AccountData.set('seriesUpdates', this.data); }
};

/* Ayni bolum icin birden cok saglayici kaydi varsa daha once calisan kaynak
   once denenir. Yalnizca kimlik tutulur; URL ve hesap bilgisi saklanmaz. */
var EpisodeSources = {
  data: null, max: 300,
  load: function () { this.data = AccountData.get('episodeSources', null) || {}; return this.data; },
  key: function (seriesId, season, episode) {
    return String(seriesId) + ':s' + String(season || 0) + 'e' + String(episode || 0);
  },
  preferred: function (seriesId, season, episode) {
    if (!this.data) this.load();
    var item = this.data[this.key(seriesId, season, episode)];
    return item ? String(item.id) : '';
  },
  note: function (seriesId, season, episode, id) {
    if (!this.data) this.load();
    this.data[this.key(seriesId, season, episode)] = { id: String(id), ts: Date.now() };
    var keys = Object.keys(this.data), self = this;
    if (keys.length > this.max) {
      keys.sort(function (a, b) { return (self.data[a].ts || 0) - (self.data[b].ts || 0); });
      for (var i = 0; i < keys.length - this.max; i++) delete this.data[keys[i]];
    }
    AccountData.set('episodeSources', this.data);
  }
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
    AccountData.setCritical('recent', this.data);
  },
  remove: function (kind, id) {
    if (!this.data) this.load();
    var key = String(kind) + ':' + String(id), next = [];
    for (var i = 0; i < this.data.length; i++) {
      if (this.key(this.data[i]) !== key) next.push(this.data[i]);
    }
    this.data = next;
    AccountData.setCritical('recent', this.data);
  },
  clear: function () { this.data = []; AccountData.setCritical('recent', []); }
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

/* Oynaticilarin bildirdigi parca dillerini icerik bazinda birlestirir. HTML5
   veya TX3G incelemesinde ogrenilen adlar daha sonra AVPlay'in eksik
   metadata'sini tamamlar; medya baglantisi acmaz ve sifre/URL saklamaz. */
var TrackLabels = {
  data: null,
  max: 160,
  load: function () {
    this.data = AccountData.get('trackLabels', null) || {};
    if (!this.data || typeof this.data !== 'object') this.data = {};
    return this.data;
  },
  get: function (contentKey) {
    if (!contentKey) return null;
    if (!this.data) this.load();
    var item = this.data[String(contentKey)];
    if (item) item.used = Date.now();
    return item || null;
  },
  set: function (contentKey, audio, text) {
    if (!contentKey) return;
    if (!this.data) this.load();
    var key = String(contentKey), old = this.data[key] || { audio: [], text: [] };
    function merge(previous, incoming) {
      var out = (previous || []).slice(0), changed = false;
      for (var i = 0; i < (incoming || []).length; i++) {
        var lang = String(incoming[i] || 'und');
        if (lang !== 'und' && out[i] !== lang) { out[i] = lang; changed = true; }
      }
      return { values: out, changed: changed };
    }
    var a = merge(old.audio, audio), t = merge(old.text, text);
    if (!a.changed && !t.changed && this.data[key]) { this.data[key].used = Date.now(); return; }
    this.data[key] = { audio: a.values, text: t.values, used: Date.now() };
    var keys = Object.keys(this.data), self = this;
    if (keys.length > this.max) {
      keys.sort(function (x, y) { return (self.data[x].used || 0) - (self.data[y].used || 0); });
      for (var n = 0; n < keys.length - this.max; n++) delete this.data[keys[n]];
    }
    AccountData.set('trackLabels', this.data);
  },
  clear: function () { this.data = {}; AccountData.set('trackLabels', {}); }
};

/* Yazilimsal TX3G altyazilarini hesap ve icerik kimligine gore saklar.
   URL/kullanici/sifre tutulmaz. Ilerlemeli pencereler sayesinde 20 icerik bile
   eski tam-bolum onbelleginden daha az yer kaplar. */
var SubtitleCache = {
  data: null,
  max: 20,
  globalBudgetBytes: 1024 * 1024,
  load: function () {
    this.data = AccountData.get('subtitleCache', null) || {};
    if (!this.data || typeof this.data !== 'object') this.data = {};
    return this.data;
  },
  key: function (contentKey, sourceIndex) {
    return String(contentKey || '') + ':track:' + String(sourceIndex);
  },
  get: function (contentKey, sourceIndex, signature) {
    var item = this.getEntry(contentKey, sourceIndex, signature);
    return item ? item.cues : null;
  },
  getEntry: function (contentKey, sourceIndex, signature) {
    if (!contentKey) return null;
    if (!this.data) this.load();
    var key = this.key(contentKey, sourceIndex);
    var item = this.data[key];
    if (!item || item.signature !== signature || !Array.isArray(item.cues)) return null;
    item.used = Date.now();
    return { cues: item.cues, windows: Array.isArray(item.windows) ? item.windows : [] };
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
  set: function (contentKey, sourceIndex, signature, cues, windows) {
    if (!contentKey || !cues || !cues.length) return false;
    if (!this.data) this.load();
    var key = this.key(contentKey, sourceIndex);
    this.data[key] = { signature: signature, cues: cues,
      windows: Array.isArray(windows) ? windows : [], used: Date.now() };
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
  levels: [5, 8, 10],
  version: 4,
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
    return Math.min(5, Math.max(3, parseInt(playSeconds, 10) || 5));
  },

  manualLevel: function (value) {
    value = parseInt(value, 10);
    return [5, 10, 15, 20].indexOf(value) !== -1 ? value : 5;
  },

  validLevel: function (value, fallback) {
    value = parseInt(value, 10);
    return this.levels.indexOf(value) !== -1 ? value : fallback;
  },

  nextLevel: function (value) {
    var index = this.levels.indexOf(this.validLevel(value, 5));
    return index < this.levels.length - 1 ? this.levels[index + 1] : 10;
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
    if (!(record.recentStalls instanceof Array)) record.recentStalls = [];
    if (!record.votes || typeof record.votes !== 'object') record.votes = {};
    return record;
  },

  resolve: function (ctx) {
    ctx = ctx || {};
    var mode = String(Settings.get('liveBufferMode') || 'auto');

    /* HTML5 tampon boyutunu uygulamanin belirleyecegi bir API sunmaz.
       Manuel bir sure secilmis olsa bile uygulanmis gibi raporlama. */
    if (String(ctx.engine || 'avplay') !== 'avplay') {
      return { mode: 'unsupported', play: 5, resume: 5, source: 'html5' };
    }

    if (mode !== 'auto') {
      var fixed = this.manualLevel(mode);
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
    if (channel) { source = 'channel'; record = this.normalizeRecord(channel, 5); }
    else if (category) { source = 'category'; record = this.normalizeRecord(category, 5); }
    var level = record ? record.level : 5;
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
    var current = this.validLevel(profile.play, 5);
    var target = this.nextLevel(current);
    var channelId = String(ctx.channelId || '__unknown');
    var channelKey = profile.channelKey || this.channelKey(ctx);
    var categoryKey = profile.categoryKey || this.categoryKey(ctx);
    var channel = this.normalizeRecord(this.data.channels[channelKey], current);
    var category = this.normalizeRecord(this.data.categories[categoryKey], 5);

    /* Tek bir dalgalanma kalici tampon seviyesini buyutmesin. Ayni kanal on
       dakika icinde uc kez gercekten kurtarma gerektirirse ogren. */
    channel.recentStalls = channel.recentStalls.filter(function (at) { return now - at < 10 * 60 * 1000; });
    channel.recentStalls.push(now);
    channel.stalls = (channel.stalls || 0) + 1;
    channel.lastReason = String(reason || 'buffering');
    channel.updated = now;
    channel.lastUsed = now;
    this.data.channels[channelKey] = channel;
    if (channel.recentStalls.length < 3) {
      this.save();
      return null;
    }
    channel.recentStalls = [];

    channel.level = Math.max(channel.level, target);
    channel.safeFloor = Math.max(channel.safeFloor, target);
    channel.safeFloorUntil = now + this.floorTtl;
    channel.failedAt = current;
    channel.lastFailure = now;
    channel.lastReason = String(reason || 'buffering');
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
  toastTimer: null, toastLast: '', toastLastAt: 0,
  toast: function (msg, ms) {
    var t = document.getElementById('toast');
    if (!t) return;
    var now = Date.now(), value = String(msg || '');
    if (value === this.toastLast && now - this.toastLastAt < 900) return;
    this.toastLast = value; this.toastLastAt = now;
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
    this.status = { Surum: (typeof App !== 'undefined' && App.versionLabel) ? App.versionLabel : 'H&M Public', Oturum: kind + ' · ' + new Date().toISOString() };
    this.page = 0;
  },
  move: function (delta) { this.page = Math.max(0, this.page + delta); this.render(); },
  _persistTimer: null,
  flush: function () {
    if (this._persistTimer) { clearTimeout(this._persistTimer); this._persistTimer = null; }
    try { localStorage.setItem('hm.diag.last', JSON.stringify({ status: this.status, errors: this.errors })); } catch (e) { }
  },
  persist: function () {
    if (this._persistTimer) return;
    var self = this;
    this._persistTimer = setTimeout(function () { self.flush(); }, 1000);
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
    this.persist();
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

window.addEventListener('beforeunload', function () { Diag.flush(); });
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) Diag.flush();
  });
}
