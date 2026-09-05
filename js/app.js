/* app.js - yonlendirme, ekran mantigi ve oynatma katmani */
'use strict';

var App = {
  versionLabel: 'H&M.v1.15.0',
  route: null,
  history: [],
  rail: null,
  accountSwitching: false,

  /* ---------------- acilis ---------------- */

  boot: function () {
    Settings.load();
    Accounts.load();
    registerRemoteKeys();
    this.buildRail();
    var profile = Accounts.active();
    if (profile && profile.server && profile.username && profile.password) {
      this.useProfile(profile);
      UI.spin(true);
      Api.login().then(function () {
        UI.spin(false);
        Accounts.updateStatus(profile.id, Api.info, null);
        App.afterLogin();
      })['catch'](function (e) {
        UI.spin(false);
        Accounts.updateStatus(profile.id, null, e);
        Views.accounts({ standalone: true, error: e.message || 'Oturum acilamadi.' });
      });
    } else {
      AccountData.clear();
      Settings.accountData = null;
      if (Accounts.list().length) Views.accounts({ standalone: true });
      else Views.login({ add: true, initial: true });
    }
  },

  useProfile: function (profile) {
    Api.configure(profile.server, profile.username, profile.password);
    AccountData.use(profile.server, profile.username);
    Settings.bindAccount(!!profile.migrateSettings);
    if (profile.migrateSettings) Accounts.markSettingsMigrated(profile.id);
    Favs.load(); Resume.load(); Recent.load(); LiveBuffer.load();
    Diag.set('Hesap profili', AccountData.scope);
    this.refreshRailAccount();
  },

  refreshRailAccount: function () {
    var profile = Accounts.active();
    var name = document.getElementById('rail-account-name');
    if (name) name.textContent = profile ? (profile.name || profile.username) : 'Hesap secin';
  },

  saveAccountForm: function (values, info, opts) {
    opts = opts || {};
    try {
      var profile;
      if (opts.accountId) profile = Accounts.update(opts.accountId, values, info);
      else profile = Accounts.add(values, info);

      var active = Accounts.active();
      if (!active || (opts.accountId && active.id === opts.accountId)) {
        Accounts.setActive(profile.id);
        window.location.reload();
        return;
      }
      this.go('accounts');
      UI.toast('Hesap kaydedildi. Gecmek icin hesabi secin.');
    } catch (e) {
      UI.spin(false);
      var err = document.getElementById('f-err');
      if (err) err.textContent = e.message || 'Hesap kaydedilemedi.';
    }
  },

  switchAccount: function (id) {
    if (this.accountSwitching) return;
    var profile = Accounts.byId(id), active = Accounts.active();
    if (!profile) return;
    if (active && active.id === profile.id && Api.info) { UI.toast('Bu hesap zaten aktif.'); return; }
    this.accountSwitching = true;
    Player.stop();
    UI.spin(true);
    var self = this;
    setTimeout(function () {
      Api.validateCredentials(profile.server, profile.username, profile.password).then(function (info) {
        Accounts.updateStatus(profile.id, info, null);
        Accounts.setActive(profile.id);
        window.location.reload();
      })['catch'](function (e) {
        self.accountSwitching = false;
        UI.spin(false);
        Accounts.updateStatus(profile.id, null, e);
        Views.accounts({ standalone: !Api.info, error: e.message || 'Hesaba gecilemedi.' });
      });
    }, 650);
  },

  testAccount: function (id) {
    if (this.accountSwitching) return;
    var profile = Accounts.byId(id); if (!profile) return;
    this.accountSwitching = true; UI.spin(true);
    var self = this;
    Api.validateCredentials(profile.server, profile.username, profile.password).then(function (info) {
      self.accountSwitching = false; UI.spin(false);
      Accounts.updateStatus(profile.id, info, null);
      Views.accounts({ standalone: !Api.info });
      UI.toast('Baglanti basarili.');
    })['catch'](function (e) {
      self.accountSwitching = false; UI.spin(false);
      Accounts.updateStatus(profile.id, null, e);
      Views.accounts({ standalone: !Api.info, error: e.message || 'Baglanti kurulamadi.' });
    });
  },

  removeAccount: function (id) {
    var profile = Accounts.byId(id); if (!profile) return;
    var self = this;
    this.confirmDialog('Profil kaldirilsin mi?',
      'Bu islem aboneliginizi sunucudan silmez; yalnizca bu televizyondaki profili ve yerel verilerini kaldirir.',
      'Profili kaldir', function () {
        var wasActive = Accounts.active() && Accounts.active().id === id;
        Player.stop(); Accounts.remove(id);
        if (wasActive) {
          Api.configure('', '', ''); Api.info = null; AccountData.clear(); Settings.accountData = null;
          if (!Accounts.list().length) Views.login({ add: true, initial: true });
          else Views.accounts({ standalone: true });
        } else {
          Views.accounts({ standalone: !Api.info });
          UI.toast('Profil kaldirildi.');
        }
        self.refreshRailAccount();
      });
  },

  afterLogin: function () {
    document.getElementById('rail').className = Settings.get('railLabels') ? '' : '';
    this.history = [];
    this.go('live');
  },

  /* ---------------- sol serit ---------------- */

  railDefs: [
    { id: 'live', ic: 'live', tx: 'Canli TV' },
    { id: 'movies', ic: 'movies', tx: 'Filmler' },
    { id: 'series', ic: 'series', tx: 'Diziler' },
    { id: 'favs', ic: 'favs', tx: 'Favoriler' },
    { id: 'recent', ic: 'recent', tx: 'Son İzlediklerim' },
    { id: 'settings', ic: 'settings', tx: 'Ayarlar' },
    { id: 'about', ic: 'about', tx: 'Hakkında' }
  ],

  buildRail: function () {
    var wrap = document.getElementById('rail');
    wrap.innerHTML = '';
    var nodes = [];
    for (var i = 0; i < this.railDefs.length; i++) {
      var d = this.railDefs[i];
      var n = el('div', 'rail-item',
        '<span class="ic">' + uiIcon(d.ic) + '</span><span class="tx">' + d.tx + '</span>');
      wrap.appendChild(n);
      nodes.push(n);
    }
    var spacer = el('div', ''); spacer.id = 'rail-spacer';
    wrap.appendChild(spacer);
    var active = Accounts.active();
    var account = el('div', 'rail-account', uiIcon('account') +
      '<span id="rail-account-name">' + esc(active ? (active.name || active.username) : 'Hesap secin') + '</span>');
    wrap.appendChild(account);
    var version = el('div', 'rail-version', esc(this.versionLabel));
    wrap.appendChild(version);

    var self = this;
    this.rail = new Stack({
      id: 'rail', nodes: nodes,
      neighbors: { right: function () { return self.firstZoneOfScreen(); } },
      onSelect: function (n, i) { self.go(self.railDefs[i].id); }
    });

    /* serit odaktayken genisler */
    var origSetFocused = this.rail.setFocused;
    this.rail.setFocused = function (on) {
      wrap.className = on ? 'wide' : '';
      origSetFocused.call(this, on);
    };
  },

  firstZoneOfScreen: function () {
    var s = Nav.screen;
    if (!s) return null;
    var order = ['cats', 'profiles', 'actions', 'list', 'btns', 'bar', 'seasons', 'grid', 'chans'];
    for (var i = 0; i < order.length; i++) if (s.zones[order[i]]) return order[i];
    return null;
  },

  markRail: function (id) {
    for (var i = 0; i < this.railDefs.length; i++) {
      var n = this.rail.nodes[i];
      n.className = 'rail-item' + (this.railDefs[i].id === id ? ' current' : '');
    }
    var idx = -1;
    for (var j = 0; j < this.railDefs.length; j++) if (this.railDefs[j].id === id) idx = j;
    if (idx >= 0) this.rail.index = idx;
  },

  /* ---------------- yonlendirme ---------------- */

  go: function (name, opts) {
    if (Playback.mode === 'live') Playback.exit();
    document.getElementById('rail').className = '';
    if (name !== 'detail') {
      this.route = name === 'accounts' ? 'settings' : name;
      this.markRail(name === 'accounts' ? 'settings' : name);
      this.history = [];
    }
    if (Views[name]) Views[name](opts);
  },

  push: function (fn) { this.history.push(fn); },

  back: function () {
    if (this.history.length) {
      var f = this.history.pop();
      f();
    } else {
      this.go(this.route || 'live');
    }
  },

  backToRailOrExit: function () {
    if (Playback.previewOn && Nav.zone && Nav.zone.id === 'chans') { Nav.focus('cats'); return; }
    if (Nav.zone === this.rail) this.confirmExit();
    else Nav.focus('rail');
  },

  confirmExit: function () {
    if (this._exitPromptOn) return;
    this._exitPromptOn = true;
    var ov = document.getElementById('overlay');
    ov.className = 'on';
    ov.innerHTML = '<div class="exit-confirm"><div class="exit-box">' +
      '<div class="exit-title">H&amp;M Player kapatilsin mi?</div>' +
      '<div class="exit-sub">OK: Cikis yap&nbsp;&nbsp;&nbsp; Geri: Iptal</div>' +
      '<div class="exit-actions"><div class="btn primary focus">Cikis yap</div>' +
      '<div class="btn">Iptal</div></div></div></div>';
    var self = this;
    Nav.setOverlay(function (e) {
      var c = e.keyCode;
      e.preventDefault();
      if (c === KEY.ENTER) {
        self.closeExitPrompt();
        try { tizen.application.getCurrentApplication().exit(); }
        catch (err) { try { window.close(); } catch (err2) { } }
      } else if (c === KEY.BACK || c === KEY.ESC) {
        self.closeExitPrompt();
      }
    });
  },

  confirmDialog: function (title, message, okLabel, onConfirm) {
    if (this._exitPromptOn) return;
    this._exitPromptOn = true;
    var ov = document.getElementById('overlay');
    ov.className = 'on';
    ov.innerHTML = '<div class="exit-confirm"><div class="exit-box">' +
      '<div class="exit-title">' + esc(title) + '</div>' +
      '<div class="exit-sub">' + esc(message) + '<br><br>OK: ' + esc(okLabel) + '&nbsp;&nbsp;&nbsp; Geri: Iptal</div>' +
      '<div class="exit-actions"><div class="btn primary focus">' + esc(okLabel) + '</div>' +
      '<div class="btn">Iptal</div></div></div></div>';
    var self = this;
    Nav.setOverlay(function (e) {
      var c = e.keyCode; e.preventDefault();
      if (c === KEY.ENTER) {
        self.closeExitPrompt();
        if (onConfirm) onConfirm();
      } else if (c === KEY.BACK || c === KEY.ESC) self.closeExitPrompt();
    });
  },

  closeExitPrompt: function () {
    if (!this._exitPromptOn) return;
    this._exitPromptOn = false;
    var ov = document.getElementById('overlay');
    ov.className = '';
    ov.innerHTML = '';
    Nav.clearOverlay();
  },

  /* =============================== CANLI TV =============================== */

  live: {
    cats: null, chans: null, currentCat: null,
    catTimer: null, epgTimer: null, numBuf: '', numTimer: null,
    searchInput: null, searchQuery: '', searchTimer: null, searchToken: 0,
    dailyEpg: null, dailyIndex: 0, dailyChannel: null,

    previewHelpHtml: function () {
      return Player.pick(true) === 'html5'
        ? 'OK: Kanalı burada ön izle'
        : '<b>AVPlay küçük ön izlemeyi desteklemiyor.</b><br>Ön izleme için Ayarlar &gt; Canlı TV oynatıcısı &gt; HTML5 seçin.<br><em>OK: Tam ekran aç</em>';
    },

    resetSearch: function () {
      if (this.catTimer) clearTimeout(this.catTimer);
      if (this.epgTimer) clearTimeout(this.epgTimer);
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.currentCat = null;
      this.searchQuery = '';
      this.searchToken++;
      if (this.searchInput) this.searchInput.value = '';
      var state = document.getElementById('lv-search-state');
      if (state) state.textContent = '';
    },

    search: function (value) {
      var self = this;
      var raw = String(value || '').trim();
      var q = norm(raw).trim();
      var state = document.getElementById('lv-search-state');
      if (this.searchTimer) clearTimeout(this.searchTimer);

      if (q.length < 3) {
        var wasSearching = this.searchQuery.length >= 3;
        this.searchQuery = '';
        this.searchToken++;
        if (state) state.textContent = q.length ? (3 - q.length) + ' harf daha yazin' : '';
        if (wasSearching && this.currentCat) this._doLoad(this.currentCat);
        return;
      }

      this.searchQuery = q;
      if (this.catTimer) clearTimeout(this.catTimer);
      var token = ++this.searchToken;
      if (state) state.textContent = 'Araniyor...';
      this.searchTimer = setTimeout(function () {
        UI.spin(true);
        Api.liveStreams('').then(function (all) {
          UI.spin(false);
          if (token !== self.searchToken || self.searchQuery !== q) return;
          if (self.searchInput !== document.getElementById('lv-search')) return;
          var out = [];
          for (var i = 0; i < all.length; i++) {
            if (norm(all[i].name).indexOf(q) !== -1) out.push(all[i]);
          }
          self.chans.emptyText = 'Aramanizla eslesen kanal bulunamadi';
          self.chans.setItems(out);
          var title = document.getElementById('lv-title');
          var count = document.getElementById('lv-count');
          if (title) title.textContent = 'Arama: ' + raw;
          if (count) count.textContent = out.length + ' kanal';
          if (state) state.textContent = out.length + ' sonuc';
        })['catch'](function (e) {
          UI.spin(false);
          if (token !== self.searchToken) return;
          if (state) state.textContent = 'Arama yapilamadi';
          UI.toast(e.message || 'Arama yapilamadi', 3500);
        });
      }, 220);
    },

    init: function () {
      var self = this;
      UI.spin(true);
      Api.liveCategories().then(function (list) {
        UI.spin(false);
        list = CategoryVisibility.visibleList('live', list);
        var all = [{ category_id: '__fav', category_name: 'Favoriler' },
        { category_id: '__all', category_name: 'Tum kanallar' }].concat(list);
        self.cats.setItems(all);

        /* Acilista bos "Favoriler" kategorisinde kalmayalim:
           son kullanilan kategoriye, yoksa ilk gercek kategoriye git. */
        var start = 0, i;
        var last = AccountData.get('lastLiveCat', null);
        var found = -1;
        if (last != null) {
          for (i = 0; i < all.length; i++) if (String(all[i].category_id) === String(last)) found = i;
        }
        if (found >= 0) start = found;
        else if (!Favs.list('live').length) start = Math.min(2, all.length - 1);
        if (start > 0) self.cats.jumpTo(start);
      })['catch'](function (e) {
        UI.spin(false);
        UI.toast(e.message || 'Kategoriler alinamadi', 4000);
        Diag.add('liveCategories: ' + e.message);
      });
    },

    loadCategory: function (cat) {
      var self = this;
      if (this.searchQuery.length >= 3) return;
      if (this.catTimer) clearTimeout(this.catTimer);
      this.currentCat = cat;
      this.catTimer = setTimeout(function () { self._doLoad(cat); }, 260);
    },

    _doLoad: function (cat) {
      var self = this;
      if (!cat || this.searchQuery.length >= 3) return;
      AccountData.set('lastLiveCat', cat.category_id);
      document.getElementById('lv-title').textContent = cat.category_name;
      document.getElementById('lv-count').textContent = '';
      UI.spin(true);

      var p;
      if (cat.category_id === '__fav' || cat.category_id === '__all') p = Api.liveStreams('');
      else p = Api.liveStreams(cat.category_id);

      p.then(function (items) {
        UI.spin(false);
        if (self.currentCat !== cat || self.searchQuery.length >= 3) return;
        if (cat.category_id === '__fav') {
          var favIds = Favs.list('live');
          var byId = {};
          for (var f = 0; f < items.length; f++) byId[String(items[f].stream_id)] = items[f];
          var ordered = [];
          for (var o = 0; o < favIds.length; o++) if (byId[favIds[o]]) ordered.push(byId[favIds[o]]);
          items = ordered;
        }
        self.chans.emptyText = cat.category_id === '__fav'
          ? 'Favori kanal yok.\nKanal listesinde sari tusla ekleyin.'
          : 'Bu kategoride kanal yok';
        self.chans.setItems(items);
        var lastChannel = AccountData.get('lastLiveChannel', null);
        if (lastChannel && String(lastChannel.categoryId) === String(cat.category_id)) {
          for (var c = 0; c < items.length; c++) {
            if (String(items[c].stream_id) === String(lastChannel.streamId)) {
              self.chans.jumpTo(c); break;
            }
          }
        }
        document.getElementById('lv-count').textContent = items.length + ' kanal';
      })['catch'](function (e) {
        UI.spin(false);
        UI.toast(e.message || 'Kanallar alinamadi', 4000);
        Diag.add('liveStreams: ' + e.message);
      });
    },

    showEpg: function (ch) {
      var box = document.getElementById('lv-info');
      if (!box) return;
      if (!ch) { box.innerHTML = '<div class="empty">Kanal secin</div>'; return; }
      box.innerHTML = '<div class="page-sub">Listede seçili kanal</div><h2>' + esc(ch.name) + '</h2>' +
        '<div id="epg-slot"><div class="page-sub">Yayin akisi yukleniyor...</div></div>';

      if (!Settings.get('epg')) { document.getElementById('epg-slot').innerHTML = ''; return; }

      var self = this;
      if (this.epgTimer) clearTimeout(this.epgTimer);
      this.epgTimer = setTimeout(function () { self._fetchEpg(ch); }, 450);
    },

    _fetchEpg: function (ch) {
      var self = this;
      Api.shortEpg(ch.stream_id, 2).then(function (list) {
        var slot = document.getElementById('epg-slot');
        if (!slot) return;
        if (self.chans.items[self.chans.index] !== ch) return;
        if (!list || !list.length) { slot.innerHTML = '<div class="page-sub">Yayin akisi bilgisi yok</div>'; return; }
        slot.innerHTML = self.epgHtml(list);
      })['catch'](function () {
        var slot = document.getElementById('epg-slot');
        if (self.chans.items[self.chans.index] !== ch) return;
        if (slot) slot.innerHTML = '<div class="page-sub">Yayin akisi alinamadi</div>';
      });
    },

    epgHtml: function (list) {
      if (!list || !list.length) return '<div class="page-sub">Yayın akışı bilgisi yok</div>';
      return '<div class="live-schedule">' + list.slice(0, 2).map(function (program, i) {
        return '<div class="live-program"><div class="live-program-time">' +
          (i ? 'Sıradaki' : 'Şimdi') + ' · ' + hhmm(parseTs(program.start)) + ' – ' +
          hhmm(parseTs(program.end || program.stop)) + '</div><div class="live-program-title">' +
          esc(b64(program.title) || 'Program adı belirtilmemiş') + '</div></div>';
      }).join('') + '</div>';
    },

    openDailyEpg: function (ch) {
      if (!ch) return;
      if (!Settings.get('epg')) { UI.toast('Yayin akisi ayarlardan kapali'); return; }
      this.dailyChannel = ch; this.dailyEpg = null; this.dailyIndex = 0;
      var overlay = document.getElementById('overlay');
      overlay.className = 'on';
      overlay.innerHTML = '<div class="daily-epg"><div class="daily-title">Bugünkü yayın akışı</div>' +
        '<div class="daily-channel">' + esc(ch.name) + '</div><div class="daily-loading">Yükleniyor...</div></div>';
      var self = this;
      Nav.setOverlay(function (e) {
        e.preventDefault();
        if (e.keyCode === KEY.UP) self.moveDailyEpg(-1);
        else if (e.keyCode === KEY.DOWN) self.moveDailyEpg(1);
        else if (e.keyCode === KEY.CH_UP) self.moveDailyEpg(-8);
        else if (e.keyCode === KEY.CH_DOWN) self.moveDailyEpg(8);
        else if (e.keyCode === KEY.BACK || e.keyCode === KEY.ESC || e.keyCode === KEY.LEFT) self.closeDailyEpg();
      });
      Api.shortEpg(ch.stream_id, 100).then(function (list) {
        if (self.dailyChannel !== ch) return;
        var today = new Date(), filtered = [];
        for (var i = 0; i < list.length; i++) {
          var when = parseTs(list[i].start);
          if (when && when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth() &&
            when.getDate() === today.getDate()) filtered.push(list[i]);
        }
        self.dailyEpg = filtered.length ? filtered : list;
        var now = Date.now();
        for (var n = 0; n < self.dailyEpg.length; n++) {
          var end = parseTs(self.dailyEpg[n].end || self.dailyEpg[n].stop);
          if (end && end.getTime() >= now) { self.dailyIndex = n; break; }
        }
        self.renderDailyEpg();
      })['catch'](function (e) {
        if (self.dailyChannel !== ch) return;
        self.dailyEpg = [];
        self.renderDailyEpg(e.message || 'Yayın akışı alınamadı');
      });
    },

    renderDailyEpg: function (error) {
      var overlay = document.getElementById('overlay');
      if (!this.dailyChannel || !overlay) return;
      var list = this.dailyEpg || [], visible = 10;
      var first = Math.max(0, this.dailyIndex - Math.floor(visible / 2));
      first = Math.min(first, Math.max(0, list.length - visible));
      var h = '<div class="daily-epg"><div class="daily-title">Bugünkü yayın akışı</div>' +
        '<div class="daily-channel">' + esc(this.dailyChannel.name) + '</div><div class="daily-list">';
      if (error || !list.length) h += '<div class="daily-empty">' + esc(error || 'Bugün için yayın akışı bulunamadı') + '</div>';
      for (var i = first; i < Math.min(list.length, first + visible); i++) {
        var item = list[i], cls = 'daily-row' + (i === this.dailyIndex ? ' selected' : '');
        h += '<div class="' + cls + '"><div class="daily-time">' + hhmm(parseTs(item.start)) + ' – ' +
          hhmm(parseTs(item.end || item.stop)) + '</div><div class="daily-program">' +
          esc(b64(item.title) || 'Program adı belirtilmemiş') + '</div></div>';
      }
      h += '</div><div class="daily-help">↑↓ Programlar · Kanal tuşları: Sayfa · Geri: Kapat</div></div>';
      overlay.innerHTML = h;
    },

    moveDailyEpg: function (delta) {
      if (!this.dailyEpg || !this.dailyEpg.length) return;
      this.dailyIndex = Math.max(0, Math.min(this.dailyEpg.length - 1, this.dailyIndex + delta));
      this.renderDailyEpg();
    },

    closeDailyEpg: function () {
      this.dailyChannel = null; this.dailyEpg = null; this.dailyIndex = 0;
      var overlay = document.getElementById('overlay');
      overlay.className = ''; overlay.innerHTML = '';
      Nav.clearOverlay();
    },

    numberJump: function (digit) {
      var self = this;
      this.numBuf += String(digit);
      UI.toast('Kanal ' + this.numBuf, 1800);
      if (this.numTimer) clearTimeout(this.numTimer);
      this.numTimer = setTimeout(function () {
        var target = self.numBuf; self.numBuf = '';
        for (var i = 0; i < self.chans.items.length; i++) {
          if (String(self.chans.items[i].num) === target) {
            Nav.focus('chans');
            self.chans.jumpTo(i);
            return;
          }
        }
        UI.toast('Kanal ' + target + ' bulunamadi');
      }, 1600);
    },

    open: function (index) {
      var ch = this.chans.items[index];
      if (Playback.previewOn && Player.playing && !Player._failed && Playback.channels && Playback.channels[Playback.index] &&
        String(Playback.channels[Playback.index].stream_id) === String(ch.stream_id)) {
        Playback.fullscreenPreview(); return;
      }
      var canPreview = Player.pick(true) === 'html5';
      Playback.startLive(this.chans.items, index, {
        preview: canPreview,
        categoryId: this.currentCat ? this.currentCat.category_id : '__mixed',
        categoryName: this.currentCat ? this.currentCat.category_name : 'Kanallar'
      });
    }
  },

  /* =============================== FILM / DIZI =============================== */

  vod: {
    movie: null, series: null
  },

  /* =============================== DETAY =============================== */

  detail: {
    open: function (kind, item) {
      var route = App.route;
      var vodRoute = kind === 'movie' ? 'movies' : 'series';
      if (route === vodRoute && App.vod[kind]) App.vod[kind].remember();
      var back = (function (r, k, restore) {
        return function () { App.go(r, restore ? { restoreVod: k } : null); };
      })(route, kind, route === vodRoute);
      UI.spin(true);
      var p = kind === 'movie' ? Api.vodInfo(item.stream_id) : Api.seriesInfo(item.series_id);
      p.then(function (info) {
        UI.spin(false);
        App.history = [back];
        Views.detail(kind, item, info);
      })['catch'](function (e) {
        UI.spin(false);
        App.history = [back];
        Views.detail(kind, item, null);
        Diag.add('detay bilgisi alinamadi: ' + e.message);
      });
    },

    playMovie: function (item, info, startAt) {
      var ext = 'mp4';
      if (info && info.movie_data && info.movie_data.container_extension) ext = info.movie_data.container_extension;
      Recent.add({
        kind: 'movie', id: item.stream_id, name: item.name,
        icon: item.stream_icon || (info && info.info && (info.info.movie_image || info.info.cover_big)) || '',
        raw: item
      });
      Playback.startVod({
        url: Api.movieUrl(item.stream_id, ext),
        name: item.name,
        kind: 'movie',
        id: item.stream_id,
        extension: ext,
        startAt: startAt || 0
      });
    },

    playEpisode: function (series, ep) {
      var ext = ep.container_extension || 'mp4';
      var r = Resume.get('ep', ep.id);
      Recent.add({
        kind: 'series', id: series.series_id, name: series.name,
        icon: series.cover || '', raw: series,
        episodeId: ep.id, episodeTitle: ep.title || ('Bolum ' + ep.episode_num)
      });
      Playback.startVod({
        url: Api.episodeUrl(ep.id, ext),
        name: series.name + ' - ' + (ep.title || ('Bolum ' + ep.episode_num)),
        kind: 'ep',
        id: ep.id,
        seriesId: series.series_id,
        extension: ext,
        startAt: r ? r.pos : 0
      });
    }
  },

  /* =============================== SON IZLEDIKLERIM =============================== */

  recent: {
    list: null, bar: null,
    showInfo: function (it) {
      var box = document.getElementById('rc-info');
      if (!box) return;
      if (!it) { box.innerHTML = '<div class="empty">Izlenen bir film veya dizi henuz yok</div>'; return; }
      var art = it.icon ? '<div class="poster" style="background-image:url(' + esc(it.icon) + ')"></div>' : '';
      var kind = it.kind === 'movie' ? 'Film' : 'Dizi';
      var when = it.ts ? new Date(it.ts).toLocaleString('tr-TR') : '';
      var ep = it.episodeTitle ? '<div class="line">Son bolum: ' + esc(it.episodeTitle) + '</div>' : '';
      box.innerHTML = art + '<h2>' + esc(it.name) + '</h2>' +
        '<div class="line">' + kind + (when ? ' &middot; ' + esc(when) : '') + '</div>' + ep +
        '<div class="recent-help">OK: Ac&nbsp;&nbsp;&nbsp; Sari tus: Bu kaydi kaldir</div>';
    },
    load: function () {
      if (!this.list) return;
      var items = Recent.list();
      this.list.setItems(items);
      var count = document.getElementById('rc-count');
      if (count) count.textContent = items.length + ' / 16';
      var clear = document.getElementById('rc-clear');
      if (clear) clear.className = 'btn' + (!items.length ? ' disabled' : '');
      if (this.bar) this.bar.draw();
      this.showInfo(items[0]);
    },
    open: function (it) {
      if (!it || !it.raw) return;
      if (it.kind === 'movie') App.detail.open('movie', it.raw);
      else App.detail.open('series', it.raw);
    },
    remove: function (it) {
      if (!it) return;
      Recent.remove(it.kind, it.id);
      UI.toast('Son izlediklerimden kaldirildi');
      this.load();
    },
    clear: function () {
      if (!Recent.list().length) { UI.toast('Liste zaten bos'); return; }
      Recent.clear();
      UI.toast('Son izlediklerim temizlendi');
      this.load();
    }
  },

  /* =============================== FAVORILER =============================== */

  favs: {
    list: null,
    load: function () {
      var self = this;
      var out = [];
      var liveIds = Favs.list('live'), movieIds = Favs.list('movie'), seriesIds = Favs.list('series');
      if (!liveIds.length && !movieIds.length && !seriesIds.length) {
        self.list.setItems([]);
        return;
      }
      UI.spin(true);
      Api.liveStreams('').then(function (all) {
        var byId = {};
        for (var i = 0; i < all.length; i++) byId[String(all[i].stream_id)] = all[i];
        for (var n = 0; n < liveIds.length; n++) {
          var channel = byId[liveIds[n]];
          if (channel) out.push({ kind: 'live', id: channel.stream_id, name: channel.name, icon: channel.stream_icon, raw: channel });
        }
      })['catch'](function () { })
        .then(function () {
          UI.spin(false);
          if (movieIds.length || seriesIds.length) {
            out.push({ kind: 'note', id: 0, name: 'Film ve dizi favorileri ilgili bolumde yildizli gorunur', icon: '' });
          }
          self.list.setItems(out);
        });
    },
    open: function (it) {
      if (it.kind === 'live') {
        var items = App.favs.list.items.filter(function (x) { return x.kind === 'live'; })
          .map(function (x) { return x.raw; });
        var idx = 0;
        for (var i = 0; i < items.length; i++) if (String(items[i].stream_id) === String(it.id)) idx = i;
        Playback.startLive(items, idx, { categoryId: '__fav', categoryName: 'Favoriler' });
      }
    }
  },

  /* =============================== ARAMA =============================== */

  search: {
    list: null, bar: null, input: null, scopeBtn: null,
    scope: 'live',
    scopes: ['live', 'movie', 'series'],
    scopeNames: { live: 'Canli', movie: 'Film', series: 'Dizi' },

    paint: function () {
      if (this.scopeBtn) this.scopeBtn.innerHTML = 'Kapsam: ' + this.scopeNames[this.scope];
    },

    cycleScope: function () {
      var i = this.scopes.indexOf(this.scope);
      this.scope = this.scopes[(i + 1) % this.scopes.length];
      this.paint();
    },

    run: function (q) {
      var self = this;
      q = norm(q || '').trim();
      if (q.length < 2) { UI.toast('En az 2 harf yazin'); return; }
      UI.spin(true);
      var p;
      if (this.scope === 'live') p = Api.liveStreams('');
      else if (this.scope === 'movie') p = Api.vodStreams('');
      else p = Api.seriesList('');

      p.then(function (all) {
        UI.spin(false);
        var out = [];
        for (var i = 0; i < all.length && out.length < 400; i++) {
          var it = all[i];
          if (norm(it.name).indexOf(q) === -1) continue;
          out.push({
            kind: self.scope,
            raw: it,
            name: it.name,
            icon: it.stream_icon || it.cover || '',
            sub: self.scopeNames[self.scope]
          });
        }
        self.list.emptyText = 'Sonuc bulunamadi';
        self.list.setItems(out);
        Nav.focus('list');
        UI.toast(out.length + ' sonuc');
      })['catch'](function (e) {
        UI.spin(false);
        UI.toast(e.message || 'Arama basarisiz', 4000);
      });
    },

    open: function (it) {
      if (it.kind === 'live') {
        var items = this.list.items.map(function (x) { return x.raw; });
        Playback.startLive(items, this.list.index, { categoryId: '__search', categoryName: 'Arama sonuclari' });
      } else if (it.kind === 'movie') {
        App.detail.open('movie', it.raw);
      } else {
        App.detail.open('series', it.raw);
      }
    }
  },

  /* =============================== AYARLAR =============================== */

  settings: {
    defs: function () {
      return [
        { label: function () { return 'Son teşhis raporunu göster'; },
          title: 'Yerleşik teşhis',
          help: 'Son oynatma oturumunun motor, çözünürlük, akış hızı, tampon ve hata bilgilerini gösterir. Hesap şifresi rapora eklenmez.',
          run: function () { Diag.loadLast(); return false; } },
        {
          label: function () {
            var m = { auto: 'Otomatik', avplay: 'AVPlay (Tizen)', html5: 'HTML5 video' };
            return 'Canli TV oynaticisi: ' + m[Settings.get('liveEngine')];
          },
          title: 'Canlı TV oynatıcısı',
          help: 'AVPlay canlı yayınlarda donanımsal oynatmayı kullanır. HTML5 küçük kanal ön izlemesini destekler. Otomatik seçenekte televizyonda AVPlay varsa öncelik ona verilir.',
          recommended: 'Canlı yayın kararlılığı için AVPlay; küçük ön izleme için HTML5.',
          run: function () {
            var order = ['auto', 'avplay', 'html5'];
            var i = order.indexOf(Settings.get('liveEngine'));
            Settings.set('liveEngine', order[(i + 1) % order.length]);
          }
        },
        {
          label: function () {
            var m = { auto: 'Otomatik', avplay: 'AVPlay (Tizen)', html5: 'HTML5 video' };
            return 'Film/dizi oynaticisi: ' + m[Settings.get('vodEngine')];
          },
          title: 'Film ve dizi oynatıcısı',
          help: 'Film ve diziler için canlı TV’den bağımsız oynatma motoru seçer. Sağlayıcınızın dosya yapısına göre HTML5 veya AVPlay daha uyumlu olabilir.',
          recommended: 'Sorun yaşanmıyorsa Otomatik.',
          run: function () {
            var order = ['auto', 'avplay', 'html5'];
            var i = order.indexOf(Settings.get('vodEngine'));
            Settings.set('vodEngine', order[(i + 1) % order.length]);
          }
        },
        {
          label: function () { return 'Canli yayin bicimi: ' + Settings.get('liveFormat'); },
          title: 'Canlı yayın biçimi',
          help: 'Sağlayıcıdan canlı kanal adresinin TS veya M3U8 olarak istenmesini belirler. Bu sağlayıcıda M3U8 bulunmadığı için TS kullanılmalıdır.',
          recommended: 'TS',
          run: function () {
            Settings.set('liveFormat', Settings.get('liveFormat') === 'm3u8' ? 'ts' : 'm3u8');
            UI.toast('Kanal acilmiyorsa bu ayari degistirmeyi deneyin', 3200);
          }
        },
        {
          label: function () { return 'Canli yayin tamponu: ' + LiveBuffer.modeLabel(); },
          title: 'Canlı yayın tamponu',
          help: 'Kısa veri kesintilerinde görüntünün donmasını azaltır. Otomatik mod kanal ve kategori davranışını öğrenir; yüksek sabit değerler kanal açılışını geciktirebilir.',
          recommended: 'Otomatik',
          run: function () {
            var order = ['auto', '5', '10', '15', '20'];
            var current = String(Settings.get('liveBufferMode') || 'auto');
            var index = order.indexOf(current);
            Settings.set('liveBufferMode', order[(index + 1) % order.length]);
            UI.toast(Player.pick(true) === 'html5'
              ? 'Tampon suresi AVPlay motorunda uygulanir; HTML5 kendi tamponunu yonetir'
              : 'Yeni deger bir sonraki kanal acilisinda uygulanir', 3400);
          }
        },
        {
          label: function () { return 'Yayin akisi (EPG): ' + (Settings.get('epg') ? 'acik' : 'kapali'); },
          title: 'Yayın akışı',
          help: 'Kanal listesindeki şimdi/sıradaki bilgisini ve Sağ tuşla açılan bugünkü program listesini etkinleştirir.',
          recommended: 'Açık',
          run: function () { Settings.set('epg', !Settings.get('epg')); }
        },
        {
          label: function () { return 'Film/dizi goruntu formati: ' + Player.aspectLabel(Settings.get('aspect')); },
          title: 'Görüntü biçimi',
          help: 'Film ve dizinin ekrana nasıl yerleşeceğini belirler. Oranı koru görüntüyü bozmaz; 16:9 doldur görüntüyü yatay veya dikey esnetebilir.',
          recommended: 'Otomatik veya Oranı koru',
          run: function () {
            var next = Player.nextAspect(Settings.get('aspect'));
            Settings.set('aspect', next);
          }
        },
        {
          label: function () {
            var names = { auto: 'Otomatik', tr: 'Türkçe', en: 'İngilizce', original: 'Kaynak varsayılanı' };
            return 'Öncelikli ses: ' + names[Settings.get('preferredAudio')];
          },
          title: 'Öncelikli ses dili',
          help: 'Film veya dizi açıldığında uygun ses parçası bulunursa otomatik seçilir. Eşleşme yoksa kaynağın varsayılan sesi değiştirilmez.',
          recommended: 'Türkçe',
          run: function () {
            var order = ['auto', 'tr', 'en', 'original'];
            var index = order.indexOf(Settings.get('preferredAudio'));
            Settings.set('preferredAudio', order[(index + 1) % order.length]);
          }
        },
        {
          label: function () {
            var names = { off: 'Kapalı', tr: 'Türkçe', en: 'İngilizce', auto: 'Otomatik' };
            return 'Öncelikli altyazı: ' + names[Settings.get('preferredSubtitle')];
          },
          title: 'Öncelikli altyazı',
          help: 'Kapalı seçiliyken içerikler beklemeden altyazısız açılır. Bir dil seçerseniz uygun parça otomatik seçilir; bozuk TX3G kaynaklarında hazırlama işlemi gerekebilir.',
          recommended: 'Kapalı',
          run: function () {
            var order = ['off', 'tr', 'en', 'auto'];
            var index = order.indexOf(Settings.get('preferredSubtitle'));
            Settings.set('preferredSubtitle', order[(index + 1) % order.length]);
          }
        },
        {
          label: function () {
            var labels = { small: 'Kucuk', normal: 'Normal', large: 'Buyuk', xlarge: 'Cok buyuk' };
            return 'Altyazi boyutu: ' + (labels[Settings.get('subtitleSize')] || 'Normal');
          },
          title: 'Altyazı boyutu',
          help: 'Uygulamanın çizdiği yerleşik ve TX3G uyumluluk altyazılarının ekrandaki yazı boyutunu değiştirir.',
          recommended: 'Normal',
          run: function () {
            var order = ['small', 'normal', 'large', 'xlarge'];
            var index = order.indexOf(Settings.get('subtitleSize'));
            var next = order[(index + 1) % order.length];
            Settings.set('subtitleSize', next);
            Playback.previewSubtitleSize();
          }
        },
        { label: function () { return 'Canlı TV kategorilerini göster/gizle'; },
          title: 'Canlı TV kategorileri',
          help: 'Kullanmadığınız canlı TV kategorilerini ana listeden gizler. Gizlenen kategorilerin kanalları genel aramada bulunmaya devam eder.',
          run: function () { Views.categoryVisibility('live'); return false; } },
        { label: function () { return 'Film kategorilerini göster/gizle'; },
          title: 'Film kategorileri',
          help: 'Kullanmadığınız film kategorilerini kategori sütunundan gizler. Genel film araması gizlenen kategorileri de tarar.',
          run: function () { Views.categoryVisibility('movie'); return false; } },
        { label: function () { return 'Dizi kategorilerini göster/gizle'; },
          title: 'Dizi kategorileri',
          help: 'Kullanmadığınız dizi kategorilerini kategori sütunundan gizler. Genel dizi araması gizlenen kategorileri de tarar.',
          run: function () { Views.categoryVisibility('series'); return false; } },
        { label: function () { return 'Favori kanalları sırala'; },
          title: 'Favori kanal sırası',
          help: 'Canlı kanal favorilerinizin gösterim sırasını kumandayla değiştirir. Film ve dizi favorilerini etkilemez.',
          run: function () { Views.favoriteOrder(); return false; } },
        {
          label: function () { return 'Liste, altyazi onbellegi ve ogrenimini temizle'; },
          title: 'Liste ve altyazı önbelleği',
          help: 'Panel listelerini ve hazırlanmış altyazı kayıtlarını temizler. Hesap bilgileri, favoriler ve son izlediklerim silinmez.',
          run: function () {
            Api.cache = {};
            SubtitleCache.clear();
            SubtitleStrategy.reset();
            UI.toast('Liste ve altyazi onbellegi temizlendi');
          }
        },
        {
          label: function () { return 'Izleme gecmisini sil'; },
          title: 'İzleme ilerlemesi',
          help: 'Film ve dizilerde kaldığınız süreleri temizler. Son İzlediklerim listesi ayrı tutulur.',
          run: function () { Resume.clear(); UI.toast('Izleme gecmisi silindi'); }
        },
        {
          label: function () { return 'Ogrenilen tampon degerlerini sifirla'; },
          title: 'Tampon öğrenimini sıfırla',
          help: 'Otomatik tamponun kanal ve kategori için öğrendiği değerleri siler. Sonraki canlı yayınlarda öğrenme yeniden başlar.',
          run: function () { LiveBuffer.reset(); UI.toast('Tampon ogrenimi sifirlandi'); }
        },
        { label: function () { return 'Kumanda kullanım rehberi'; },
          title: 'Kumanda rehberi',
          help: 'Canlı TV, film/dizi, ön izleme, ses ve altyazı ekranlarında kumanda tuşlarının görevlerini gösterir.',
          run: function () { Views.remoteGuide(); return false; } },
        {
          label: function () {
            var active = Accounts.active();
            return 'Hesaplar (' + Accounts.list().length + '/' + Accounts.max + '): ' +
              (active ? (active.name || active.username) : 'secili degil');
          },
          title: 'Hesaplar',
          help: 'En fazla altı IPTV hesabı ekleyebilir, bilgilerini güncelleyebilir ve aktif hesabı değiştirebilirsiniz. Aynı anda yalnızca seçili hesap kullanılır.',
          run: function () { App.go('accounts'); return false; }
        }
      ];
    }
  }
};

/* =============================== OYNATMA KATMANI =============================== */

var Playback = {
  previewOn: false,
  previewAvailable: false,

  updatePreview: function () {
    if (!this.previewOn) return;
    var slot = document.getElementById('lv-preview');
    if (!slot) return;
    var rect = slot.getBoundingClientRect();
    Player.setViewport({ x: Math.round(rect.left), y: Math.round(rect.top),
      width: Math.round(rect.width), height: Math.round(rect.height) });
    var ch = this.channels && this.channels[this.index];
    var caption = document.getElementById('lv-playing');
    if (caption) caption.innerHTML = '<div class="preview-label">Oynayan kanal</div>' +
      '<div class="preview-name">' + esc(ch ? ch.name : '-') + '</div>' +
      (Settings.get('epg') ? (this.lastEpg === null
        ? '<div class="page-sub">Yayın akışı yükleniyor...</div>' : App.live.epgHtml(this.lastEpg)) : '') +
      '<div class="preview-hint">Aynı kanalda OK: Tam ekran</div>';
    slot.innerHTML = '';
    if (App.live.chans && ch) App.live.chans.setCurrent(ch.stream_id);
  },

  fullscreenPreview: function () {
    this.previewOn = false;
    Player.setViewport(null);
    this.rememberCurrentLive();
    this.overlay().className = 'on';
    this.renderLiveOsd(this.channels[this.index], this.lastEpg);
    this.showOsd(3500);
    var self = this;
    Nav.setOverlay(function (e) { self.keyLive(e); });
  },

  returnToPreview: function () {
    this.previewOn = true;
    this.channelListOn = false;
    this.osdOn = false;
    if (this.osdTimer) clearTimeout(this.osdTimer);
    this.overlay().className = ''; this.overlay().innerHTML = '';
    document.body.className = Player.previewBodyClass();
    Nav.clearOverlay();
    Nav.focus('chans');
    this.updatePreview();
  },
  mode: null,            /* 'live' | 'vod' */
  channels: null, index: 0,
  channelListOn: false, channelListIndex: 0, channelListSource: 'back',
  recentChannelsOn: false, recentChannelIndex: 0,
  lastEpg: null,
  vodMeta: null,
  osdTimer: null, osdOn: false,
  numBuf: '', numTimer: null,
  saveTimer: null,
  liveContext: null,
  liveCandidates: null, liveCandidateIndex: 0,
  bufferProfile: null, bufferSession: null,
  reconnectTimer: null, channelOpenTimer: null, recoveryTimes: null,
  liveStableTimer: null, liveAutoRecoveryStopped: false,
  vodPanel: 'hidden', vodControlIndex: 1, vodTrackColumn: 'audio',
  vodAudioIndex: 0, vodTextIndex: 0, vodTracks: null, vodReady: false,
  subtitleText: '', subtitlePreviewTimer: null,
  liveTechnicalInfo: false, vodTechnicalInfo: false,

  overlay: function () { return document.getElementById('overlay'); },

  /* ---------- canli ---------- */

  startLive: function (channels, index, context) {
    if (!channels || !channels.length) { UI.toast('Kanal listesi bos'); return; }
    this.mode = 'live';
    this.channels = channels;
    this.index = index;
    this.liveContext = context || {};
    this.previewOn = !!this.liveContext.preview;
    this.previewAvailable = this.previewOn;
    if (!this.previewOn) Player.setViewport(null);
    this.recoveryTimes = [];
    this.liveAutoRecoveryStopped = false;
    this.liveTechnicalInfo = false;
    this.channelListOn = false;
    this.recentChannelsOn = false;
    this.channelListIndex = index;
    if (this.channelOpenTimer) clearTimeout(this.channelOpenTimer);
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    Player.stop(true);
    var self = this;
    this.channelOpenTimer = setTimeout(function () {
      self.channelOpenTimer = null;
      if (self.mode === 'live') self.open();
    }, 250);
  },

  open: function (options) {
    options = options || {};
    var ch = this.channels[this.index];
    if (!ch) return;
    var self = this;
    if (this.channelOpenTimer) { clearTimeout(this.channelOpenTimer); this.channelOpenTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.liveStableTimer) { clearTimeout(this.liveStableTimer); this.liveStableTimer = null; }
    if (this.bufferSession) LiveBuffer.end(this.bufferSession);
    this.bufferSession = null;
    this.channelListOn = false;
    this.channelListIndex = this.index;
    this.lastEpg = null;
    if (this.numTimer) { clearTimeout(this.numTimer); this.numTimer = null; }
    this.numBuf = '';
    this.liveTechnicalInfo = false;
    this.overlay().className = 'on';
    this.renderLiveOsd(ch, null);
    this.showOsd(5000);

    this.liveCandidates = Api.liveCandidates(ch.stream_id);
    this.liveCandidateIndex = 0;
    if (!options.recovering) {
      this.recoveryTimes = [];
      this.liveAutoRecoveryStopped = false;
    }
    if (this.previewOn) {
      document.body.className = Player.previewBodyClass();
      this.updatePreview();
    }
    this.startLiveCandidate(ch);

    if (this.previewOn) {
      if (this.osdTimer) clearTimeout(this.osdTimer);
      this.osdOn = false;
      this.overlay().className = ''; this.overlay().innerHTML = '';
      document.body.className = Player.previewBodyClass();
      Nav.clearOverlay(); this.updatePreview();
    } else Nav.setOverlay(function (e) { self.keyLive(e); });
  },

  currentLiveContext: function (ch, format) {
    var base = this.liveContext || {};
    var categoryId = ch && ch.category_id != null ? ch.category_id : base.categoryId;
    var categoryName = base.categoryName || '';
    if ((categoryId == null || categoryId === '') && App.route === 'live' && App.live.currentCat) {
      categoryId = App.live.currentCat.category_id;
      categoryName = App.live.currentCat.category_name;
    }
    if (String(categoryId || '').indexOf('__') === 0 && ch && ch.category_id != null) categoryId = ch.category_id;
    return {
      categoryId: categoryId == null || categoryId === '' ? '__mixed' : String(categoryId),
      categoryName: categoryName || 'Karma liste',
      channelId: ch && ch.stream_id != null ? String(ch.stream_id) : '__unknown',
      engine: Player.pick(true),
      format: format || 'ts'
    };
  },

  startLiveCandidate: function (ch) {
    var self = this;
    var candidate = this.liveCandidates && this.liveCandidates[this.liveCandidateIndex];
    if (!candidate) { this.recoverLive('tum formatlar basarisiz', false, 'Yayin TS ve m3u8 bicimlerinde acilamadi.'); return; }
    var context = this.currentLiveContext(ch, candidate.format);
    this.bufferProfile = LiveBuffer.resolve(context);
    this.bufferSession = LiveBuffer.begin(context, this.bufferProfile);
    Diag.set('Canli kategori', context.categoryName + ' [' + context.categoryId + ']');
    Diag.set('Canli format', candidate.format);
    Diag.set('Tampon profili', this.bufferProfile.mode === 'unsupported'
      ? 'HTML5 tarafindan yonetiliyor'
      : (this.bufferProfile.mode === 'auto'
        ? 'Otomatik ' + this.bufferProfile.play + '/' + this.bufferProfile.resume + ' sn (' + this.bufferProfile.source + ')'
        : 'Sabit ' + this.bufferProfile.play + '/' + this.bufferProfile.resume + ' sn'));

    Player.play(candidate.url, {
      live: true,
      format: candidate.format,
      buffer: this.bufferProfile,
      onError: function (msg) { self.liveCandidateFailed(ch, msg); },
      onReady: function () {
        LiveBuffer.markReady(self.bufferSession);
        self.scheduleLiveStableReset();
        self.fetchOsdEpg(ch);
        self.updatePreview();
        if (!self.previewOn) self.rememberCurrentLive();
      },
      onTime: function () {
        if (self.osdOn && self.liveTechnicalInfo && self.channels[self.index] === ch) {
          self.renderLiveOsd(ch, self.lastEpg, true);
        }
      },
      onBufferingStart: function (event) {
        if (!event.initial) Diag.set('Son tamponlama', 'Basladi');
      },
      onBufferingComplete: function (event) {
        if (!event.initial) Diag.set('Son tamponlama', Math.round(event.durationMs / 100) / 10 + ' sn');
      },
      onStall: function (reason) {
        if (self.bufferSession && Player.engine !== 'avplay') self.bufferSession.context.engine = Player.engine;
        var next = LiveBuffer.noteStall(self.bufferSession, reason);
        if (next) Diag.set('Ogrenilen sonraki tampon', next.play + '/' + next.resume + ' sn');
        self.recoverLive(reason, true);
      }
    });
  },

  liveCandidateFailed: function (ch, msg) {
    if (this.liveCandidateIndex + 1 < this.liveCandidates.length) {
      var failed = this.liveCandidates[this.liveCandidateIndex].format;
      this.liveCandidateIndex++;
      var next = this.liveCandidates[this.liveCandidateIndex].format;
      Diag.add(failed + ' acilamadi, ' + next + ' deneniyor: ' + msg);
      UI.toast(failed + ' acilamadi, ' + next + ' deneniyor', 2200);
      if (this.bufferSession) LiveBuffer.end(this.bufferSession);
      this.bufferSession = null;
      this.startLiveCandidate(ch);
      return;
    }
    this.recoverLive('oynatma hatasi', false, msg);
  },

  recoverLive: function (reason, learned, finalMessage) {
    if (this.mode !== 'live' || this.reconnectTimer) return;
    if (this.liveAutoRecoveryStopped && !finalMessage) return;
    var now = Date.now();
    this.recoveryTimes = (this.recoveryTimes || []).filter(function (time) { return now - time < 300000; });
    if (this.recoveryTimes.length >= 2) {
      Diag.add('Otomatik yeniden baglanma sinirina ulasildi: ' + reason);
      if (finalMessage) {
        /* Gercek medya/ag hatasinda arka planda calisan goruntu birakma. */
        Player.stop(true);
        this.showError(finalMessage);
      } else {
        /* Stall siniri bir hata ekrani degildir. HTML5 kendi tamponuyla daha
           sonra toparlanabilir; yayini ve goruntuyu acik birak. */
        this.liveAutoRecoveryStopped = true;
        UI.toast('Yayin toparlanmaya calisiyor. Otomatik yenileme sinirina ulasildi.', 4200);
      }
      return;
    }
    this.recoveryTimes.push(now);
    Diag.set('Yeniden baglanma', this.recoveryTimes.length + '/2 - ' + reason);
    if (!learned && this.bufferSession) this.bufferSession.stalled = true;
    Player.stop(true);
    UI.toast('Yayin yenileniyor...', 1800);
    var self = this;
    var delay = this.recoveryTimes.length === 1 ? 500 : 800;
    this.reconnectTimer = setTimeout(function () {
      self.reconnectTimer = null;
      if (self.mode === 'live') self.open({ recovering: true });
    }, delay);
  },

  scheduleLiveStableReset: function () {
    if (this.liveStableTimer) clearTimeout(this.liveStableTimer);
    var self = this;
    var session = Player._sessionId;
    var channelIndex = this.index;
    this.liveStableTimer = setTimeout(function () {
      self.liveStableTimer = null;
      if (self.mode !== 'live' || self.index !== channelIndex || Player._sessionId !== session ||
        !Player.playing || Date.now() - Player._lastProgressAt > 4000) return;
      self.recoveryTimes = [];
      self.liveAutoRecoveryStopped = false;
      Diag.set('Yeniden baglanma', '60 sn kararlı oynatma · sayaç sıfırlandı');
    }, 60000);
  },

  scheduleChannelOpen: function (delay) {
    if (this.channelOpenTimer) clearTimeout(this.channelOpenTimer);
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.bufferSession) { LiveBuffer.end(this.bufferSession); this.bufferSession = null; }
    Player.stop(true);
    this.channelListOn = false;
    this.channelListIndex = this.index;
    var ch = this.channels[this.index];
    if (ch) {
      this.overlay().className = 'on';
      this.renderLiveOsd(ch, null);
      this.showOsd(1800);
    }
    var self = this;
    this.channelOpenTimer = setTimeout(function () {
      self.channelOpenTimer = null;
      if (self.mode === 'live') self.open({ switching: true });
    }, delay == null ? 250 : delay);
  },

  step: function (delta) {
    var n = this.index + delta;
    if (n < 0) n = this.channels.length - 1;
    if (n >= this.channels.length) n = 0;
    this.index = n;
    this.recoveryTimes = [];
    this.liveAutoRecoveryStopped = false;
    this.scheduleChannelOpen(250);
  },

  rememberCurrentLive: function () {
    if (this.mode !== 'live' || !Player._readyAt || !this.channels || !this.channels[this.index]) return;
    var ch = this.channels[this.index], base = this.liveContext || {};
    var catId = base.categoryId != null ? base.categoryId : ch.category_id;
    var catName = base.categoryName || ch.category_name || '';
    if (catId != null && catId !== '__recent' && catId !== '__search') AccountData.set('lastLiveCat', catId);
    AccountData.set('lastLiveChannel', { streamId: ch.stream_id, categoryId: catId, updated: Date.now() });
    LiveHistory.add(ch, { categoryId: ch.category_id != null ? ch.category_id : catId, categoryName: catName });
  },

  switchStoredChannel: function (record) {
    if (!record || record.stream_id == null) return;
    var current = this.channels && this.channels[this.index];
    if (current && String(current.stream_id) === String(record.stream_id)) {
      this.hideRecentChannels(); UI.toast('Bu kanal zaten açık'); return;
    }
    for (var i = 0; this.channels && i < this.channels.length; i++) {
      if (String(this.channels[i].stream_id) === String(record.stream_id)) {
        this.index = i; this.recoveryTimes = []; this.liveAutoRecoveryStopped = false;
        this.recentChannelsOn = false; this.scheduleChannelOpen(250); return;
      }
    }
    var self = this, categoryId = record.category_id;
    UI.spin(true);
    Api.liveStreams(categoryId == null || categoryId === '' ? '' : categoryId).then(function (items) {
      UI.spin(false);
      var found = -1;
      for (var n = 0; n < items.length; n++) if (String(items[n].stream_id) === String(record.stream_id)) { found = n; break; }
      if (found < 0) {
        LiveHistory.remove(record.stream_id);
        self.renderRecentChannels();
        UI.toast('Kanal artık sağlayıcı listesinde bulunmuyor');
        return;
      }
      self.startLive(items, found, {
        preview: false,
        categoryId: categoryId == null ? '__recent' : categoryId,
        categoryName: record.category_name || 'Son kanallar'
      });
    })['catch'](function (e) {
      UI.spin(false); UI.toast(e.message || 'Kanal listesi alınamadı', 3500);
    });
  },

  togglePreviousChannel: function () {
    var current = this.channels && this.channels[this.index];
    var previous = LiveHistory.previous(current && current.stream_id);
    if (!previous) { UI.toast('Önceki kanal bulunmuyor'); return; }
    this.switchStoredChannel(previous);
  },

  showRecentChannels: function () {
    var list = LiveHistory.list();
    if (!list.length) { UI.toast('Son izlenen kanal bulunmuyor'); return; }
    this.recentChannelsOn = true; this.recentChannelIndex = 0;
    var current = this.channels && this.channels[this.index];
    for (var i = 0; i < list.length; i++) {
      if (current && String(list[i].stream_id) === String(current.stream_id)) { this.recentChannelIndex = i; break; }
    }
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.osdOn = false; this.overlay().className = 'on';
    this.renderRecentChannels();
  },

  renderRecentChannels: function () {
    if (!this.recentChannelsOn) return;
    var list = LiveHistory.list(), current = this.channels && this.channels[this.index];
    if (!list.length) { this.hideRecentChannels(); return; }
    if (this.recentChannelIndex >= list.length) this.recentChannelIndex = list.length - 1;
    var h = '<div class="recent-channels"><div class="recent-channels-title">Son kanallar</div>' +
      '<div class="recent-channels-sub">En son izlenen 8 kanal</div><div class="recent-channels-list">';
    for (var i = 0; i < list.length; i++) {
      var playing = current && String(current.stream_id) === String(list[i].stream_id);
      h += '<div class="recent-channel-row' + (i === this.recentChannelIndex ? ' selected' : '') +
        (playing ? ' playing' : '') + '"><div class="recent-channel-num">' + esc(list[i].num || (i + 1)) + '</div>' +
        '<div class="recent-channel-name">' + esc(list[i].name) + '</div>' +
        '<div class="recent-channel-state">' + (playing ? 'Şu anda oynuyor' : '') + '</div></div>';
    }
    h += '</div><div class="recent-channels-help">↑↓ Kanal seç · OK Aç · Geri Kapat</div></div>';
    this.overlay().innerHTML = h;
  },

  moveRecentChannels: function (delta) {
    var list = LiveHistory.list(); if (!list.length) return;
    this.recentChannelIndex = Math.max(0, Math.min(list.length - 1, this.recentChannelIndex + delta));
    this.renderRecentChannels();
  },

  hideRecentChannels: function () {
    this.recentChannelsOn = false;
    this.overlay().className = ''; this.overlay().innerHTML = '';
    var self = this; Nav.setOverlay(function (e) { self.keyLive(e); });
  },

  keyRecentChannels: function (c) {
    if (c === KEY.UP) { this.moveRecentChannels(-1); return; }
    if (c === KEY.DOWN) { this.moveRecentChannels(1); return; }
    if (c === KEY.CH_UP) { this.moveRecentChannels(-4); return; }
    if (c === KEY.CH_DOWN) { this.moveRecentChannels(4); return; }
    if (c === KEY.ENTER) {
      var list = LiveHistory.list(); this.switchStoredChannel(list[this.recentChannelIndex]); return;
    }
    if (c === KEY.BACK || c === KEY.ESC || c === KEY.LEFT || c === KEY.RIGHT) this.hideRecentChannels();
  },

  keyLive: function (e) {
    var c = e.keyCode;
    e.preventDefault();

    if (Diag.visible) { if (c === KEY.BACK || c === KEY.ENTER) Diag.hide(); return; }

    if (this.recentChannelsOn) { this.keyRecentChannels(c); return; }
    if (this.channelListOn) { this.keyChannelList(c); return; }

    if (c === KEY.LEFT) { this.togglePreviousChannel(); return; }
    if (c === KEY.RIGHT) { this.showRecentChannels(); return; }
    if (c === KEY.UP) { this.step(-1); return; }
    if (c === KEY.DOWN) { this.step(1); return; }
    if (c === KEY.CH_UP) { this.step(1); return; }
    if (c === KEY.CH_DOWN) { this.step(-1); return; }
    if (c === KEY.ENTER) { if (this.previewAvailable) this.returnToPreview(); else this.showChannelList('ok'); return; }
    if (c === KEY.INFO) {
      if (this.liveTechnicalInfo) { Diag.render(); return; }
      this.liveTechnicalInfo = true;
      this.renderLiveOsd(this.channels[this.index], this.lastEpg, true);
      this.showOsd(7000);
      return;
    }
    if (c === KEY.YELLOW) {
      var ch = this.channels[this.index];
      var on = Favs.toggle('live', ch.stream_id);
      UI.toast(on ? 'Favorilere eklendi' : 'Favorilerden cikarildi');
      return;
    }
    if (c === KEY.GREEN) {
      this.recoveryTimes = [];
      this.liveAutoRecoveryStopped = false;
      this.recoverLive('kullanici yenilemesi', false);
      return;
    }
    if (c === KEY.RED) { Diag.toggle(); return; }
    if (c >= KEY.N0 && c <= KEY.N9) { this.numberEntry(c - KEY.N0); return; }
    if (c === KEY.BACK || c === KEY.ESC) { if (this.previewAvailable) this.returnToPreview(); else this.showChannelList('back'); return; }
    if (c === KEY.STOP) { this.exit(); return; }
  },

  showChannelList: function (source) {
    this.channelListOn = true;
    this.channelListSource = source === 'ok' ? 'ok' : 'back';
    this.channelListIndex = this.index;
    this.osdOn = false;
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.overlay().className = 'on';
    this.renderChannelList();
  },

  hideChannelList: function () {
    this.channelListOn = false;
    this.channelListIndex = this.index;
    this.overlay().className = '';
    this.overlay().innerHTML = '';
  },

  renderChannelList: function () {
    var total = this.channels ? this.channels.length : 0;
    if (!total) return;
    var visible = 11;
    var first = Math.max(0, this.channelListIndex - Math.floor(visible / 2));
    first = Math.min(first, Math.max(0, total - visible));
    var last = Math.min(total, first + visible);
    var cat = App.route === 'live' && App.live.currentCat ? App.live.currentCat.category_name : 'Kanallar';
    var h = '<div class="channel-picker"><div class="picker-head">' +
      '<div class="picker-title">' + esc(cat || 'Kanallar') + '</div>' +
      '<div class="picker-sub">' + total + ' kanal  \u00b7  Secili ' + (this.channelListIndex + 1) + '</div></div>' +
      '<div class="picker-list">';
    for (var i = first; i < last; i++) {
      var ch = this.channels[i];
      var cls = 'picker-row';
      if (i === this.channelListIndex) cls += ' selected';
      if (i === this.index) cls += ' playing';
      h += '<div class="' + cls + '"><div class="picker-num">' + esc(ch.num || (i + 1)) + '</div>' +
        '<div class="picker-name">' + esc(ch.name) + '</div>' +
        '<div class="picker-star">' + (Favs.has('live', ch.stream_id) ? '\u2605' : '') + '</div></div>';
    }
    var backHelp = this.channelListSource === 'ok' ? 'Geri Yayina don' : 'Geri Kategorilere don';
    h += '</div><div class="picker-help">\u2191\u2193 Kanal sec  \u00b7  OK Ac/Kapat  \u00b7  Sari Favori  \u00b7  ' + backHelp + '</div></div>';
    this.overlay().innerHTML = h;
  },

  moveChannelList: function (delta) {
    var total = this.channels.length;
    if (!total) return;
    var n = this.channelListIndex + delta;
    if (n < 0) n = 0;
    if (n >= total) n = total - 1;
    if (n !== this.channelListIndex) {
      this.channelListIndex = n;
      this.renderChannelList();
    }
  },

  keyChannelList: function (c) {
    if (c === KEY.UP) { this.moveChannelList(-1); return; }
    if (c === KEY.DOWN) { this.moveChannelList(1); return; }
    if (c === KEY.CH_UP) { this.moveChannelList(1); return; }
    if (c === KEY.CH_DOWN) { this.moveChannelList(-1); return; }
    if (c === KEY.LEFT) { this.moveChannelList(-10); return; }
    if (c === KEY.RIGHT) { this.moveChannelList(10); return; }
    if (c === KEY.YELLOW) {
      var fav = this.channels[this.channelListIndex];
      var on = Favs.toggle('live', fav.stream_id);
      UI.toast(on ? 'Favorilere eklendi' : 'Favorilerden cikarildi');
      this.renderChannelList();
      return;
    }
    if (c === KEY.ENTER) {
      var selected = this.channels[this.channelListIndex];
      var playing = this.channels[this.index];
      if (selected && playing && String(selected.stream_id) === String(playing.stream_id)) {
        this.hideChannelList();
        return;
      }
      this.index = this.channelListIndex;
      this.recoveryTimes = [];
      this.scheduleChannelOpen(250);
      return;
    }
    if (c === KEY.BACK || c === KEY.ESC) {
      if (this.channelListSource === 'ok') this.hideChannelList();
      else this.exit(true);
      return;
    }
    if (c === KEY.STOP) { this.exit(); }
  },

  numberEntry: function (d) {
    var self = this;
    this.numBuf += String(d);
    var box = document.getElementById('chnum');
    if (!box) {
      box = el('div', 'chnum-entry'); box.id = 'chnum';
      this.overlay().appendChild(box);
    }
    box.textContent = this.numBuf;
    if (this.numTimer) clearTimeout(this.numTimer);
    this.numTimer = setTimeout(function () {
      var target = self.numBuf; self.numBuf = '';
      var b = document.getElementById('chnum');
      if (b && b.parentNode) b.parentNode.removeChild(b);
      for (var i = 0; i < self.channels.length; i++) {
        if (String(self.channels[i].num) === target) {
          if (i === self.index) { UI.toast('Bu kanal zaten acik'); return; }
          self.index = i;
          self.recoveryTimes = [];
          self.liveAutoRecoveryStopped = false;
          self.scheduleChannelOpen(250);
          return;
        }
      }
      UI.toast('Kanal ' + target + ' bulunamadi');
    }, 1800);
  },

  formatRate: function (bits) {
    bits = Number(bits) || 0;
    if (!bits) return 'Sunulmuyor';
    if (bits >= 1000000) return (bits / 1000000).toFixed(bits >= 10000000 ? 1 : 2) + ' Mbps';
    return Math.round(bits / 1000) + ' Kbps';
  },

  technicalStatsHtml: function () {
    var s = Player.playbackStats();
    var resolution = s.width && s.height ? s.width + '×' + s.height : 'Sunulmuyor';
    var throughput = s.bandwidth ? this.formatRate(s.bandwidth)
      : (s.networkDownlink ? this.formatRate(s.networkDownlink) + ' (ag tahmini)' : 'Sunulmuyor');
    var decoded = s.decodedRate ? this.formatRate(s.decodedRate) : 'Sunulmuyor';
    return '<div class="tech-stats">' +
      '<div><b>Motor</b><span>' + esc(String(s.engine).toUpperCase()) + '</span></div>' +
      '<div><b>Kaynak</b><span>' + esc(String(s.format).toUpperCase()) + '</span></div>' +
      '<div><b>Cozunurluk</b><span>' + esc(resolution) + '</span></div>' +
      '<div><b>Video codec</b><span>' + esc(s.videoCodec || 'Sunulmuyor') + '</span></div>' +
      '<div><b>Ses codec</b><span>' + esc(s.audioCodec || 'Sunulmuyor') + '</span></div>' +
      '<div><b>Video bitrate</b><span>' + esc(this.formatRate(s.bitrate)) + '</span></div>' +
      '<div><b>Ses bitrate</b><span>' + esc(this.formatRate(s.audioBitrate)) + '</span></div>' +
      '<div><b>Baglanti hizi</b><span>' + esc(throughput) + '</span></div>' +
      '<div><b>Cozulen veri</b><span>' + esc(decoded) + '</span></div>' +
      '<div><b>Kare hizi</b><span>' + (s.fps ? s.fps.toFixed(1) + ' fps' : 'Sunulmuyor') + '</span></div>' +
      '<div><b>Durum</b><span>' + esc(s.state) + '</span></div>' +
      '<div class="tech-note">Oynaticinin mevcut oturumundan okunur; ek baglanti kurulmaz.</div>' +
      '</div>';
  },

  renderLiveOsd: function (ch, epg, technical) {
    var body = '<div class="osd"><div class="ch">' +
      '<div class="chno">' + esc(ch.num || '') + '</div>' +
      '<div class="chname">' + esc(ch.name) + '</div></div>';
    if (epg && epg.length) {
      var now = epg[0];
      var s = parseTs(now.start), e2 = parseTs(now.end || now.stop);
      var pct = 0;
      if (s && e2) {
        pct = Math.max(0, Math.min(100, (Date.now() - s.getTime()) / (e2.getTime() - s.getTime()) * 100));
      }
      body += '<div class="prg">' + esc(b64(now.title)) + '</div>' +
        '<div class="sub">' + hhmm(s) + ' - ' + hhmm(e2) + '</div>' +
        '<div class="seek"><i style="width:' + pct.toFixed(0) + '%"></i></div>';
      if (epg[1]) body += '<div class="sub" style="margin-top:10px">Sirada: ' + esc(b64(epg[1].title)) + '</div>';
    } else {
      body += '<div class="sub">Kanal degistirmek icin yukari / asagi</div>';
    }
    if (technical) body += this.technicalStatsHtml();
    body += '</div>';
    this.overlay().innerHTML = body;
  },

  fetchOsdEpg: function (ch) {
    if (!Settings.get('epg')) return;
    var self = this;
    Api.shortEpg(ch.stream_id, 2).then(function (list) {
      if (self.mode !== 'live') return;
      if (self.channels[self.index] !== ch) return;
      if (self.osdOn) self.renderLiveOsd(ch, list, self.liveTechnicalInfo);
      self.lastEpg = list;
      self.updatePreview();
    })['catch'](function () {
      if (self.mode !== 'live' || self.channels[self.index] !== ch) return;
      self.lastEpg = [];
      self.updatePreview();
    });
  },

  /* ---------- film / bolum ---------- */

  subtitleContext: function (engine) {
    var meta = this.vodMeta || {};
    var cleanUrl = String(meta.url || '').split('?')[0];
    return {
      contentKey: String(meta.kind || 'vod') + ':' + String(meta.id || ''),
      extension: meta.extension || cleanUrl.split('.').pop() || 'unknown',
      engine: engine || Player.engine || Player.pick(false)
    };
  },

  generalTrackPreference: function (type) {
    var value = Settings.get(type === 'audio' ? 'preferredAudio' : 'preferredSubtitle');
    if (type === 'text' && value === 'off') return 'off';
    if (value === 'tr' || value === 'en') return 'lang:' + value;
    if (type === 'text' && value === 'auto') return 'auto';
    return null;
  },

  startVod: function (meta) {
    Player.setViewport(null);
    var self = this;
    this.mode = 'vod';
    this.vodMeta = meta;
    this.vodPanel = 'hidden';
    this.vodControlIndex = 1;
    this.vodTrackColumn = 'audio';
    this.vodAudioIndex = 0;
    this.vodTextIndex = 0;
    this.vodTracks = Player.emptyTracks();
    this.vodReady = false;
    this.vodTechnicalInfo = false;
    this.subtitleText = '';
    this.updateSubtitleLayer();
    Player.aspect = Settings.get('aspect') || 'auto';
    var rememberedTracks = TrackPrefs.get(meta) || {};
    var requestedSubtitle = rememberedTracks.text || this.generalTrackPreference('text') || 'off';
    var initialSubtitleContext = this.subtitleContext(Player.pick(false));
    var storedManifest = SubtitleStrategy.getManifest(initialSubtitleContext);
    Player.play(meta.url, {
      live: false,
      format: meta.extension || 'vod',
      startAt: meta.startAt || 0,
      /* Varsayilan Kapali'dir. Kullanici genel bir dil veya bu dizi icin
         daha once bir parca sectiyse o acik tercih uygulanir. */
      subtitlePreference: requestedSubtitle,
      subtitleCacheKey: String(meta.kind || 'vod') + ':' + String(meta.id || ''),
      subtitleManifest: storedManifest,
      resolveSubtitleStrategy: function (engine) {
        return SubtitleStrategy.resolve(self.subtitleContext(engine));
      },
      onNativeSubtitle: function (engine) {
        SubtitleStrategy.noteNative(self.subtitleContext(engine));
        Diag.set('Altyazi profili', 'Yerlesik · ' + engine);
        if (self.vodPanel === 'tracks') self.renderTrackPanel();
      },
      onSoftwareSubtitle: function (engine, info) {
        SubtitleStrategy.noteSoftware(self.subtitleContext(engine), info);
        Diag.set('Altyazi profili', 'TX3G uyumluluk · ' + engine);
      },
      onError: function (msg) { self.showError(msg); },
      onPreparation: function (state) { self.renderVodPreparation(state); },
      onReady: function () {
        self.vodReady = true;
        self.loadVodTracks(true);
        self.showVodInfo(4000);
      },
      onTime: function (pos, dur) {
        if (self.vodTechnicalInfo) Diag.set('Video ilerlemesi', mmss(pos) + ' / ' + mmss(dur));
        if (self.osdOn && self.vodPanel === 'controls') self.renderVodControls(pos, dur);
        else if (self.osdOn && self.vodPanel === 'info') self.renderVodInfo(pos, dur);
      },
      onSubtitle: function (text) { self.renderSubtitle(text); },
      onSubtitleStatus: function (message) {
        UI.toast(message, 4200);
        if (self.vodPanel === 'tracks') self.renderTrackPanel();
      },
      onSubtitleProgress: function () {
        if (self.vodPanel === 'tracks') self.renderTrackPanel();
      },
      onSeekStatus: function (message) { UI.toast(message, 3200); },
      onEnd: function () { self.exit(); }
    });

    this.saveTimer = setInterval(function () {
      if (Player.playing) Resume.save(meta.kind, meta.id, Player.position(), Player.duration(), meta.name);
    }, 15000);

    Nav.setOverlay(function (e) { self.keyVod(e); });
  },

  renderVodPreparation: function (state) {
    if (this.mode !== 'vod') return;
    state = state || {};
    this.vodPanel = 'preparing';
    this.osdOn = true;
    this.overlay().className = 'on';
    this.renderSubtitle('');
    var container = { mp4: 'MP4', matroska: 'MKV', other: 'Bilinmeyen' }[state.container] || '';
    var title = 'Yayin hazirlaniyor';
    var detail = 'Oynatma baglantisi guvenli bicimde hazirlaniyor';
    var pct = state.progress == null ? 0 : Math.max(0, Math.min(100, state.progress));
    var indeterminate = state.progress == null;
    if (state.stage === 'inspect') {
      title = 'Kaynak inceleniyor';
      detail = 'Kapsayici ve altyazi bicimi belirleniyor';
    } else if (state.stage === 'detected') {
      title = 'Kaynak incelendi';
      detail = (container ? 'Kapsayici: ' + container + ' · ' : '') +
        'Altyazi: ' + (state.subtitleType || 'Yerlesik');
    } else if (state.stage === 'subtitle') {
      title = 'Altyazi hazirlaniyor';
      detail = (container ? container + ' · ' : '') + (state.subtitleType || 'TX3G') +
        ' uyumluluk modu' + (state.track ? ' · ' + state.track : '');
    } else if (state.stage === 'cached') {
      title = 'Altyazi onbellekten yukleniyor';
      detail = (container ? container + ' · ' : '') + (state.subtitleType || 'TX3G') +
        (state.track ? ' · ' + state.track : '');
    } else if (state.stage === 'retry') {
      title = state.message || 'Baglanti yeniden deneniyor';
      detail = 'Tamamlanan altyazi parcalari korunuyor';
    } else if (state.stage === 'closing') {
      title = 'Baglanti kapatiliyor';
      detail = state.message || 'Tek baglanti kurali icin mevcut istek sonlandiriliyor';
      indeterminate = true;
    } else if (state.stage === 'release') {
      title = 'Baglanti guvenle kapatiliyor';
      detail = 'Oynaticidan once kisa emniyet suresi';
    } else if (state.stage === 'player') {
      title = 'Oynatici aciliyor';
      detail = 'Tek medya baglantisi kuruluyor';
      indeterminate = true;
    } else if (state.stage === 'error') {
      title = 'Altyazi hazirlanamadi';
      detail = state.message || 'Kaynak altyazisi okunamadi';
      indeterminate = false;
    }
    var stats = '';
    if ((state.stage === 'subtitle' || state.stage === 'retry') && state.total) {
      stats = '<div class="prep-stats"><span>' + state.done + ' / ' + state.total + ' metin parcasi</span>' +
        '<span>' + (state.remaining != null ? 'Yaklasik ' + state.remaining + ' sn kaldi' : 'Sure hesaplaniyor') + '</span></div>';
    }
    var source = container || state.subtitleType
      ? '<div class="prep-source">' + esc(container ? 'Kapsayici: ' + container : '') +
        (container && state.subtitleType ? ' &nbsp;·&nbsp; ' : '') +
        esc(state.subtitleType ? 'Altyazi: ' + state.subtitleType : '') + '</div>' : '';
    var help = state.stage === 'error'
      ? 'Yukari Yeniden dene &nbsp; · &nbsp; OK Altyazisiz baslat &nbsp; · &nbsp; Geri Iptal'
      : 'OK Altyazisiz baslat &nbsp; · &nbsp; Geri Iptal';
    this.overlay().innerHTML =
      '<div class="vod-preparation"><div class="prep-card">' +
      '<div class="prep-title">' + esc(title) + '</div>' +
      '<div class="prep-detail">' + esc(detail) + '</div>' + source +
      '<div class="prep-bar' + (indeterminate ? ' indeterminate' : '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="prep-percent">' + (indeterminate ? 'Lutfen bekleyin' : '%' + Math.floor(pct)) + '</div>' +
      stats + '<div class="prep-help">' + help + '</div>' +
      '</div></div>';
  },

  loadVodTracks: function (applyPreference) {
    this.vodTracks = Player.refreshTracks();
    if (applyPreference) {
      var pref = TrackPrefs.get(this.vodMeta);
      var audioPreference = pref && pref.audio ? pref.audio : this.generalTrackPreference('audio');
      if (audioPreference) {
        var audio = Player.trackByPreference('audio', audioPreference);
        if (audio) Player.selectAudio(audio.index);
      }
      var requestedText = Player.requestedSubtitlePreference();
      if (requestedText && requestedText !== 'off') {
        var text = Player.trackByPreference('text', requestedText);
        if (text) Player.selectSubtitle(text.index);
        else Player.selectSubtitle('off');
      } else {
        /* Yeni icerik acilisinda kayitli eski altyazi tercihini uygulama. */
        Player.selectSubtitle('off');
      }
    }
    this.vodTracks = Player.tracks;
    Player.prepareSubtitleRenderer();
    return this.vodTracks;
  },

  vodControls: function () {
    return [
      { id: 'back', label: '\u221210 sn' },
      { id: 'toggle', label: Player.paused ? 'Oynat' : 'Duraklat' },
      { id: 'forward', label: '+30 sn' },
      { id: 'tracks', label: 'Ses ve Altyazi' },
      { id: 'subtitleSize', label: 'Yazi: ' + this.subtitleSizeLabel() },
      { id: 'aspect', label: 'Goruntu' }
    ];
  },

  renderVodInfo: function (pos, dur) {
    var pct = dur ? Math.max(0, Math.min(100, pos / dur * 100)) : 0;
    var m = this.vodMeta || {};
    var summary = Player.trackSummary();
    var technical = this.vodTechnicalInfo ? this.technicalStatsHtml() : '';
    this.overlay().innerHTML =
      '<div class="osd vod-osd compact"><div class="ch"><div class="chname">' + esc(m.name || '') + '</div></div>' +
      '<div class="sub">' + (Player.paused ? 'Duraklatildi' : 'Oynatiliyor') +
      ' &nbsp;\u00b7&nbsp; Ses: ' + esc(summary.audio) +
      ' &nbsp;\u00b7&nbsp; Altyazi: ' + esc(summary.text) + '</div>' +
      '<div class="seek"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="times"><span>' + mmss(pos) + '</span><span>' + (dur ? mmss(dur) : '') + '</span></div>' +
      technical +
      '<div class="vod-key-help">OK Oynat/Duraklat &nbsp; · &nbsp; \u2190 −10 sn &nbsp; · &nbsp; \u2192 +30 sn &nbsp; · &nbsp; \u2191 Menu &nbsp; · &nbsp; \u2193 Bilgi</div>' +
      '</div>';
  },

  renderVodControls: function (pos, dur) {
    var pct = dur ? Math.max(0, Math.min(100, pos / dur * 100)) : 0;
    var m = this.vodMeta || {};
    var summary = Player.trackSummary();
    var controls = this.vodControls();
    var actions = '';
    for (var i = 0; i < controls.length; i++) {
      actions += '<div class="vod-action' + (i === this.vodControlIndex ? ' focus' : '') + '">' +
        esc(controls[i].label) + '</div>';
    }
    this.overlay().innerHTML =
      '<div class="osd vod-osd"><div class="ch"><div class="chname">' + esc(m.name || '') + '</div></div>' +
      '<div class="sub">' + (Player.paused ? 'Duraklatildi' : 'Oynatiliyor') +
      ' &nbsp;\u00b7&nbsp; Ses: ' + esc(summary.audio) +
      ' &nbsp;\u00b7&nbsp; Altyazi: ' + esc(summary.text) + '</div>' +
      '<div class="seek"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="times"><span>' + mmss(pos) + '</span><span>' + (dur ? mmss(dur) : '') + '</span></div>' +
      '<div class="vod-actions">' + actions + '</div>' +
      '</div>';
  },

  showVodControls: function (ms) {
    this.vodPanel = 'controls';
    this.osdOn = true;
    this.overlay().className = 'on';
    this.renderVodControls(Player.position(), Player.duration());
    this.updateSubtitleLayer();
    if (this.osdTimer) clearTimeout(this.osdTimer);
    if (ms === 0) return;
    var self = this;
    this.osdTimer = setTimeout(function () { self.hideVodOverlay(); }, ms || 6000);
  },

  showVodInfo: function (ms, technical) {
    this.vodPanel = 'info';
    this.vodTechnicalInfo = !!technical;
    this.osdOn = true;
    this.overlay().className = 'on';
    this.renderVodInfo(Player.position(), Player.duration());
    this.updateSubtitleLayer();
    if (this.osdTimer) clearTimeout(this.osdTimer);
    var self = this;
    this.osdTimer = setTimeout(function () { self.hideVodOverlay(); }, ms || 4000);
  },

  hideVodOverlay: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.osdOn = false;
    this.vodPanel = 'hidden';
    this.vodTechnicalInfo = false;
    this.overlay().className = '';
    this.overlay().innerHTML = '';
    this.updateSubtitleLayer();
  },

  renderSubtitle: function (text) {
    this.subtitleText = String(text || '');
    this.updateSubtitleLayer();
  },

  updateSubtitleLayer: function () {
    var layer = document.getElementById('subtitle-layer');
    if (!layer) return;
    layer.textContent = this.subtitleText || '';
    var lifted = this.mode === 'vod' && (this.vodPanel === 'info' || this.vodPanel === 'controls' || this.vodPanel === 'tracks');
    var size = Settings.get('subtitleSize') || 'normal';
    layer.className = this.subtitleText
      ? ('on subtitle-size-' + size + (lifted ? ' lifted' : '')) : '';
  },

  previewSubtitleSize: function () {
    var layer = document.getElementById('subtitle-layer');
    if (!layer) return;
    if (this.subtitlePreviewTimer) clearTimeout(this.subtitlePreviewTimer);
    var labels = { small: 'Kucuk altyazi', normal: 'Normal altyazi', large: 'Buyuk altyazi', xlarge: 'Cok buyuk altyazi' };
    var size = Settings.get('subtitleSize') || 'normal';
    layer.textContent = labels[size] || labels.normal;
    layer.className = 'on subtitle-size-' + size;
    var self = this;
    this.subtitlePreviewTimer = setTimeout(function () {
      self.subtitlePreviewTimer = null;
      if (self.mode === 'vod') self.updateSubtitleLayer();
      else { layer.textContent = ''; layer.className = ''; }
    }, 2400);
  },

  subtitleSizeLabel: function () {
    return { small: 'Kucuk', normal: 'Normal', large: 'Buyuk', xlarge: 'Cok buyuk' }[Settings.get('subtitleSize')] || 'Normal';
  },

  cycleSubtitleSize: function () {
    var order = ['small', 'normal', 'large', 'xlarge'];
    var index = order.indexOf(Settings.get('subtitleSize'));
    Settings.set('subtitleSize', order[(index + 1) % order.length]);
    this.updateSubtitleLayer();
    UI.toast('Altyazi boyutu: ' + this.subtitleSizeLabel());
  },

  findTrackPosition: function (list, selectedIndex) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].index) === String(selectedIndex)) return i;
    }
    return 0;
  },

  openTrackPanel: function () {
    if (!this.vodReady) { UI.toast('Ses ve altyazi bilgileri hazirlaniyor'); return; }
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.loadVodTracks(false);
    this.vodPanel = 'tracks';
    this.osdOn = true;
    this.vodAudioIndex = this.findTrackPosition(this.vodTracks.audio, this.vodTracks.currentAudio);
    this.vodTextIndex = this.vodTracks.subtitlesOff
      ? 0 : this.findTrackPosition(this.vodTracks.text, this.vodTracks.currentText) + 1;
    if (!this.vodTracks.audio.length && this.vodTracks.text.length) this.vodTrackColumn = 'text';
    this.overlay().className = 'on';
    this.renderTrackPanel();
    this.updateSubtitleLayer();
  },

  trackWindow: function (list, index) {
    var max = 9;
    var first = Math.max(0, index - Math.floor(max / 2));
    first = Math.min(first, Math.max(0, list.length - max));
    return { first: first, last: Math.min(list.length, first + max) };
  },

  renderTrackColumn: function (type, list, selected, current) {
    var focused = this.vodTrackColumn === type;
    var range = this.trackWindow(list, selected);
    var h = '<div class="track-col' + (focused ? ' focused' : '') + '"><div class="track-head">' +
      (type === 'audio' ? 'Ses' : 'Altyazi') + '</div><div class="track-list">';
    if (!list.length) {
      h += '<div class="track-empty">Secilebilir ' + (type === 'audio' ? 'ses' : 'altyazi') + ' bulunamadi</div>';
    } else {
      for (var i = range.first; i < range.last; i++) {
        var item = list[i];
        var isCurrent = current(item, i);
        h += '<div class="track-row' + (item.action ? ' compatibility' : '') +
          (focused && i === selected ? ' focus' : '') +
          (isCurrent ? ' current' : '') + '"><span class="track-check">' + (isCurrent ? '\u2713' : '') +
          '</span><span>' + esc(item.label) + '</span></div>';
      }
    }
    return h + '</div></div>';
  },

  subtitleRows: function () {
    var state = this.vodTracks || Player.emptyTracks();
    var rows = [{ index: 'off', label: 'Kapali', preferenceKey: 'off' }].concat(state.text);
    if (Player.canStartSubtitleCompatibility()) {
      rows.push({
        index: 'compatibility', action: 'compatibility',
        label: 'Altyazi gorunmuyor? Uyumluluk modunu calistir'
      });
    }
    return rows;
  },

  renderTrackPanel: function () {
    var state = this.vodTracks || Player.emptyTracks();
    var textRows = this.subtitleRows();
    if (this.vodTextIndex >= textRows.length) this.vodTextIndex = Math.max(0, textRows.length - 1);
    var audioHtml = this.renderTrackColumn('audio', state.audio, this.vodAudioIndex, function (item) {
      return String(item.index) === String(state.currentAudio);
    });
    var textHtml = this.renderTrackColumn('text', textRows, this.vodTextIndex, function (item) {
      return item.index === 'off' ? state.subtitlesOff : (!state.subtitlesOff && String(item.index) === String(state.currentText));
    });
    var warning = '';
    if (!state.supported) warning = '<div class="track-warning">Bu oynatici parca listesini sunmuyor. Ayarlardan AVPlay motorunu deneyin.</div>';
    else if (Player.softwareSubtitleStatus) {
      warning = '<div class="track-warning">' + esc(Player.softwareSubtitleStatus) + '</div>';
    }
    this.overlay().innerHTML =
      '<div class="track-shade"><div class="track-panel"><div class="track-title">Ses ve Altyazi</div>' +
      '<div class="track-sub">Goruntu devam ederken seciminizi yapabilirsiniz</div>' + warning +
      '<div class="track-cols">' + audioHtml + textHtml + '</div>' +
      '<div class="track-help">\u2190\u2192 Sutun &nbsp; \u00b7 &nbsp; \u2191\u2193 Secim &nbsp; \u00b7 &nbsp; OK Uygula &nbsp; \u00b7 &nbsp; Geri Oynatici</div>' +
      '</div></div>';
  },

  moveTrackSelection: function (delta) {
    if (this.vodTrackColumn === 'audio') {
      if (!this.vodTracks.audio.length) return;
      this.vodAudioIndex = Math.max(0, Math.min(this.vodTracks.audio.length - 1, this.vodAudioIndex + delta));
    } else {
      this.vodTextIndex = Math.max(0, Math.min(this.subtitleRows().length - 1, this.vodTextIndex + delta));
    }
    this.renderTrackPanel();
  },

  selectFocusedTrack: function () {
    var selected, ok;
    if (this.vodTrackColumn === 'audio') {
      selected = this.vodTracks.audio[this.vodAudioIndex];
      if (!selected) { UI.toast('Secilebilir ses parcasi yok'); return; }
      ok = Player.selectAudio(selected.index);
      if (ok) TrackPrefs.set(this.vodMeta, 'audio', selected.preferenceKey);
      UI.toast(ok ? 'Ses: ' + selected.label : 'Ses parcasi secilemedi');
    } else if (this.vodTextIndex === 0) {
      ok = Player.selectSubtitle('off');
      if (ok) TrackPrefs.set(this.vodMeta, 'text', 'off');
      UI.toast(ok ? 'Altyazi kapatildi' : 'Altyazi kapatilamadi');
    } else {
      var textRows = this.subtitleRows();
      selected = textRows[this.vodTextIndex];
      if (!selected) return;
      if (selected.action === 'compatibility') {
        ok = Player.startSubtitleCompatibility();
        UI.toast(ok ? 'Altyazi uyumluluk modu baslatiliyor' : 'Uyumluluk modu baslatilamadi', 4000);
      } else {
        ok = Player.selectSubtitle(selected.index);
        if (ok) TrackPrefs.set(this.vodMeta, 'text', selected.preferenceKey);
        UI.toast(ok
          ? (Player.softwareSubtitleStatus.indexOf('hazirlaniyor') !== -1
            ? Player.softwareSubtitleStatus : 'Altyazi: ' + selected.label)
          : 'Altyazi secilemedi', 4000);
      }
    }
    this.vodTracks = Player.tracks;
    if (Player.isPreparing()) return;
    this.renderTrackPanel();
  },

  runVodControl: function () {
    var control = this.vodControls()[this.vodControlIndex];
    if (!control) return;
    if (control.id === 'back') Player.seek(-10);
    else if (control.id === 'toggle') Player.toggle();
    else if (control.id === 'forward') Player.seek(30);
    else if (control.id === 'tracks') { this.openTrackPanel(); return; }
    else if (control.id === 'subtitleSize') this.cycleSubtitleSize();
    else if (control.id === 'aspect') {
      var name = Player.cycleAspect();
      UI.toast(Player.lastAspectApplied ? 'Goruntu formati: ' + name : 'Goruntu modu uygulanamadi');
    }
    this.showVodControls(6000);
  },

  keyVod: function (e) {
    var c = e.keyCode;
    e.preventDefault();

    if (Diag.visible) { if (c === KEY.BACK || c === KEY.ENTER) Diag.hide(); return; }

    if (c === KEY.STOP) { this.exit(); return; }
    if (c === KEY.RED) { Diag.toggle(); return; }
    if (c === KEY.INFO && this.vodTechnicalInfo) { Diag.render(); return; }

    if (this.vodPanel === 'preparing') {
      if (c === KEY.UP) { Player.retrySubtitlePreparation(); return; }
      if (c === KEY.ENTER) { Player.skipSubtitlePreparation(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.exit(); return; }
      return;
    }

    if (this.vodPanel === 'tracks') {
      if (c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) { Player.toggle(); return; }
      if (c === KEY.LEFT) { this.vodTrackColumn = 'audio'; this.renderTrackPanel(); return; }
      if (c === KEY.RIGHT) { this.vodTrackColumn = 'text'; this.renderTrackPanel(); return; }
      if (c === KEY.UP) { this.moveTrackSelection(-1); return; }
      if (c === KEY.DOWN) { this.moveTrackSelection(1); return; }
      if (c === KEY.ENTER) { this.selectFocusedTrack(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.showVodControls(6000); return; }
      return;
    }

    if (this.vodPanel === 'controls') {
      if (c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) {
        Player.toggle(); this.showVodControls(6000); return;
      }
      if (c === KEY.RW) { Player.seek(-10); this.showVodControls(6000); return; }
      if (c === KEY.FF) { Player.seek(30); this.showVodControls(6000); return; }
      if (c === KEY.LEFT) {
        this.vodControlIndex = Math.max(0, this.vodControlIndex - 1);
        this.showVodControls(6000); return;
      }
      if (c === KEY.RIGHT) {
        this.vodControlIndex = Math.min(this.vodControls().length - 1, this.vodControlIndex + 1);
        this.showVodControls(6000); return;
      }
      if (c === KEY.ENTER) { this.runVodControl(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.hideVodOverlay(); return; }
      if (c === KEY.DOWN) { this.showVodInfo(4000); return; }
      if (c === KEY.INFO) { this.showVodInfo(7000, true); return; }
      if (c === KEY.UP) { this.showVodControls(6000); return; }
      if (c === KEY.BLUE) {
        var menuAspect = Player.cycleAspect();
        this.showVodControls(6000);
        UI.toast(Player.lastAspectApplied ? 'Goruntu formati: ' + menuAspect : 'Goruntu modu uygulanamadi');
        return;
      }
      return;
    }

    if (this.vodPanel === 'error') {
      if (c === KEY.INFO || c === KEY.UP) { Diag.render(); return; }
      if (c === KEY.BACK || c === KEY.ESC) this.exit();
      return;
    }

    /* OSD kapali veya yalnizca bilgi gorunurken hizli tuslar dogrudan calisir. */
    if (c === KEY.ENTER || c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) {
      Player.toggle(); this.showVodInfo(3500); return;
    }
    if (c === KEY.LEFT || c === KEY.RW) { Player.seek(-10); this.showVodInfo(3500); return; }
    if (c === KEY.RIGHT || c === KEY.FF) { Player.seek(30); this.showVodInfo(3500); return; }
    if (c === KEY.UP) {
      this.vodControlIndex = 3; /* Yukari + OK ile dogrudan Ses ve Altyazi. */
      this.showVodControls(6000); return;
    }
    if (c === KEY.DOWN) {
      if (this.vodPanel === 'info') this.hideVodOverlay();
      else this.showVodInfo(4000);
      return;
    }
    if (c === KEY.INFO) { this.showVodInfo(7000, true); return; }
    if (c === KEY.BLUE) {
      var aspectName = Player.cycleAspect();
      this.showVodInfo(4000);
      UI.toast(Player.lastAspectApplied
        ? 'Goruntu formati: ' + aspectName
        : 'Bu goruntu modu oynatici tarafindan uygulanamadi', 3200);
      return;
    }
    if (c === KEY.BACK || c === KEY.ESC) {
      if (this.vodPanel === 'info') this.hideVodOverlay();
      else this.exit();
      return;
    }
  },

  /* ---------- ortak ---------- */

  showOsd: function (ms) {
    this.osdOn = true;
    var ov = this.overlay();
    ov.className = 'on';
    if (this.osdTimer) clearTimeout(this.osdTimer);
    var self = this;
    this.osdTimer = setTimeout(function () {
      self.osdOn = false;
      self.liveTechnicalInfo = false;
      ov.innerHTML = '';
    }, ms || 4000);
  },

  showError: function (msg) {
    if (this.mode === 'live' && this.previewOn) {
      var caption = document.getElementById('lv-playing');
      if (caption) caption.textContent = 'Ön izleme açılamadı: ' + msg;
      UI.spin(false); Diag.add('On izleme: ' + msg); return;
    }
    var hint = this.mode === 'live'
      ? 'Baglanti veya yayin bicimi uyumsuz olabilir; yesil tusla yeniden baglanabilirsiniz.'
      : 'Codec desteklense bile dosya yapisi TV ayrisitiricisi ile uyumsuz olabilir.';
    if (this.mode === 'vod') hint += '<br><br>Yukari / INFO: Ayrintili teshis raporu';
    this.overlay().className = 'on';
    if (this.mode === 'vod') { this.vodPanel = 'error'; this.osdOn = true; }
    if (this.mode === 'vod') this.renderSubtitle('');
    this.overlay().innerHTML =
      '<div class="player-msg"><div class="big">Yayin acilamadi</div>' +
      '<div class="small">' + esc(msg) + '<br><br>' + hint +
      '<br><br>Geri tusu ile listeye donun.</div></div>';
    if (this.osdTimer) clearTimeout(this.osdTimer);
    var source = this.vodMeta
      ? this.vodMeta.kind + ':' + this.vodMeta.id
      : (this.channels && this.channels[this.index] ? 'live:' + this.channels[this.index].stream_id : 'bilinmiyor');
    Diag.add('Oynatma: ' + msg + ' [' + source + ']');
  },

  exit: function (focusCategories) {
    if (this.mode === 'vod' && this.vodMeta) {
      Resume.save(this.vodMeta.kind, this.vodMeta.id, Player.position(), Player.duration(), this.vodMeta.name);
    }
    if (this.saveTimer) { clearInterval(this.saveTimer); this.saveTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.channelOpenTimer) { clearTimeout(this.channelOpenTimer); this.channelOpenTimer = null; }
    if (this.liveStableTimer) { clearTimeout(this.liveStableTimer); this.liveStableTimer = null; }
    if (this.bufferSession) { LiveBuffer.end(this.bufferSession); this.bufferSession = null; }
    if (this.osdTimer) clearTimeout(this.osdTimer);
    if (this.numTimer) { clearTimeout(this.numTimer); this.numTimer = null; }
    this.numBuf = '';
    if (this.mode === 'live' && App.route === 'live' && App.live.chans &&
      this.channels === App.live.chans.items && this.index < App.live.chans.items.length) {
      App.live.chans.jumpTo(this.index);
      App.live.chans.setCurrent(this.channels[this.index].stream_id);
    }
    Player.stop();
    Player.setViewport(null);
    this.previewOn = false; this.previewAvailable = false;
    var caption = document.getElementById('lv-playing');
    if (caption) caption.innerHTML = '';
    var slot = document.getElementById('lv-preview');
    if (slot) slot.innerHTML = '<span>' + App.live.previewHelpHtml() + '</span>';
    this.overlay().className = '';
    this.overlay().innerHTML = '';
    this.mode = null;
    this.channelListOn = false;
    this.recentChannelsOn = false;
    this.vodPanel = 'hidden';
    this.vodTracks = null;
    this.vodReady = false;
    this.subtitleText = '';
    this.updateSubtitleLayer();
    Nav.clearOverlay();
    if (focusCategories && Nav.zoneById('cats')) Nav.focus('cats');
    else if (Nav.zone) Nav.zone.setFocused(true);
  }
};

/* film / dizi durum nesneleri */
(function () {
  function makeVod(kind) {
    return {
      cats: null, grid: null, currentCat: null, timer: null,
      searchInput: null, searchQuery: '', searchTimer: null, searchToken: 0,
      restoreRequested: false, savedCatId: null, savedCatIndex: 0, savedGridIndex: 0,
      beginView: function (restore) {
        this.restoreRequested = !!restore && this.savedCatId != null;
        this.resetSearch();
      },
      remember: function () {
        if (!this.currentCat || !this.cats || !this.grid) return;
        this.savedCatId = this.currentCat.category_id;
        this.savedCatIndex = this.cats.index;
        this.savedGridIndex = this.grid.index;
      },
      resetSearch: function () {
        if (this.timer) clearTimeout(this.timer);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.currentCat = null;
        this.searchQuery = '';
        this.searchToken++;
        if (this.searchInput) this.searchInput.value = '';
        var state = document.getElementById('g-search-state');
        if (state) state.textContent = '';
      },
      search: function (value) {
        var self = this;
        var raw = String(value || '').trim();
        var q = norm(raw).trim();
        var state = document.getElementById('g-search-state');
        if (this.searchTimer) clearTimeout(this.searchTimer);

        if (q.length < 3) {
          var wasSearching = this.searchQuery.length >= 3;
          this.searchQuery = '';
          this.searchToken++;
          if (state) state.textContent = q.length ? (3 - q.length) + ' harf daha yazin' : '';
          if (wasSearching && this.currentCat) this._load(this.currentCat);
          return;
        }

        this.searchQuery = q;
        if (this.timer) clearTimeout(this.timer);
        var token = ++this.searchToken;
        if (state) state.textContent = 'Araniyor...';
        this.searchTimer = setTimeout(function () {
          UI.spin(true);
          var p = kind === 'movie' ? Api.vodStreams('') : Api.seriesList('');
          p.then(function (all) {
            UI.spin(false);
            if (token !== self.searchToken || self.searchQuery !== q) return;
            if (self.searchInput !== document.getElementById('g-search')) return;
            var out = [];
            for (var i = 0; i < all.length; i++) {
              if (norm(all[i].name).indexOf(q) !== -1) out.push(all[i]);
            }
            self.grid.emptyText = 'Aramanizla eslesen icerik bulunamadi';
            self.grid.setItems(out);
            var title = document.getElementById('g-title');
            var count = document.getElementById('g-count');
            if (title) title.textContent = 'Arama: ' + raw;
            if (count) count.textContent = out.length + ' baslik';
            if (state) state.textContent = out.length + ' sonuc';
          })['catch'](function (e) {
            UI.spin(false);
            if (token !== self.searchToken) return;
            if (state) state.textContent = 'Arama yapilamadi';
            UI.toast(e.message || 'Arama yapilamadi', 3500);
          });
        }, 220);
      },
      init: function () {
        var self = this;
        UI.spin(true);
        var p = kind === 'movie' ? Api.vodCategories() : Api.seriesCategories();
        p.then(function (list) {
          UI.spin(false);
          list = CategoryVisibility.visibleList(kind, list);
          var all = [{ category_id: '__all', category_name: 'Tumu' }].concat(list);
          self.cats.setItems(all);
          if (self.restoreRequested) {
            var found = -1;
            for (var i = 0; i < all.length; i++) {
              if (String(all[i].category_id) === String(self.savedCatId)) { found = i; break; }
            }
            if (found < 0 && self.savedCatIndex < all.length) found = self.savedCatIndex;
            if (found >= 0) {
              self.savedCatId = all[found].category_id;
              self.cats.jumpTo(found);
            }
          }
        })['catch'](function (e) {
          UI.spin(false);
          UI.toast(e.message || 'Kategoriler alinamadi', 4000);
        });
      },
      loadCategory: function (cat) {
        var self = this;
        if (this.searchQuery.length >= 3) return;
        this.currentCat = cat;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(function () { self._load(cat); }, 260);
      },
      _load: function (cat) {
        var self = this;
        if (!cat || this.searchQuery.length >= 3) return;
        var title = document.getElementById('g-title');
        if (!title) return;
        title.textContent = cat.category_name;
        UI.spin(true);
        var id = cat.category_id === '__all' ? '' : cat.category_id;
        var p = kind === 'movie' ? Api.vodStreams(id) : Api.seriesList(id);
        p.then(function (items) {
          UI.spin(false);
          if (self.currentCat !== cat || self.searchQuery.length >= 3) return;
          self.grid.setItems(items);
          if (self.restoreRequested && String(cat.category_id) === String(self.savedCatId)) {
            self.grid.jumpTo(self.savedGridIndex);
            self.restoreRequested = false;
            Nav.focus('grid');
          }
          var count = document.getElementById('g-count');
          if (count) count.textContent = items.length + ' baslik';
        })['catch'](function (e) {
          UI.spin(false);
          UI.toast(e.message || 'Icerik alinamadi', 4000);
        });
      }
    };
  }
  App.vod.movie = makeVod('movie');
  App.vod.series = makeVod('series');
})();

/* acilis */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { App.boot(); });
} else {
  App.boot();
}
