/* app.js - yonlendirme, ekran mantigi ve oynatma katmani */
'use strict';

var App = {
  versionLabel: 'H&M.v2.0.0',
  route: null,
  history: [],
  rail: null,
  accountSwitching: false,

  /* ---------------- acilis ---------------- */

  boot: function () {
    Settings.load();
    I18n.apply();
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
      else if (!Settings.get('languageChosen')) Views.languageSetup({ initial: true });
      else Views.login({ add: true, initial: true });
    }
  },

  useProfile: function (profile) {
    Api.configure(profile.server, profile.username, profile.password);
    AccountData.use(profile.server, profile.username);
    Settings.bindAccount(!!profile.migrateSettings);
    if (profile.migrateSettings) Accounts.markSettingsMigrated(profile.id);
    Favs.load(); Resume.load(); Recent.load(); LiveBuffer.load();
    this.home.launchChecked = false;
    Diag.set('Hesap profili', AccountData.scope);
    this.refreshRailAccount();
  },

  refreshRailAccount: function () {
    var profile = Accounts.active();
    var name = document.getElementById('rail-account-name');
    if (name) name.textContent = profile ? (profile.name || profile.username) : t('rail.account');
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
    var startup = Settings.get('startupScreen') || 'home';
    if (['home', 'live', 'movies', 'series'].indexOf(startup) === -1) startup = 'home';
    this.go(startup);
  },

  /* ---------------- sol serit ---------------- */

  railDefs: [
    { id: 'home', ic: 'home', txKey: 'rail.home' },
    { id: 'live', ic: 'live', txKey: 'rail.live' },
    { id: 'movies', ic: 'movies', txKey: 'rail.movies' },
    { id: 'series', ic: 'series', txKey: 'rail.series' },
    { id: 'favs', ic: 'favs', txKey: 'rail.favs' },
    { id: 'recent', ic: 'recent', txKey: 'rail.recent' },
    { id: 'settings', ic: 'settings', txKey: 'rail.settings' },
    { id: 'about', ic: 'about', txKey: 'rail.about' }
  ],

  buildRail: function () {
    var wrap = document.getElementById('rail');
    wrap.innerHTML = '';
    var nodes = [];
    for (var i = 0; i < this.railDefs.length; i++) {
      var d = this.railDefs[i];
      var n = el('div', 'rail-item',
        '<span class="ic">' + uiIcon(d.ic) + '</span><span class="tx">' + t(d.txKey) + '</span>');
      wrap.appendChild(n);
      nodes.push(n);
    }
    var spacer = el('div', ''); spacer.id = 'rail-spacer';
    wrap.appendChild(spacer);
    var active = Accounts.active();
    var account = el('div', 'rail-account', uiIcon('account') +
      '<span id="rail-account-name">' + esc(active ? (active.name || active.username) : t('rail.account')) + '</span>');
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
    var order = ['home0', 'cats', 'profiles', 'actions', 'list', 'btns', 'bar', 'seasons', 'grid', 'chans'];
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
    /* Detay/oynatici donusu ayni kutuphane oturumudur; App.go cagrilmaz. Sol
       seritten gercekten baska bir bolume gecildiginde gecici VOD filtresi
       Tumu'ne doner. Gorunum ve siralama tercihleri kalici olmaya devam eder. */
    var leaving = this.route;
    if ((leaving === 'movies' || leaving === 'series') && name !== leaving) {
      var leavingKind = leaving === 'movies' ? 'movie' : 'series';
      if (typeof VodPrefs !== 'undefined') VodPrefs.set(leavingKind, 'filter', 'all');
      if (this.vod[leavingKind] && this.vod[leavingKind].prefs) this.vod[leavingKind].prefs.filter = 'all';
    }
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
      '<div class="exit-sub">Yon tuslari: Secim&nbsp;&nbsp;&nbsp; OK: Uygula&nbsp;&nbsp;&nbsp; Geri: Iptal</div>' +
      '<div class="exit-actions"><div class="btn primary">Cikis yap</div>' +
      '<div class="btn focus">Iptal</div></div></div></div>';
    var self = this;
    this._confirmIndex = 1;
    this._confirmAction = function () {
        try { tizen.application.getCurrentApplication().exit(); }
        catch (err) { try { window.close(); } catch (err2) { } }
    };
    Nav.setOverlay(function (e) { self.handleConfirmKey(e); });
  },

  confirmDialog: function (title, message, okLabel, onConfirm) {
    if (this._exitPromptOn) return;
    this._exitPromptOn = true;
    var ov = document.getElementById('overlay');
    ov.className = 'on';
    ov.innerHTML = '<div class="exit-confirm"><div class="exit-box">' +
      '<div class="exit-title">' + esc(title) + '</div>' +
      '<div class="exit-sub">' + esc(message) + '<br><br>Yon tuslari: Secim&nbsp;&nbsp;&nbsp; OK: Uygula&nbsp;&nbsp;&nbsp; Geri: Iptal</div>' +
      '<div class="exit-actions"><div class="btn primary">' + esc(okLabel) + '</div>' +
      '<div class="btn focus">Iptal</div></div></div></div>';
    var self = this;
    this._confirmIndex = 1;
    this._confirmAction = onConfirm || null;
    Nav.setOverlay(function (e) { self.handleConfirmKey(e); });
  },

  updateConfirmFocus: function () {
    var buttons = document.querySelectorAll('#overlay .exit-actions .btn');
    for (var i = 0; i < buttons.length; i++) {
      var base = 'btn' + (i === 0 ? ' primary' : '');
      buttons[i].className = base + (i === this._confirmIndex ? ' focus' : '');
    }
  },

  handleConfirmKey: function (e) {
    var c = e.keyCode; e.preventDefault();
    if (c === KEY.LEFT) this._confirmIndex = 0;
    else if (c === KEY.RIGHT) this._confirmIndex = 1;
    else if (c === KEY.UP || c === KEY.DOWN) this._confirmIndex = this._confirmIndex ? 0 : 1;
    else if (c === KEY.BACK || c === KEY.ESC) { this.closeExitPrompt(); return; }
    else if (c === KEY.ENTER) {
      var confirm = this._confirmIndex === 0, action = this._confirmAction;
      this.closeExitPrompt();
      if (confirm && action) action();
      return;
    } else return;
    this.updateConfirmFocus();
  },

  closeExitPrompt: function () {
    if (!this._exitPromptOn) return;
    this._exitPromptOn = false;
    this._confirmIndex = 1;
    this._confirmAction = null;
    var ov = document.getElementById('overlay');
    ov.className = '';
    ov.innerHTML = '';
    Nav.clearOverlay();
  },

  choiceDialog: function (title, options, selectedValue, onChoose) {
    var ov = document.getElementById('overlay');
    var index = 0;
    for (var i = 0; i < options.length; i++) {
      if (String(options[i].value) === String(selectedValue)) { index = i; break; }
    }
    function render() {
      var rows = '';
      for (var n = 0; n < options.length; n++) {
        rows += '<div class="choice-row' + (n === index ? ' focus' : '') + '">' +
          '<span>' + esc(options[n].label) + '</span>' +
          (String(options[n].value) === String(selectedValue) ? '<b>Secili</b>' : '') + '</div>';
      }
      ov.className = 'on';
      ov.innerHTML = '<div class="choice-shade"><div class="choice-panel">' +
        '<div class="choice-title">' + esc(title) + '</div><div class="choice-list">' + rows + '</div>' +
        '<div class="choice-help">↑↓ Secim · OK Uygula · Geri Kapat</div></div></div>';
    }
    function close() {
      ov.className = '';
      ov.innerHTML = '';
      Nav.clearOverlay();
    }
    render();
    Nav.setOverlay(function (e) {
      var code = e.keyCode;
      e.preventDefault();
      if (code === KEY.UP) { index = Math.max(0, index - 1); render(); }
      else if (code === KEY.DOWN) { index = Math.min(options.length - 1, index + 1); render(); }
      else if (code === KEY.BACK || code === KEY.ESC) close();
      else if (code === KEY.ENTER) {
        var chosen = options[index];
        close();
        if (chosen && onChoose) onChoose(chosen.value);
      }
    });
  },

  home: {
    busy: false, onLatest: null,
    /* Yeni eklenenler her uygulama acilisinda bir kez saglayicidan alinir.
       Acik oturumda sureli yenileme yok; Katalogu guncelle eylemi bayragi sifirlar. */
    launchChecked: false,
    latest: function () {
      var cache = AccountData.get('homeLatest', null);
      return cache && cache.items instanceof Array ? cache.items : (cache instanceof Array ? cache : []);
    },
    localSections: function () {
      var recent = Recent.list(), continuing = [], updates = [];
      for (var i = 0; i < recent.length; i++) {
        var row = recent[i];
        if (!row.raw) continue;
        var card = { kind: row.kind, raw: row.raw, name: row.name, icon: row.icon || '', sub: row.episodeTitle || '' };
        if (continuing.length < 6) continuing.push(card);
        if (row.kind === 'series' && updates.length < 6 && SeriesUpdates.candidate(row.raw)) updates.push(card);
      }
      var favorites = Favs.home(recent, 6);
      var history = LiveHistory.list(), channels = [];
      for (i = 0; i < history.length && i < 6; i++) {
        channels.push({ kind: 'live', raw: history[i], name: history[i].name, icon: history[i].stream_icon || '', sub: history[i].category_name || 'Canlı TV' });
      }
      return [
        { title: 'İzlemeye devam et', layout: 'portrait', empty: 'İzlemeye başladığınız içerikler burada görünür.', items: continuing },
        { title: 'Favorileriniz', layout: 'portrait', empty: 'Sarı tuşla favori eklediğiniz içerikler burada görünür.', items: favorites },
        { title: 'Yeni bölümler', layout: 'portrait', empty: 'Takip ettiğiniz dizilerde doğrulanmış yeni bölüm yok.', items: updates },
        { title: 'Son kanallar', layout: 'landscape', empty: 'Tam ekranda izlediğiniz son kanallar burada görünür.', items: channels },
        { title: 'Yeni eklenenler', layout: 'portrait', empty: 'Katalog arka planda hazırlanıyor.', items: this.latest() }
      ];
    },
    open: function (card) {
      if (!card || !card.raw) return;
      /* Ana sayfadaki kanal karti tek elemanli bir oynatma listesi acarsa
         CH+/CH- ayni kanala sarar. Kayitli kategori listesini getirip kanali
         o listenin dogru sirasinda ac. */
      if (card.kind === 'live') Playback.switchStoredChannel(card.raw);
      else App.detail.open(card.kind, card.raw);
    },
    refreshLatest: function () {
      if (this.busy) return;
      var cached = AccountData.get('homeLatest', null);
      if (this.launchChecked && cached && cached.items instanceof Array) {
        if (this.onLatest) this.onLatest(cached.items);
        return;
      }
      this.busy = true;
      var self = this, movies = [];
      Api.vodStreams('').then(function (rows) {
        for (var i = 0; i < rows.length; i++) rows[i].__homeKind = 'movie';
        movies = rows;
        return Api.seriesList('');
      }).then(function (series) {
        for (var i = 0; i < series.length; i++) series[i].__homeKind = 'series';
        var all = movies.concat(series);
        all.sort(function (a, b) {
          var av = parseInt(a.added || a.last_modified || 0, 10) || 0;
          var bv = parseInt(b.added || b.last_modified || 0, 10) || 0;
          return bv - av;
        });
        var latest = [];
        for (var n = 0; n < all.length && latest.length < 6; n++) {
          var item = all[n], kind = item.__homeKind;
          latest.push({ kind: kind, raw: item, name: item.name, icon: item.stream_icon || item.cover || '', sub: kind === 'movie' ? 'Film' : 'Dizi' });
        }
        AccountData.set('homeLatest', { ts: Date.now(), items: latest });
        delete Api.cache['vst:'];
        delete Api.cache['sls:'];
        movies = []; all = [];
        self.launchChecked = true;
        self.busy = false;
        if (self.onLatest) self.onLatest(latest);
      })['catch'](function () { self.busy = false; });
    }
  },

  /* =============================== CANLI TV =============================== */

  live: {
    cats: null, chans: null, currentCat: null,
    catTimer: null, epgTimer: null, numBuf: '', numTimer: null,
    searchInput: null, searchQuery: '', searchTimer: null, searchToken: 0,
    adultCategoryIds: {},
    dailyEpg: null, dailyIndex: 0, dailyChannel: null, dailyClose: null,

    previewHelpHtml: function () {
      return Player.pick(true) === 'html5'
        ? 'OK: Kanalı burada ön izle'
        : '<b>OK: Kanalı AVPlay ile burada ön izle</b><br><em>Aynı kanalda tekrar OK: Tam ekran</em>';
    },

    categoryName: function (categoryId, fallback) {
      for (var i = 0; this.cats && i < this.cats.items.length; i++) {
        if (String(this.cats.items[i].category_id) === String(categoryId)) return this.cats.items[i].category_name;
      }
      return fallback || 'Kanallar';
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
            if (!Settings.get('includeAdultSearch') && self.adultCategoryIds[String(all[i].category_id)]) continue;
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
        self.adultCategoryIds = {};
        for (var ai = 0; ai < list.length; ai++) {
          if (isAdultCategoryName(list[ai].category_name)) self.adultCategoryIds[String(list[ai].category_id)] = true;
        }
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

    adoptPlaybackCategory: function (items, index, categoryId, categoryName) {
      if (!this.chans) return;
      if (this.catTimer) { clearTimeout(this.catTimer); this.catTimer = null; }
      if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
      this.searchQuery = '';
      this.searchToken++;
      if (this.searchInput) this.searchInput.value = '';
      var searchState = document.getElementById('lv-search-state');
      if (searchState) searchState.textContent = '';

      var cat = null, catIndex = -1;
      for (var i = 0; this.cats && i < this.cats.items.length; i++) {
        if (String(this.cats.items[i].category_id) === String(categoryId)) {
          cat = this.cats.items[i]; catIndex = i; break;
        }
      }
      this.currentCat = cat || { category_id: categoryId, category_name: categoryName || 'Kanallar' };
      if (this.cats && catIndex >= 0) {
        this.cats.index = catIndex; this.cats.ensure(); this.cats.draw();
      }
      this.chans.emptyText = 'Bu kategoride kanal yok';
      this.chans.setItems(items || []);
      if (items && items.length) this.chans.jumpTo(Math.max(0, Math.min(items.length - 1, index || 0)));
      var title = document.getElementById('lv-title');
      var count = document.getElementById('lv-count');
      if (title) title.textContent = this.currentCat.category_name || 'Kanallar';
      if (count) count.textContent = (items ? items.length : 0) + ' kanal';
      if (categoryId != null && String(categoryId).indexOf('__') !== 0) AccountData.set('lastLiveCat', categoryId);
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
          (i ? 'Sıradaki' : 'Şimdi') + ' · ' + hhmm(epgStart(program)) + ' – ' +
          hhmm(epgEnd(program)) + '</div><div class="live-program-title">' +
          esc(b64(program.title) || 'Program adı belirtilmemiş') + '</div></div>';
      }).join('') + '</div>';
    },

    openDailyEpg: function (ch, onClose) {
      if (!ch) return;
      if (!Settings.get('epg')) { UI.toast('Yayin akisi ayarlardan kapali'); return; }
      this.dailyChannel = ch; this.dailyEpg = null; this.dailyIndex = 0;
      this.dailyClose = typeof onClose === 'function' ? onClose : null;
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
          var when = epgStart(list[i]);
          if (when && when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth() &&
            when.getDate() === today.getDate()) filtered.push(list[i]);
        }
        self.dailyEpg = filtered.length ? filtered : list;
        var now = Date.now();
        for (var n = 0; n < self.dailyEpg.length; n++) {
          var end = epgEnd(self.dailyEpg[n]);
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
      var now = Date.now();
      for (var i = first; i < Math.min(list.length, first + visible); i++) {
        var item = list[i], starts = epgStart(item), ends = epgEnd(item);
        var current = starts && ends && starts.getTime() <= now && ends.getTime() > now;
        var cls = 'daily-row' + (i === this.dailyIndex ? ' selected' : '') + (current ? ' current' : '');
        h += '<div class="' + cls + '"><div class="daily-time">' + hhmm(starts) + ' – ' +
          hhmm(ends) + '</div><div class="daily-program">' +
          esc(b64(item.title) || 'Program adı belirtilmemiş') + (current ? '<span class="daily-now">ŞİMDİ</span>' : '') + '</div></div>';
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
      var onClose = this.dailyClose;
      this.dailyChannel = null; this.dailyEpg = null; this.dailyIndex = 0;
      this.dailyClose = null;
      var overlay = document.getElementById('overlay');
      overlay.className = ''; overlay.innerHTML = '';
      Nav.clearOverlay();
      if (onClose) onClose();
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
      Playback.startLive(this.chans.items, index, {
        preview: true,
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
    requestId: 0, activeKey: '', tmdbData: null, tmdbSeasons: null,
    activeSeason: null, applyTmdbSeason: null,
    open: function (kind, item) {
      var requestId = ++this.requestId;
      this.activeKey = kind + ':' + String(kind === 'movie' ? item.stream_id : item.series_id);
      this.tmdbData = null; this.tmdbSeasons = {}; this.activeSeason = null; this.applyTmdbSeason = null;
      var route = App.route;
      var vodRoute = kind === 'movie' ? 'movies' : 'series';
      if (route === vodRoute && App.vod[kind]) App.vod[kind].remember();
      var back = (function (r, k, restore) {
        return function () { App.go(r, restore ? { restoreVod: k } : null); };
      })(route, kind, route === vodRoute);
      App.history = [back];
      if (Views.detailLoading) Views.detailLoading(kind, item, back);
      UI.spin(true);
      var p = kind === 'movie' ? Api.vodInfo(item.stream_id) : Api.seriesInfo(item.series_id);
      var self = this;
      p.then(function (info) {
        if (requestId !== self.requestId) return;
        UI.spin(false);
        Diag.set('Detay istegi', kind + ' · basarili');
        Views.detail(kind, item, info);
        self.enrich(kind, item, info, requestId);
      })['catch'](function (e) {
        if (requestId !== self.requestId) return;
        UI.spin(false);
        Views.detail(kind, item, null);
        self.enrich(kind, item, null, requestId);
        Diag.add('detay bilgisi alinamadi: ' + e.message);
      });
    },

    enrich: function (kind, item, info, requestId) {
      var self = this;
      if (!Tmdb.configured()) return;
      setTimeout(function () {
        if (requestId !== self.requestId) return;
        Tmdb.lookup(kind, item, info).then(function (result) {
          if (requestId !== self.requestId) return;
          if (!result || result.state !== 'found') {
            Diag.set('TMDb detay', result && result.state ? result.state : 'sonuc yok');
            return;
          }
          Diag.set('TMDb detay', 'eslesti · arka plan ' + (result.data && result.data.backdrop ? 'var' : 'yok'));
          self.tmdbData = result.data;
          if (Views.enhanceDetail) Views.enhanceDetail(result.data);
          if (kind === 'series' && self.activeSeason != null) self.loadSeasonVisuals(self.activeSeason, requestId);
        })['catch'](function (error) {
          Diag.add('TMDb detay basarisiz: ' + (error && error.message ? error.message : error));
        });
      }, 240);
    },

    loadSeasonVisuals: function (season, requestId) {
      var self = this;
      this.activeSeason = String(season);
      if (!this.tmdbData || !this.tmdbData.id || !this.applyTmdbSeason) return;
      if (this.tmdbSeasons[this.activeSeason]) {
        this.applyTmdbSeason(this.activeSeason, this.tmdbSeasons[this.activeSeason]); return;
      }
      Tmdb.season(this.tmdbData.id, this.activeSeason).then(function (data) {
        if (requestId !== self.requestId || String(self.activeSeason) !== String(season)) return;
        self.tmdbSeasons[String(season)] = data;
        if (self.applyTmdbSeason) self.applyTmdbSeason(String(season), data);
      })['catch'](function () { });
    },

    playMovie: function (item, info, startAt) {
      var ext = 'mp4';
      if (info && info.movie_data && info.movie_data.container_extension) ext = info.movie_data.container_extension;
      var detailMeta = (info && (info.info || info)) || {};
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
        progressId: item.stream_id,
        cover: item.stream_icon || '',
        title: item.name,
        mediaType: 'Film',
        plot: detailMeta.plot || detailMeta.description || item.plot || item.description || '',
        year: detailMeta.releasedate || detailMeta.releaseDate || item.year || item.releaseDate || '',
        backdrop: detailMeta.backdrop || detailMeta.backdrop_path || detailMeta.movie_image || detailMeta.cover_big || item.backdrop || item.backdrop_path || '',
        sourceItem: item,
        sourceInfo: info,
        detailKind: 'movie',
        extension: ext,
        videoInfo: info && info.info && info.info.video ? info.info.video : null,
        startAt: startAt || 0
      });
    },

  playEpisode: function (series, ep, seriesMeta, playbackState) {
      var ext = ep.container_extension || 'mp4';
      var progressId = ep.__progressId || ep.id;
      var r = Resume.get('ep', progressId);
      var candidates = ep.__candidates && ep.__candidates.length ? ep.__candidates : [ep];
      var epInfo = ep.info && typeof ep.info === 'object' ? ep.info : {};
      seriesMeta = seriesMeta && typeof seriesMeta === 'object' ? seriesMeta :
        (ep.__seriesMeta && typeof ep.__seriesMeta === 'object' ? ep.__seriesMeta : {});
      var episodeTitle = ep.title || epInfo.name || ('Bolum ' + ep.episode_num);
      Recent.add({
        kind: 'series', id: series.series_id, name: series.name,
        icon: series.cover || '', raw: series,
        episodeId: ep.id, episodeTitle: episodeTitle
      });
      playbackState = playbackState || {};
      Playback.startVod({
        url: Api.episodeUrl(ep.id, ext),
        name: series.name + ' - ' + episodeTitle,
        title: series.name,
        episodeTitle: episodeTitle,
        mediaType: 'Dizi',
        plot: epInfo.plot || epInfo.description || '',
        year: seriesMeta.releasedate || seriesMeta.releaseDate || series.releaseDate || series.year || '',
        backdrop: seriesMeta.backdrop || seriesMeta.backdrop_path || seriesMeta.movie_image || seriesMeta.cover_big ||
          series.backdrop || series.backdrop_path || series.cover || '',
        kind: 'ep',
        id: ep.id,
        progressId: progressId,
        seriesId: series.series_id,
        season: ep.__season || ep.season || '',
        episodeNum: ep.episode_num || '',
        cover: series.cover || '',
        sourceCandidates: candidates,
        nextEpisode: ep.__next || null,
        previousEpisode: ep.__prev || null,
        seriesItem: series,
        seriesMeta: seriesMeta,
        sourceItem: series,
        sourceInfo: seriesMeta,
        detailKind: 'series',
        _sessionAspect: playbackState.sessionAspect || '',
        extension: ext,
        videoInfo: ep && ep.info && ep.info.video ? ep.info.video : (ep.video || null),
        startAt: r ? r.pos : 0
      });
    }
  },

  /* =============================== TMDB AYRINTILARI =============================== */

  tmdb: {
    active: false, requestId: 0, state: null, candidateIndex: 0,
    playerMode: false, onClose: null,

    show: function (kind, item, info, options) {
      var self = this;
      options = options || {};
      if (!Tmdb.configured()) {
        App.confirmDialog(t('tmdb.why'), t('tmdb.benefits') + ' ' + t('tmdb.optional'), t('tmdb.enable'), function () {
          Views.tmdbSettings();
        });
        return;
      }
      this.active = true;
      this.playerMode = !!options.playerMode;
      this.onClose = typeof options.onClose === 'function' ? options.onClose : null;
      this.candidateIndex = 0;
      this.state = { state: 'loading', title: item.name || '' };
      this.render();
      Nav.setOverlay(function (e) { self.key(e); });
      var requestId = ++this.requestId;
      Tmdb.lookup(kind, item, info).then(function (result) {
        if (!self.active || requestId !== self.requestId) return;
        self.state = result;
        self.candidateIndex = 0;
        self.render();
      })['catch'](function (error) {
        if (!self.active || requestId !== self.requestId) return;
        self.state = { state: 'error', message: error && error.message ? error.message : 'Bilgiler alinamadi.' };
        self.render();
      });
    },

    close: function () {
      var onClose = this.onClose;
      this.active = false;
      this.requestId++;
      this.state = null;
      this.playerMode = false;
      this.onClose = null;
      var overlay = document.getElementById('overlay');
      overlay.className = ''; overlay.innerHTML = '';
      Nav.clearOverlay();
      if (onClose) onClose();
      else Nav.focus('btns');
    },

    score: function (value) {
      value = Number(value || 0);
      return value ? value.toFixed(1).replace('.', ',') : '-';
    },

    money: function (value) {
      value = Number(value || 0);
      if (!value) return '';
      function amount(number, suffix) {
        var digits = number >= 100 ? 0 : (number >= 10 ? 1 : 2), shown = number.toFixed(digits);
        if (digits) shown = shown.replace(/0+$/, '').replace(/\.$/, '');
        return '$' + shown.replace('.', ',') + suffix;
      }
      if (value >= 1000000000) return amount(value / 1000000000, ' milyar');
      if (value >= 1000000) return amount(value / 1000000, ' milyon');
      if (value >= 1000) return amount(value / 1000, ' bin');
      return '$' + String(Math.round(value));
    },

    platforms: function (availability) {
      availability = availability || { status: 'error', groups: [] };
      var region = availability.region || I18n.resolvedRegion();
      var heading = t('tmdb.availableIn', { region: I18n.regionName(region) });
      if (availability.status !== 'available') {
        var text = availability.status === 'none' ? t('tmdb.none') : t('tmdb.unknown');
        return '<div class="tmdb-platforms"><div class="tmdb-section-title">' + esc(heading) + '</div>' +
          '<div class="tmdb-platform-empty">' + esc(text) + '</div>' +
          '<div class="tmdb-justwatch">' + esc(t('tmdb.justwatch')) + '</div></div>';
      }
      var html = '<div class="tmdb-platforms"><div class="tmdb-section-title">' + esc(heading) + '</div>';
      for (var i = 0; i < availability.groups.length; i++) {
        var group = availability.groups[i], shown = Math.min(group.providers.length, 4);
        html += '<div class="tmdb-platform-row"><strong>' + esc(group.label) + ':</strong><span>';
        for (var j = 0; j < shown; j++) {
          var provider = group.providers[j];
          html += '<span class="tmdb-provider">' +
            (provider.logo ? '<img src="' + esc(provider.logo) + '">' : '') + esc(provider.name) + '</span>';
        }
        if (group.providers.length > shown) html += '<em>+' + (group.providers.length - shown) + '</em>';
        html += '</span></div>';
      }
      return html + '<div class="tmdb-justwatch">' + esc(t('tmdb.justwatch')) + '</div></div>';
    },

    castCards: function (cast) {
      if (!cast || !cast.length) return '';
      var html = '<div class="tmdb-section-title tmdb-cast-title">' + esc(t('tmdb.cast')) + '</div><div class="tmdb-cast-cards">';
      for (var i = 0; i < cast.length; i++) {
        var person = typeof cast[i] === 'string' ? { name: cast[i], photo: '', character: '' } : cast[i];
        html += '<div class="tmdb-person"><div class="tmdb-person-photo">' + uiIcon('account') +
          (person.photo ? '<img src="' + esc(person.photo) + '">' : '') + '</div>' +
          '<div class="tmdb-person-name">' + esc(person.name) + '</div>' +
          (person.character ? '<div class="tmdb-person-character">' + esc(person.character) + '</div>' : '') + '</div>';
      }
      return html + '</div>';
    },

    syncScroll: function () {
      var box = document.getElementById('tmdb-scroll'), bar = document.getElementById('tmdb-scrollbar');
      var thumb = document.getElementById('tmdb-scroll-thumb');
      if (!box || !bar || !thumb) return;
      var max = Math.max(0, box.scrollHeight - box.clientHeight);
      if (max < 3) { bar.className = 'tmdb-scrollbar'; return; }
      bar.className = 'tmdb-scrollbar visible';
      var height = Math.max(64, Math.round(bar.clientHeight * box.clientHeight / box.scrollHeight));
      var top = Math.round((bar.clientHeight - height) * box.scrollTop / max);
      thumb.style.height = height + 'px';
      thumb.style.top = top + 'px';
    },

    scroll: function (delta) {
      var box = document.getElementById('tmdb-scroll');
      if (!box) return;
      var max = Math.max(0, box.scrollHeight - box.clientHeight);
      box.scrollTop = Math.max(0, Math.min(max, box.scrollTop + delta));
      this.syncScroll();
    },

    render: function () {
      var overlay = document.getElementById('overlay'), state = this.state || { state: 'loading' };
      var modalClass = 'tmdb-modal' + (this.playerMode ? ' tmdb-player-modal' : '');
      overlay.className = 'on' + (this.playerMode ? ' player-info-on' : '');
      if (state.state === 'loading') {
        overlay.innerHTML = '<div class="' + modalClass + '"><div class="tmdb-head">' + esc(t('tmdb.details')) + '</div>' +
          '<div class="tmdb-loading"><i></i><span>' + esc(t('tmdb.loading')) + '</span></div>' +
          '<div class="tmdb-footer">' + esc(t('common.back')) + ': ' + esc(t('common.close')) + '</div></div>';
        return;
      }
      if (state.state === 'error' || state.state === 'notfound') {
        var message = state.state === 'notfound' ?
          t('tmdb.noMatch') : state.message;
        overlay.innerHTML = '<div class="' + modalClass + '"><div class="tmdb-head">' + esc(t('tmdb.details')) + '</div>' +
          '<div class="tmdb-empty">' + esc(message) + '</div>' +
          '<div class="tmdb-footer">' + esc(t('tmdb.closeFooter')) + '</div></div>';
        return;
      }
      if (state.state === 'candidates') {
        var rows = '';
        for (var i = 0; i < state.candidates.length; i++) {
          var c = state.candidates[i];
          rows += '<div class="tmdb-candidate' + (i === this.candidateIndex ? ' focus' : '') + '">' +
            (c.poster ? '<img src="' + esc(c.poster) + '">' : '<div class="tmdb-poster-empty"></div>') +
            '<div><div class="tmdb-candidate-title">' + esc(c.title) + '</div>' +
            '<div class="tmdb-candidate-meta">' + esc(c.originalTitle && c.originalTitle !== c.title ? c.originalTitle + ' · ' : '') +
            esc(c.year || t('tmdb.yearUnknown')) + '</div>' +
            '<div class="tmdb-candidate-overview">' + esc(c.overview || t('tmdb.noSummary')) + '</div></div></div>';
        }
        overlay.innerHTML = '<div class="' + modalClass + '"><div class="tmdb-head">' + esc(t('tmdb.choose')) + '</div>' +
          '<div class="tmdb-hint">' + esc(t('tmdb.multiple')) + '</div>' + rows +
          '<div class="tmdb-footer">' + esc(t('tmdb.candidateFooter')) + '</div></div>';
        return;
      }

      var d = state.data, overview = '', overviewSource = '';
      if (d.overviewLocalized || d.overviewTr) { overview = d.overviewLocalized || d.overviewTr; overviewSource = t('tmdb.summaryTmdb'); }
      else if (d.overviewEn) { overview = d.overviewEn; overviewSource = t('tmdb.summaryEnglish'); }
      else if (state.providerPlot) { overview = state.providerPlot; overviewSource = t('tmdb.summaryProvider'); }
      var details = [];
      if (d.year) details.push(String(d.year));
      if (d.genres && d.genres.length) details.push(d.genres.join(', '));
      if (d.type === 'movie' && d.runtime) details.push(d.runtime + ' ' + t('tmdb.minutes'));
      if (d.type === 'tv' && d.seasons) details.push(d.seasons + ' ' + t('tmdb.seasons'));
      if (d.ageRating) details.push(t('tmdb.age') + ': ' + d.ageRating);
      var provider = state.providerScore !== '' && state.providerScore != null ?
        '<div class="tmdb-rating secondary"><b>' + esc(state.providerScore) + '</b><span>' + esc(t('tmdb.providerScore')) + '</span></div>' : '';
      var facts = '';
      if (d.directors && d.directors.length) facts += '<div class="tmdb-fact"><strong>' +
        (d.type === 'movie' ? t('tmdb.director').replace(':', '') : t('tmdb.creator')) + ':</strong> ' + esc(d.directors.join(', ')) + '</div>';
      if (d.productionCompanies && d.productionCompanies.length) facts += '<div class="tmdb-fact"><strong>' + esc(t('tmdb.company')) + '</strong> ' +
        esc(d.productionCompanies.join(', ')) + '</div>';
      if (d.productionCountries && d.productionCountries.length) facts += '<div class="tmdb-fact"><strong>' + esc(t('tmdb.country')) + '</strong> ' +
        esc(d.productionCountries.join(', ')) + '</div>';
      if (d.type === 'movie' && d.budget) facts += '<div class="tmdb-fact"><strong>' + esc(t('tmdb.budget')) + '</strong> ' + esc(this.money(d.budget)) + '</div>';
      if (d.type === 'movie' && d.revenue) facts += '<div class="tmdb-fact"><strong>' + esc(t('tmdb.revenue')) + '</strong> ' + esc(this.money(d.revenue)) + '</div>';
      overlay.innerHTML = '<div class="' + modalClass + ' tmdb-result">' +
        '<div class="tmdb-head">' + esc(t('tmdb.details')) + '</div><div class="tmdb-content" id="tmdb-scroll"><div class="tmdb-layout">' +
        (d.poster ? '<img class="tmdb-poster" src="' + esc(d.poster) + '">' : '') +
        '<div class="tmdb-copy"><div class="tmdb-title">' + esc(d.title) + '</div>' +
        (d.originalTitle && d.originalTitle !== d.title ? '<div class="tmdb-original">' + esc(d.originalTitle) + '</div>' : '') +
        '<div class="tmdb-meta">' + esc(details.join(' · ')) + '</div>' +
        '<div class="tmdb-ratings"><div class="tmdb-rating"><b>' + this.score(d.voteAverage) + '</b>' +
        '<span>TMDb · ' + esc(d.voteCount || 0) + ' ' + esc(t('tmdb.votes')) + '</span></div>' + provider + '</div>' +
        (facts ? '<div class="tmdb-facts">' + facts + '</div>' : '') +
        this.castCards(d.cast) +
        this.platforms(d.availability) +
        '<div class="tmdb-overview">' + esc(overview || t('tmdb.noSummary')) + '</div>' +
        (overviewSource ? '<div class="tmdb-source">' + esc(overviewSource) + '</div>' : '') +
        '</div></div></div><div class="tmdb-scrollbar" id="tmdb-scrollbar"><i id="tmdb-scroll-thumb"></i></div>' +
        '<div class="tmdb-footer">' + esc(t('tmdb.footer')) + '</div></div>';
      var actorImages = overlay.querySelectorAll('.tmdb-person-photo img');
      for (var imageIndex = 0; imageIndex < actorImages.length; imageIndex++) {
        actorImages[imageIndex].onerror = function () { this.style.display = 'none'; };
      }
      var self = this;
      setTimeout(function () { if (self.active) self.syncScroll(); }, 0);
    },

    choose: function () {
      var self = this, context = this.state, candidate = context.candidates[this.candidateIndex];
      if (!candidate) return;
      this.state = { state: 'loading' }; this.render();
      var requestId = ++this.requestId;
      Tmdb.choose(context, candidate).then(function (result) {
        if (!self.active || requestId !== self.requestId) return;
        self.state = result; self.render();
      })['catch'](function (error) {
        if (!self.active || requestId !== self.requestId) return;
        self.state = { state: 'error', message: error.message || 'Bilgiler alinamadi.' }; self.render();
      });
    },

    key: function (e) {
      var c = e.keyCode;
      e.preventDefault();
      if (c === KEY.BACK || c === KEY.ESC) { this.close(); return; }
      if (this.state && this.state.state === 'candidates') {
        if (c === KEY.UP) this.candidateIndex = Math.max(0, this.candidateIndex - 1);
        else if (c === KEY.DOWN) this.candidateIndex = Math.min(this.state.candidates.length - 1, this.candidateIndex + 1);
        else if (c === KEY.ENTER) { this.choose(); return; }
        else return;
        this.render(); return;
      }
      if (this.state && this.state.state === 'found') {
        if (c === KEY.UP) { this.scroll(-390); return; }
        if (c === KEY.DOWN) { this.scroll(390); return; }
      }
      if (c === KEY.ENTER) this.close();
    }
  },

  /* =============================== SON IZLEDIKLERIM =============================== */

  recent: {
    list: null, bar: null, removeMode: false,
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
        '<div class="recent-help">OK: Aç&nbsp;&nbsp;&nbsp; Sağ: Kaldır kutusu&nbsp;&nbsp;&nbsp; Sarı: Hızlı kaldır</div>';
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
      var oldIndex = this.list ? this.list.index : 0;
      Recent.remove(it.kind, it.id);
      UI.toast('Son izlediklerimden kaldirildi');
      this.load();
      if (this.list && this.list.items.length) this.list.jumpTo(Math.min(oldIndex, this.list.items.length - 1));
      this.removeMode = false;
    },
    confirmRemove: function (it) {
      if (!it) return;
      var self = this;
      App.confirmDialog('Son İzlediklerimden kaldırılsın mı?',
        '“' + String(it.name || 'Seçilen içerik') + '” listeden kaldırılacak.', 'Kaldır', function () {
          self.remove(it);
        });
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
        {
          label: function () {
            var names = { home: 'Ana sayfa', live: 'Canlı TV', movies: 'Filmler', series: 'Diziler' };
            return 'Açılış ekranı: ' + (names[Settings.get('startupScreen')] || names.home);
          },
          title: 'Açılış ekranı',
          help: 'Başarılı hesap girişinden sonra gösterilecek bölümü seçer. İçerik otomatik oynatılmaz.',
          recommended: 'Ana sayfa',
          run: function () {
            var order = ['home', 'live', 'movies', 'series'];
            var index = order.indexOf(Settings.get('startupScreen'));
            Settings.set('startupScreen', order[(index + 1) % order.length]);
          }
        },
        {
          label: function () { return t('language.change') + ': ' + I18n.languageName(Settings.get('uiLanguage') || 'auto'); },
          title: t('settings.languageTitle'),
          help: t('settings.languageHelp'),
          recommended: t('common.auto'),
          run: function () { Views.languageSettings(); return false; }
        },
        { label: function () { return 'Son teşhis raporunu göster'; },
          title: 'Yerleşik teşhis',
          help: 'Son oynatma oturumunun motor, çözünürlük, akış hızı, tampon ve hata bilgilerini gösterir. Hesap şifresi rapora eklenmez.',
          run: function () { Diag.loadLast(); return false; } },
        {
          label: function () { return 'TMDb: ' + Tmdb.sourceLabel(); },
          title: t('settings.tmdbTitle'),
          help: t('settings.tmdbHelp') + ' ' + t('tmdb.region') + ': ' + I18n.regionName(Settings.get('contentRegion') || 'auto') + '.',
          recommended: Tmdb.proxyConfigured() ? 'Public TMDb hizmeti hazır.' : 'TMDb hizmet adresi henüz yapılandırılmadı.',
          run: function () { Views.tmdbSettings(); return false; }
        },
        {
          label: function () {
            var m = { auto: 'Otomatik', avplay: 'AVPlay (Tizen)', html5: 'HTML5 video' };
            return 'Canli TV oynaticisi: ' + m[Settings.get('liveEngine')];
          },
          title: 'Canlı TV oynatıcısı',
          help: 'AVPlay donanımsal oynatmayı, HTML5 tarayıcı video katmanını kullanır. Her iki motor da kanal listesinde küçük ön izleme sunar; kararsız bağlantılarda AVPlay daha iyi sonuç verebilir.',
          recommended: 'Canlı yayın kararlılığı için AVPlay önerilir.',
          run: function () {
            var order = ['auto', 'avplay', 'html5'];
            var i = order.indexOf(Settings.get('liveEngine'));
            Settings.set('liveEngine', order[(i + 1) % order.length]);
          }
        },
        {
          label: function () {
            return 'Samsung AVPlay uyumlulugu: ' + Player.avCompatibilityLabel(Settings.get('avplayCompatibility'));
          },
          title: 'Samsung AVPlay uyumluluğu',
          help: 'AVPlay ön izlemesinden tam ekrana geçerken görüntü küçük kalıyorsa kullanılır. Otomatik mod Tizen 5.0 ve daha eski cihazlarda doğrulanan eski-TV yerleşimini, yeni veya sürümü algılanamayan cihazlarda standart yerleşimi seçer. Açık eski-TV yöntemini, Kapalı standart yöntemi zorlar.',
          recommended: 'Otomatik',
          run: function () {
            var order = ['auto', 'legacySync', 'standard'];
            var i = order.indexOf(Settings.get('avplayCompatibility'));
            if (i < 0) i = 0;
            Settings.set('avplayCompatibility', order[(i + 1) % order.length]);
            UI.toast('Yeni yöntem bir sonraki ön izleme geçişinde uygulanır', 3000);
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
          help: 'Kanal listesindeki şimdi/sıradaki bilgisini ve tam ekranda Aşağı tuşla açılan bugünkü program listesini etkinleştirir.',
          recommended: 'Açık',
          run: function () { Settings.set('epg', !Settings.get('epg')); }
        },
        {
          label: function () { return 'Canli TV goruntu bicimi: ' + Player.aspectLabel(Settings.get('liveAspect')); },
          title: 'Canlı TV görüntü biçimi',
          help: 'AVPlay ve HTML5 canlı görüntüsünün ekrana yerleşimini seçer. Zorunlu biçimler görüntüyü esnetebilir. İki kırpma modu AU8000 AVPlay katmanında uygulanamadığı için HTML5 gerektirir.',
          recommended: 'Otomatik',
          run: function () {
            var next = Player.nextAspect(Settings.get('liveAspect'));
            Settings.set('liveAspect', next);
          }
        },
        {
          label: function () { return 'Film/dizi goruntu bicimi: ' + Player.aspectLabel(Settings.get('aspect')); },
          title: 'Film ve dizi görüntü biçimi',
          help: 'Görüntünün ekrana yerleşimini belirler. Zorunlu 4:3/16:9/21:9 seçenekleri görüntüyü esnetebilir. Yakınlaştırma ve doldurma kırpma modları bu cihazda HTML5 ile kullanılmalıdır.',
          recommended: 'Otomatik',
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
        {
          label: function () { return 'Siradaki bolumu otomatik oynat: ' + (Settings.get('nextEpisodeAutoplay') ? 'Acik' : 'Kapali'); },
          title: 'Sonraki bölüm',
          help: 'Bir bölüm doğal olarak tamamlandığında sıradaki bölümü gösterir. Açık seçilirse 10 saniyelik geri sayımdan sonra otomatik başlatır; kapalıyken OK ile siz başlatırsınız.',
          recommended: 'Kapalı',
          run: function () { Settings.set('nextEpisodeAutoplay', !Settings.get('nextEpisodeAutoplay')); }
        },
        {
          label: function () { return 'Aramada yetiskin icerikleri: ' + (Settings.get('includeAdultSearch') ? 'Goster' : 'Gizle'); },
          title: 'Arama güvenliği',
          help: 'Canlı TV, film ve dizi genel aramalarında yetişkin kategorilerindeki sonuçların gösterilip gösterilmeyeceğini belirler. Kategorilerin normal görünürlüğünü değiştirmez.',
          recommended: 'Gizle',
          run: function () { Settings.set('includeAdultSearch', !Settings.get('includeAdultSearch')); }
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
          label: function () { return 'Katalogu guncelle'; },
          title: 'Kataloğu güncelle',
          help: 'Kategori, kanal, film ve dizi listelerini bir sonraki açılışta sağlayıcıdan yeniden alır. Favoriler, izleme geçmişi, altyazılar ve öğrenilen ayarlar korunur.',
          run: function () {
            Api.cache = {};
            Api.pending = {};
            Api.epgCache = {};
            AccountData.del('homeLatest');
            App.home.launchChecked = false;
            App.home.busy = false;
            UI.toast('Katalog onbellegi temizlendi · Listeye yeniden girin', 3200);
          }
        },
        {
          label: function () { return 'Liste, altyazi onbellegi ve ogrenimini temizle'; },
          title: 'Liste ve altyazı önbelleği',
          help: 'Panel listelerini ve hazırlanmış altyazı kayıtlarını temizler. Hesap bilgileri, favoriler ve son izlediklerim silinmez.',
          run: function () {
            Api.cache = {};
            SubtitleCache.clear();
            SubtitleStrategy.reset();
            if (typeof TrackLabels !== 'undefined') TrackLabels.clear();
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
          label: function () { return 'Film/dizi arama geçmişini sil'; },
          title: 'Arama geçmişi',
          help: 'Film ve dizi ekranlarındaki son beş arama ifadesini bu hesaptan siler.',
          run: function () {
            VodSearchHistory.clear('movie'); VodSearchHistory.clear('series');
            UI.toast('Arama geçmişi silindi');
          }
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
        { label: function () { return 'Sürüm ve uygulama bilgisi: ' + App.versionLabel; },
          title: 'Sürüm bilgisi',
          help: 'Yüklü Public sürümü, uygulama kredisini ve TMDb bildirimini gösterir.',
          run: function () { App.go('about'); return false; } },
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
    },

    categories: function () {
      return [
        { id: 'general', label: 'Genel ve Hesap' },
        { id: 'live', label: 'Canlı TV' },
        { id: 'vod', label: 'Film ve Dizi' },
        { id: 'tracks', label: 'Ses ve Altyazı' },
        { id: 'organize', label: 'Kategoriler ve Favoriler' },
        { id: 'storage', label: 'Depolama ve Geçmiş' },
        { id: 'help', label: 'Yardım ve Bilgi' },
        { id: 'advanced', label: 'Gelişmiş ve Teşhis' }
      ];
    },

    meta: function (def) {
      var title = def.title || '', meta = { category: 'general', keywords: '' };
      if (title === 'Yerleşik teşhis' || title === 'Samsung AVPlay uyumluluğu' ||
          title === 'Canlı yayın biçimi' || title === 'Tampon öğrenimini sıfırla') meta.category = 'advanced';
      else if (title === 'Canlı TV oynatıcısı' || title === 'Canlı yayın tamponu' ||
          title === 'Yayın akışı' || title === 'Canlı TV görüntü biçimi') meta.category = 'live';
      else if (title === 'Film ve dizi oynatıcısı' || title === 'Film ve dizi görüntü biçimi' ||
          title === 'Sonraki bölüm' || title === 'Arama güvenliği') meta.category = 'vod';
      else if (title === 'Öncelikli ses dili' || title === 'Öncelikli altyazı' || title === 'Altyazı boyutu') meta.category = 'tracks';
      else if (title === 'Canlı TV kategorileri' || title === 'Film kategorileri' ||
          title === 'Dizi kategorileri' || title === 'Favori kanal sırası') meta.category = 'organize';
      else if (title === 'Kataloğu güncelle' || title === 'Liste ve altyazı önbelleği' || title === 'İzleme ilerlemesi' || title === 'Arama geçmişi') meta.category = 'storage';
      else if (title === 'Kumanda rehberi' || title === 'Sürüm bilgisi') meta.category = 'help';

      var values = null, key = null;
      if (title === 'Açılış ekranı') {
        key = 'startupScreen'; values = [['home', 'Ana sayfa'], ['live', 'Canlı TV'], ['movies', 'Filmler'], ['series', 'Diziler']];
      } else if (title === 'Canlı TV oynatıcısı') {
        key = 'liveEngine'; values = [['auto', 'Otomatik'], ['avplay', 'AVPlay (Tizen)'], ['html5', 'HTML5 video']];
      } else if (title === 'Samsung AVPlay uyumluluğu') {
        key = 'avplayCompatibility'; values = [['auto', 'Otomatik'], ['legacySync', 'Açık: eski TV'], ['standard', 'Kapalı: standart']];
      } else if (title === 'Film ve dizi oynatıcısı') {
        key = 'vodEngine'; values = [['auto', 'Otomatik'], ['avplay', 'AVPlay (Tizen)'], ['html5', 'HTML5 video']];
      } else if (title === 'Canlı yayın biçimi') {
        key = 'liveFormat'; values = [['ts', 'TS'], ['m3u8', 'M3U8']];
      } else if (title === 'Canlı yayın tamponu') {
        key = 'liveBufferMode'; values = [['auto', 'Otomatik'], ['5', '5 saniye'], ['10', '10 saniye'], ['15', '15 saniye'], ['20', '20 saniye']];
      } else if (title === 'Yayın akışı') {
        key = 'epg'; values = [[true, 'Açık'], [false, 'Kapalı']];
      } else if (title === 'Canlı TV görüntü biçimi' || title === 'Film ve dizi görüntü biçimi') {
        key = title === 'Canlı TV görüntü biçimi' ? 'liveAspect' : 'aspect'; values = [];
        for (var ai = 0; ai < Player.aspectOrder.length; ai++) values.push([Player.aspectOrder[ai], Player.aspectLabel(Player.aspectOrder[ai])]);
      } else if (title === 'Öncelikli ses dili') {
        key = 'preferredAudio'; values = [['auto', 'Otomatik'], ['tr', 'Türkçe'], ['en', 'İngilizce'], ['original', 'Kaynak varsayılanı']];
      } else if (title === 'Öncelikli altyazı') {
        key = 'preferredSubtitle'; values = [['off', 'Kapalı'], ['tr', 'Türkçe'], ['en', 'İngilizce'], ['auto', 'Otomatik']];
      } else if (title === 'Altyazı boyutu') {
        key = 'subtitleSize'; values = [['small', 'Küçük'], ['normal', 'Normal'], ['large', 'Büyük'], ['xlarge', 'Çok büyük']];
      } else if (title === 'Sonraki bölüm') {
        key = 'nextEpisodeAutoplay'; values = [[true, 'Açık'], [false, 'Kapalı']];
      } else if (title === 'Arama güvenliği') {
        key = 'includeAdultSearch'; values = [[false, 'Yetişkin içerikleri gizle'], [true, 'Yetişkin içerikleri göster']];
      }
      if (values) {
        meta.choices = [];
        for (var vi = 0; vi < values.length; vi++) meta.choices.push({ value: values[vi][0], label: values[vi][1] });
        meta.value = Settings.get(key);
        meta.set = (function (settingKey, settingTitle) {
          return function (value) {
            Settings.set(settingKey, value);
            if (settingTitle === 'Altyazı boyutu') Playback.previewSubtitleSize();
            if (settingTitle === 'Samsung AVPlay uyumluluğu') UI.toast('Yeni yöntem bir sonraki ön izleme geçişinde uygulanır', 3000);
          };
        })(key, title);
      }
      if (title === 'Liste ve altyazı önbelleği' || title === 'İzleme ilerlemesi' || title === 'Arama geçmişi' || title === 'Tampon öğrenimini sıfırla') {
        meta.destructive = true;
      }
      meta.keywords = title + ' ' + (def.help || '') + ' ' + (def.recommended || '');
      return meta;
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
    this.updatePreviewCaption();
  },

  updatePreviewCaption: function () {
    if (!this.previewOn) return;
    var slot = document.getElementById('lv-preview');
    if (!slot) return;
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
    var current = this.channels && this.channels[this.index];
    if (current && App.route === 'live' && App.live.chans) {
      var context = this.liveContext || {};
      var categoryId = current.category_id != null ? current.category_id : context.categoryId;
      var categoryName = App.live.categoryName(categoryId,
        current.category_name || context.categoryName || 'Kanallar');
      App.live.adoptPlaybackCategory(this.channels, this.index, categoryId, categoryName);
      this.channels = App.live.chans.items;
      for (var i = 0; i < this.channels.length; i++) {
        if (String(this.channels[i].stream_id) === String(current.stream_id)) { this.index = i; break; }
      }
    }
    this.previewOn = true;
    this.previewAvailable = true;
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
  liveStableTimer: null, liveAutoRecoveryStopped: false, liveRecoveryNoticeOn: false,
  vodPanel: 'hidden', vodControlIndex: 0, vodToolIndex: 0, vodTrackColumn: 'audio',
  vodAspectIndex: 0, vodEngineOverride: null, vodSwitchToken: 0,
  vodAudioIndex: 0, vodTextIndex: 0, vodTracks: null, vodReady: false,
  subtitleText: '', subtitlePreviewTimer: null,
  seekFeedback: null,
  previousEpisodeArmUntil: 0, previousEpisodeTimer: null,
  vodEpisodeColumn: 'episodes', vodEpisodeSeasonIndex: 0, vodEpisodeIndex: 0,
  vodOsdActionSignature: '',
  nextCancelled: false, completionIndex: 0,
  liveTechnicalInfo: false, liveInfoCard: false, vodTechnicalInfo: false,
  liveStatsAt: 0,

  overlay: function () { return document.getElementById('overlay'); },

  /* ---------- canli ---------- */

  startLive: function (channels, index, context) {
    if (!channels || !channels.length) { UI.toast('Kanal listesi bos'); return; }
    this.mode = 'live';
    this.channels = channels;
    this.index = index;
    this.liveContext = context || {};
    this.previewOn = !!this.liveContext.preview;
    this.previewAvailable = this.previewOn || (this.liveContext.previewAvailable !== false && App.route === 'live');
    if (!this.previewOn) Player.setViewport(null);
    this.recoveryTimes = [];
    this.liveAutoRecoveryStopped = false;
    this.liveTechnicalInfo = false;
    this.liveInfoCard = false;
    this.recentChannelsOn = false;
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
    this.lastEpg = null;
    if (this.numTimer) { clearTimeout(this.numTimer); this.numTimer = null; }
    this.numBuf = '';
    this.liveTechnicalInfo = false;
    this.liveInfoCard = false;
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
    if (Api.info && Api.info.user_info) {
      var userInfo = Api.info.user_info;
      Diag.set('Saglayici baglanti siniri', String(userInfo.active_cons == null ? '?' : userInfo.active_cons) +
        ' aktif / ' + String(userInfo.max_connections == null ? '?' : userInfo.max_connections) + ' azami');
    }
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
        if (self.osdOn && (self.liveTechnicalInfo || self.liveInfoCard) && self.channels[self.index] === ch) {
          self.updateLiveOsdDynamic(self.liveTechnicalInfo ? 'technical' : 'compact');
        }
      },
      onBufferingStart: function (event) {
        if (!event.initial) Diag.set('Son tamponlama', 'Basladi');
      },
      onBufferingComplete: function (event) {
        if (!event.initial) Diag.set('Son tamponlama', Math.round(event.durationMs / 100) / 10 + ' sn');
        /* AVPlay otomatik kurtarma sinirindan sonra kendi kendine
           toparlanabilir. Yalnizca bizim kararsizlik bildirimimizi kapat. */
        if (self.liveRecoveryNoticeOn) {
          self.liveRecoveryNoticeOn = false;
          self.overlay().className = '';
          self.overlay().innerHTML = '';
          self.osdOn = false;
          self.scheduleLiveStableReset();
          Diag.set('Yeniden baglanma', 'Yayin kendi kendine toparlandi · 60 sn kararlilik bekleniyor');
        }
        if (self.previewOn) {
          self.updatePreviewCaption();
          if (self.liveAutoRecoveryStopped) self.scheduleLiveStableReset();
        }
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
    var compatibilityError = Player.isCompatibilityError(msg);
    if (compatibilityError && this.liveCandidateIndex + 1 < this.liveCandidates.length) {
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
    this.recoverLive(compatibilityError ? 'uyumsuz yayin bicimi' : 'baglanti hatasi', false, msg);
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
        if (this.previewOn) {
          var caption = document.getElementById('lv-playing');
          if (caption) caption.innerHTML = '<div class="preview-label">Yayın kararsız</div>' +
            '<div class="page-sub">Otomatik yenileme sınırına ulaşıldı. Başka kanala geçip yeniden deneyebilirsiniz.</div>';
          Diag.add('On izleme: otomatik yenileme sinirina ulasildi');
          return;
        }
        this.liveRecoveryNoticeOn = true;
        if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
        this.osdOn = false;
        this.overlay().className = 'on';
        this.overlay().innerHTML = '<div class="player-msg"><div class="big">Yayın kararsız</div>' +
          '<div class="small">Otomatik yenileme sınırına ulaşıldı.<br><br>Yeşil tuş: yeniden bağlan</div></div>';
        UI.toast('Yayın kararsız · Yeşil tuşla yeniden bağlanabilirsiniz.', 7000);
      }
      return;
    }
    this.recoveryTimes.push(now);
    Diag.set('Yeniden baglanma', this.recoveryTimes.length + '/2 - ' + reason);
    if (!learned && this.bufferSession) this.bufferSession.stalled = true;
    Player.stop(true);
    UI.toast('Yayin yenileniyor...', 1800);
    var self = this;
    var delay = (this.recoveryTimes.length === 1 ? 2000 : 5000) + Math.floor(Math.random() * 501);
    Diag.set('Yeniden baglanma beklemesi', Math.round(delay / 100) / 10 + ' sn');
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
    var historyCatId = ch.category_id != null ? ch.category_id : catId;
    var historyCatName = App.live.categoryName(historyCatId, ch.category_name || catName);
    LiveHistory.add(ch, { categoryId: historyCatId, categoryName: historyCatName });
  },

  switchStoredChannel: function (record) {
    if (!record || record.stream_id == null) return;
    /* exit() geri donus odagi icin eski listeyi bellekte tutabilir. Yalnizca
       gercek bir canli oturum sirasinda bu listeyi aktif kabul et. */
    var active = this.mode === 'live';
    var current = active && this.channels && this.channels[this.index];
    if (current && String(current.stream_id) === String(record.stream_id)) {
      this.hideRecentChannels(); UI.toast('Bu kanal zaten açık'); return;
    }
    for (var i = 0; active && this.channels && i < this.channels.length; i++) {
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
      var categoryName = record.category_name || 'Son kanallar';
      if (App.route === 'live' && App.live.chans) {
        App.live.adoptPlaybackCategory(items, found,
          categoryId == null ? '__recent' : categoryId, categoryName);
        items = App.live.chans.items;
      }
      self.startLive(items, found, {
        preview: false,
        previewAvailable: true,
        categoryId: categoryId == null ? '__recent' : categoryId,
        categoryName: categoryName
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
    this.liveRecoveryNoticeOn = false;
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

  hideLiveInfo: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.osdOn = false;
    this.liveTechnicalInfo = false;
    this.liveInfoCard = false;
    this.overlay().className = '';
    this.overlay().innerHTML = '';
  },

  toggleLiveInfoCard: function () {
    if (this.osdOn && this.liveInfoCard) { this.hideLiveInfo(); return; }
    this.liveTechnicalInfo = false;
    this.liveInfoCard = true;
    this.renderLiveOsd(this.channels[this.index], this.lastEpg, 'compact');
    this.showOsd(7000);
  },

  openLiveDailyEpg: function () {
    var ch = this.channels && this.channels[this.index];
    if (!ch) return;
    this.hideLiveInfo();
    var self = this;
    App.live.openDailyEpg(ch, function () {
      if (self.mode === 'live' && !self.previewOn) Nav.setOverlay(function (e) { self.keyLive(e); });
    });
  },

  keyLive: function (e) {
    var c = e.keyCode;
    e.preventDefault();

    if (Diag.visible) { if (c === KEY.BACK || c === KEY.ENTER) Diag.hide(); return; }

    if (this.recentChannelsOn) { this.keyRecentChannels(c); return; }

    if (c === KEY.LEFT) { this.togglePreviousChannel(); return; }
    if (c === KEY.RIGHT) { this.showRecentChannels(); return; }
    if (c === KEY.UP) { this.toggleLiveInfoCard(); return; }
    if (c === KEY.DOWN) { this.openLiveDailyEpg(); return; }
    if (c === KEY.CH_UP) { this.step(1); return; }
    if (c === KEY.CH_DOWN) { this.step(-1); return; }
    if (c === KEY.ENTER) { this.returnToPreview(); return; }
    if (c === KEY.INFO) {
      if (this.liveTechnicalInfo) { Diag.render(); return; }
      this.liveTechnicalInfo = true;
      this.liveInfoCard = false;
      this.renderLiveOsd(this.channels[this.index], this.lastEpg, 'technical');
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
    if (c >= KEY.N0 && c <= KEY.N9) { this.numberEntry(c - KEY.N0); return; }
    if (c === KEY.BACK || c === KEY.ESC) { this.returnToPreview(); return; }
    if (c === KEY.STOP) { this.exit(); return; }
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

  technicalStatsHtml: function (stats) {
    var s = stats || Player.playbackStats();
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

  compactLiveStatsHtml: function (stats) {
    var s = stats || Player.playbackStats();
    var resolution = s.width && s.height ? s.width + '×' + s.height : 'Sunulmuyor';
    var bitrate = s.bitrate ? this.formatRate(s.bitrate)
      : (s.decodedRate ? this.formatRate(s.decodedRate) + ' (cozulen)' : 'Sunulmuyor');
    var flow = s.bandwidth ? this.formatRate(s.bandwidth)
      : (s.networkDownlink ? this.formatRate(s.networkDownlink) + ' (ag tahmini)' : 'Sunulmuyor');
    return '<div class="live-compact-stats">' +
      '<span><b>Cozunurluk</b> ' + esc(resolution) + '</span>' +
      '<span><b>Motor</b> ' + esc(String(s.engine || '-').toUpperCase()) + '</span>' +
      '<span><b>Kaynak</b> ' + esc(String(s.format || '-').toUpperCase()) + '</span>' +
      '<span><b>Bitrate</b> ' + esc(bitrate) + '</span>' +
      '<span><b>Akis</b> ' + esc(flow) + '</span>' +
      '</div>';
  },

  renderLiveOsd: function (ch, epg, detail) {
    this.liveRecoveryNoticeOn = false;
    var body = '<div class="osd"><div class="ch">' +
      '<div class="chno">' + esc(ch.num || '') + '</div>' +
      '<div class="chname">' + esc(ch.name) + '</div></div>';
    if (epg && epg.length) {
      var now = epg[0];
      var s = epgStart(now), e2 = epgEnd(now);
      var pct = 0;
      if (s && e2) {
        pct = Math.max(0, Math.min(100, (Date.now() - s.getTime()) / (e2.getTime() - s.getTime()) * 100));
      }
      body += '<div class="prg">' + esc(b64(now.title)) + '</div>' +
        '<div class="sub">' + hhmm(s) + ' - ' + hhmm(e2) + '</div>' +
        '<div class="seek"><i id="live-epg-progress" style="width:' + pct.toFixed(0) + '%"></i></div>';
      if (epg[1]) body += '<div class="sub" style="margin-top:10px">Sirada: ' + esc(b64(epg[1].title)) + '</div>';
    } else {
      body += '<div class="sub">Yayin akisi bilgisi bekleniyor</div>';
    }
    if (detail === 'compact') body += '<div id="live-stats-slot">' + this.compactLiveStatsHtml() + '</div>';
    else if (detail === 'technical' || detail === true) body += '<div id="live-stats-slot">' + this.technicalStatsHtml() + '</div>';
    body += '</div>';
    this.overlay().innerHTML = body;
    this.liveStatsAt = Date.now();
  },

  /* Canli bilgi karti acikken saniyede bir tum OSD'yi yeniden kurma. EPG
     cubugunu dogrudan guncelle; AVPlay istatistiklerini en fazla uc saniyede
     bir oku ve yalnizca istatistik alanini degistir. */
  updateLiveOsdDynamic: function (detail) {
    var progress = document.getElementById('live-epg-progress');
    var epg = this.lastEpg;
    if (progress && epg && epg.length) {
      var start = epgStart(epg[0]), end = epgEnd(epg[0]);
      if (start && end && end.getTime() > start.getTime()) {
        var pct = Math.max(0, Math.min(100,
          (Date.now() - start.getTime()) / (end.getTime() - start.getTime()) * 100));
        progress.style.width = pct.toFixed(0) + '%';
      }
    }
    if (Date.now() - this.liveStatsAt < 3000) return;
    this.liveStatsAt = Date.now();
    var slot = document.getElementById('live-stats-slot');
    if (!slot) return;
    var stats = Player.playbackStats();
    slot.innerHTML = detail === 'technical'
      ? this.technicalStatsHtml(stats) : this.compactLiveStatsHtml(stats);
  },

  fetchOsdEpg: function (ch) {
    if (!Settings.get('epg')) return;
    var self = this;
    Api.shortEpg(ch.stream_id, 2).then(function (list) {
      if (self.mode !== 'live') return;
      if (self.channels[self.index] !== ch) return;
      if (self.osdOn) self.renderLiveOsd(ch, list,
        self.liveTechnicalInfo ? 'technical' : (self.liveInfoCard ? 'compact' : null));
      self.lastEpg = list;
      self.updatePreviewCaption();
    })['catch'](function () {
      if (self.mode !== 'live' || self.channels[self.index] !== ch) return;
      self.lastEpg = [];
      self.updatePreviewCaption();
    });
  },

  /* ---------- film / bolum ---------- */

  subtitleContext: function (engine) {
    var meta = this.vodMeta || {};
    var cleanUrl = String(meta.url || '').split('?')[0];
    return {
      contentKey: String(meta.kind || 'vod') + ':' + String(meta.progressId || meta.id || ''),
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

  canUseLocalMp4Fallback: function () {
    if (this.mode !== 'vod' || !this.vodMeta || this.vodMeta._localAttempted) return false;
    /* Saglayicinin container_extension alani her zaman gercek kapsayiciyi
       yansitmiyor. Sugar gibi MP4 icerikler MKV etiketiyle de gelebiliyor.
       Secenegi uzantiya/capability sonucuna gore gizlemek yerine yerel servis
       dosya basligini denetler ve desteklenmiyorsa gorunur hata verir. */
    return typeof Servis !== 'undefined' && !!Servis;
  },

  tryAlternateEpisodeSource: function (msg) {
    var meta = this.vodMeta;
    if (!meta || meta.kind !== 'ep' || !meta.sourceCandidates || meta.sourceCandidates.length < 2) return false;
    if (!meta._attemptedSourceIds) meta._attemptedSourceIds = {};
    meta._attemptedSourceIds[String(meta.id)] = true;
    var next = null;
    for (var i = 0; i < meta.sourceCandidates.length; i++) {
      if (!meta._attemptedSourceIds[String(meta.sourceCandidates[i].id)]) { next = meta.sourceCandidates[i]; break; }
    }
    if (!next) return false;
    var position = Math.max(0, Player.position() || meta.startAt || 0);
    Diag.add('Bolum kaynagi acilamadi; yedek kaynak sirayla deneniyor: ' + msg);
    if (this.saveTimer) { clearInterval(this.saveTimer); this.saveTimer = null; }
    Player.stop(true);
    meta.id = next.id;
    meta.extension = next.container_extension || meta.extension || 'mp4';
    meta.url = Api.episodeUrl(next.id, meta.extension);
    meta.videoInfo = next && next.info && next.info.video ? next.info.video : (next.video || null);
    meta.startAt = position;
    meta._localAttempted = false;
    meta._localPlaybackUrl = '';
    meta._localSubtitleUrl = '';
    this.renderLocalServicePreparation('Bu bolumun alternatif kaynagi deneniyor');
    var self = this;
    setTimeout(function () {
      if (self.mode === 'vod' && self.vodMeta === meta) self.startVod(meta, self.vodEngineOverride);
    }, 550);
    return true;
  },

  handleVodError: function (msg) {
    if (this.mode !== 'vod') { this.showError(msg); return; }
    Diag.add('VOD teknik hata: ' + msg);
    if (this.tryAlternateEpisodeSource(msg)) return;
    if (this.canUseLocalMp4Fallback()) {
      var self = this, meta = this.vodMeta;
      this.renderLocalServicePreparation('TV uyumlulugu otomatik olarak hazirlaniyor');
      setTimeout(function () {
        if (self.mode === 'vod' && self.vodMeta === meta) self.startLocalMp4Fallback();
      }, 500);
      return;
    }
    this.showError(msg);
  },

  renderLocalServicePreparation: function (detail) {
    this.vodPanel = 'local-service';
    this.osdOn = true;
    this.overlay().className = 'on';
    this.renderSubtitle('');
    this.overlay().innerHTML = '<div class="vod-preparation"><div class="prep-card">' +
      '<div class="prep-title">Yerel uyumluluk yontemi hazirlaniyor</div>' +
      '<div class="prep-detail">' + esc(detail || 'MP4 iz yapisi inceleniyor') + '</div>' +
      '<div class="prep-bar indeterminate"><i></i></div>' +
      '<div class="prep-percent">Lutfen bekleyin</div>' +
      '<div class="prep-help">INFO Teshis &nbsp; · &nbsp; Geri Iptal</div>' +
      '</div></div>';
  },

  startLocalMp4Fallback: function () {
    if (!this.canUseLocalMp4Fallback()) return;
    var self = this, meta = this.vodMeta;
    meta._localAttempted = true;
    meta._localResume = Math.max(0, Player.position() || meta.startAt || 0);
    this.renderLocalServicePreparation('TV icin fazla olan metin izleri dosya ofsetleri degismeden ayiklaniyor');
    if (this.saveTimer) { clearInterval(this.saveTimer); this.saveTimer = null; }
    Player.stop(true);
    Servis.hazirla().then(function () {
      if (self.mode !== 'vod' || self.vodMeta !== meta) throw new Error('islem iptal edildi');
      return Servis.incele(meta.url);
    }).then(function (result) {
      if (self.mode !== 'vod' || self.vodMeta !== meta) return;
      if (!result || !result.ok) throw new Error(result && result.hata ? result.hata : 'dosya incelenemedi');
      if (!result.kimlik) throw new Error('yerel kaynak kimligi alinamadi');
      if (!result.ayiklandi) throw new Error('dosyada ayiklanacak fazla metin izi bulunmadi');
      meta._localServiceId = result.kimlik;
      meta._localPlaybackUrl = Servis.adres(result.kimlik);
      meta._localSubtitleUrl = Servis.kaynakAdresi(result.kimlik);
      meta.startAt = meta._localResume || 0;
      Diag.set('Yerel MP4 yontemi', result.izOnce + ' iz -> ' + result.izSonra +
        ' iz · ' + result.hazirlikMs + ' ms');
      Diag.add('Yerel servis AVPlay kaynagi hazir: ' + result.izOnce + ' -> ' + result.izSonra + ' iz');
      self.renderLocalServicePreparation(result.izOnce + ' iz ' + result.izSonra +
        ' ize indirildi · altyazi dilleri okunuyor');
      /* AVPlay baslamadan once ham moov'daki TX3G manifestini oku. Boylece
         sade dosyada TEXT izi kalmasa da panel Turkce/Ingizce seceneklerini
         aninda gosterebilir; video ve altyazi ilk acilista yarismamis olur. */
      return Tx3gSubtitles.inspect(meta._localSubtitleUrl, function () {
        return self.mode === 'vod' && self.vodMeta === meta;
      }).then(function (info) {
        if (info && info.kind === 'mp4' && info.tracks && info.tracks.length) {
          meta._localSubtitleManifest = info;
          Diag.set('Yerel altyazi manifesti', info.tracks.length + ' TX3G dili hazir');
        } else {
          Diag.set('Yerel altyazi manifesti', 'TX3G izi bulunamadi');
        }
      }, function (error) {
        /* Altyazi listesi okunamasa bile basarili video yolunu engelleme;
           panelden tekrar inceleme secenegi kullanilabilir. */
        Diag.add('Yerel altyazi manifesti okunamadi: ' + (error && error.message ? error.message : error));
      });
    }).then(function () {
      if (self.mode !== 'vod' || self.vodMeta !== meta) return;
      self.renderLocalServicePreparation('Altyazi listesi hazir · AVPlay aciliyor');
      setTimeout(function () {
        if (self.mode === 'vod' && self.vodMeta === meta) self.startVod(meta, 'avplay');
      }, 250);
    })['catch'](function (error) {
      if (self.mode !== 'vod' || self.vodMeta !== meta) return;
      meta._localServiceError = error && error.message ? error.message : 'yerel yontem basarisiz';
      self.showError('Yerel uyumluluk yontemi: ' + meta._localServiceError);
    });
  },

  startVod: function (meta, engineOverride) {
    this.seekFeedback = null;
    Player.setViewport(null);
    var self = this;
    if (this.saveTimer) { clearInterval(this.saveTimer); this.saveTimer = null; }
    this.mode = 'vod';
    this.vodMeta = meta;
    this.vodEngineOverride = engineOverride === 'avplay' || engineOverride === 'html5' ? engineOverride : null;
    this.vodPanel = 'hidden';
    this.vodControlIndex = 0;
    this.vodToolIndex = 0;
    this.vodTrackColumn = 'audio';
    this.vodAudioIndex = 0;
    this.vodTextIndex = 0;
    this.vodTracks = Player.emptyTracks();
    this.vodReady = false;
    this.vodTechnicalInfo = false;
    this.vodOsdActionSignature = '';
    this.previousEpisodeArmUntil = 0;
    if (this.previousEpisodeTimer) { clearInterval(this.previousEpisodeTimer); this.previousEpisodeTimer = null; }
    this.nextCancelled = false;
    this.completionIndex = 0;
    this.vodTrackDiscoveryTried = false;
    if (this.pauseCinemaTimer) { clearTimeout(this.pauseCinemaTimer); this.pauseCinemaTimer = null; }
    this.subtitleText = '';
    this.updateSubtitleLayer();
    /* Oynatici icindeki oran secimi yalnizca bu izleme zincirine aittir.
       Yeni bir film/dizi genel ayari alir; motor degisimi ve otomatik sonraki
       bolum ayni oturumluk secimi tasir. */
    Player.aspect = Player.normalizeAspect(meta._sessionAspect || Settings.get('aspect') || 'auto');
    meta._sessionAspect = Player.aspect;
    var rememberedTracks = TrackPrefs.get(meta) || {};
    /* Her yeni film/bolum altyazisiz acilir. Yalnizca ayni oturumda motor
       degistiriliyorsa kullanicinin etkin secimi korunur. */
    var requestedSubtitle = meta._sessionSubtitlePreference || 'off';
    var initialSubtitleContext = this.subtitleContext(this.vodEngineOverride || Player.pick(false));
    var storedManifest = meta._localSubtitleManifest || SubtitleStrategy.getManifest(initialSubtitleContext);
    var playbackUrl = meta._localPlaybackUrl || meta.url;
    var subtitleSourceUrl = meta._localSubtitleUrl || meta.url;
    Player.play(playbackUrl, {
      live: false,
      engine: this.vodEngineOverride,
      subtitleSourceUrl: subtitleSourceUrl,
      format: meta.extension || 'vod',
      startAt: meta.startAt || 0,
      videoInfo: meta.videoInfo || null,
      /* Varsayilan Kapali'dir. Kullanici genel bir dil veya bu dizi icin
         daha once bir parca sectiyse o acik tercih uygulanir. */
      subtitlePreference: requestedSubtitle,
      subtitleCacheKey: String(meta.kind || 'vod') + ':' + String(meta.progressId || meta.id || ''),
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
        self.vodTracks = Player.tracks;
        if (self.vodPanel === 'tracks') self.renderTrackPanel();
      },
      onError: function (msg) { self.handleVodError(msg); },
      onPreparation: function (state) { self.renderVodPreparation(state); },
      onReady: function () {
        self.vodReady = true;
        if (meta.kind === 'ep') EpisodeSources.note(meta.seriesId, meta.season, meta.episodeNum, meta.id);
        self.loadVodTracks(true);
        if (meta._resumePaused && !Player.paused) Player.toggle();
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
        self.vodTracks = Player.tracks;
        if (self.vodPanel === 'tracks') self.renderTrackPanel();
      },
      onSeekStatus: function (message) { UI.toast(message, 3200); },
      onEnd: function () { self.completeVod(); }
    });

    this.saveTimer = setInterval(function () {
      if (Player.playing) Resume.save(meta.kind, meta.progressId || meta.id, Player.position(), Player.duration(), meta.name);
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
      var audioPreference = this.vodMeta._sessionAudioPreference ||
        (pref && pref.audio ? pref.audio : this.generalTrackPreference('audio'));
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
    var meta = this.vodMeta || {};
    var transport = [
      { id: 'play', label: Player.paused ? 'Oynat' : 'Duraklat', icon: Player.paused ? 'play' : 'pause', round: true, group: 'transport' },
      { id: 'rewind', label: '10 saniye geri', icon: 'rewind', round: true, group: 'transport' },
      { id: 'forward', label: '30 saniye ileri', icon: 'forward', round: true, group: 'transport' }
    ];
    if (meta.kind === 'ep') {
      return transport.concat([
        { id: 'previous', label: 'Başa / Önceki', icon: 'previous', group: 'content' },
        { id: 'episodes', label: 'Bölümler', icon: 'episodes', group: 'content' },
        { id: 'next', label: 'Sonraki', icon: 'next', disabled: !meta.nextEpisode, group: 'content' },
        { id: 'details', label: 'Ayrıntılar', icon: 'about', group: 'content' },
        { id: 'more', label: 'Ses, altyazı ve görüntü', icon: 'settings', group: 'utility', utility: true }
      ]);
    }
    return transport.concat([
      { id: 'restart', label: 'Baştan oynat', icon: 'restart', group: 'content' },
      { id: 'favorite', label: Favs.has('movie', meta.id) ? 'Favoriden çıkar' : 'Favorilere ekle', icon: 'favs', group: 'content' },
      { id: 'details', label: 'Ayrıntılar', icon: 'about', group: 'content' },
      { id: 'more', label: 'Ses, altyazı ve görüntü', icon: 'settings', group: 'utility', utility: true }
    ]);
  },

  vodActionHtml: function (control, index) {
    var cls = 'vod-action' + (control.round ? ' round' : '') + (control.compact ? ' compact-action' : '') +
      (control.utility ? ' utility-action' : '') +
      (control.separated ? ' separated' : '') + (index === this.vodControlIndex ? ' focus' : '') +
      (control.disabled ? ' disabled' : '');
    return '<div class="' + cls + '" data-vod-action="' + esc(control.id) + '" data-label="' + esc(control.label) + '">' +
      '<span class="vod-action-icon">' + uiIcon(control.icon || 'about') + '</span>' +
      (control.round || control.compact ? '' : '<span class="vod-action-text">' + esc(control.label) + '</span>') + '</div>';
  },

  vodToolControls: function () {
    return [
      { id: 'tracks', label: 'Ses ve Altyazi' },
      { id: 'subtitleSize', label: 'Altyazi gorunumu' },
      { id: 'aspect', label: 'Goruntu: ' + Player.aspectLabel(Player.aspect) },
      { id: 'engine', label: 'Motor: ' + String(Player.engine || Player.pick(false)).toUpperCase() },
      { id: 'contentInfo', label: 'İçerik Hakkında' }
    ];
  },

  vodClockHtml: function (pos, dur) {
    function two(value) { value = Math.floor(value); return value < 10 ? '0' + value : String(value); }
    var now = new Date();
    var current = two(now.getHours()) + ':' + two(now.getMinutes());
    var finish = '';
    if (dur && dur > pos) {
      var end = new Date(now.getTime() + Math.max(0, dur - pos) * 1000);
      finish = '<span>Bitis ' + two(end.getHours()) + ':' + two(end.getMinutes()) + '</span>';
    }
    return '<div class="vod-clock"><b>' + current + '</b>' + finish + '</div>';
  },

  renderVodTools: function () {
    var controls = this.vodToolControls(), rows = '';
    for (var i = 0; i < controls.length; i++) {
      rows += '<div class="vod-tool-row' + (i === this.vodToolIndex ? ' focus' : '') + '">' +
        esc(controls[i].label) + '</div>';
    }
    this.overlay().innerHTML = '<div class="vod-tools-shade"><div class="vod-tools-panel">' +
      '<div class="vod-tools-title">Ses, altyazi ve goruntu</div>' +
      '<div class="vod-tools-sub">Ses parcasi, altyazi, goruntu orani ve oynatma motoru</div>' + rows +
      '<div class="vod-tools-help">Yukari/Asagi Secim &nbsp; · &nbsp; OK Uygula &nbsp; · &nbsp; Geri Oynatici</div>' +
      '</div></div>';
  },

  openVodTools: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.vodPanel = 'tools'; this.osdOn = true; this.vodToolIndex = 0;
    this.overlay().className = 'on';
    this.renderVodTools();
  },

  renderVodContentInfo: function () {
    var meta = this.vodMeta || {}, stats = Player.playbackStats(), tracks = Player.trackSummary();
    var kind = meta.kind === 'ep' ? 'Dizi bölümü' : 'Film';
    var episode = meta.kind === 'ep'
      ? '<div><b>Bölüm</b><span>Sezon ' + esc(meta.season || '-') + ' · Bölüm ' + esc(meta.episodeNum || '-') + '</span></div>' : '';
    var sourceMethod = meta._localServiceId ? 'Yerel MP4 uyumluluk' : 'Doğrudan kaynak';
    this.overlay().innerHTML = '<div class="vod-tools-shade"><div class="vod-tools-panel vod-content-panel">' +
      '<div class="vod-tools-title">İçerik Hakkında</div>' +
      '<div class="vod-tools-sub">Teknik oynatma bilgileri · ek bağlantı kurulmaz</div>' +
      '<div class="tech-stats content-tech-stats">' +
      '<div><b>İçerik</b><span>' + esc(meta.episodeTitle || meta.name || meta.title || 'Bilinmiyor') + '</span></div>' +
      '<div><b>Tür</b><span>' + esc(kind) + '</span></div>' + episode +
      '<div><b>Süre</b><span>' + esc(mmss(Player.duration())) + '</span></div>' +
      '<div><b>Konum</b><span>' + esc(mmss(Player.position())) + '</span></div>' +
      '<div><b>Ses</b><span>' + esc(tracks.audio) + '</span></div>' +
      '<div><b>Altyazı</b><span>' + esc(tracks.text) + '</span></div>' +
      '<div><b>Görüntü biçimi</b><span>' + esc(Player.aspectLabel(Player.aspect)) + '</span></div>' +
      '<div><b>Kaynak yöntemi</b><span>' + esc(sourceMethod) + '</span></div>' +
      '</div>' + this.technicalStatsHtml(stats) +
      '<div class="vod-tools-help">Geri: Ses, altyazı ve görüntü</div></div></div>';
  },

  openVodContentInfo: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.vodPanel = 'content-info';
    this.osdOn = true;
    this.overlay().className = 'on';
    this.renderVodContentInfo();
  },

  restartCurrentVod: function () {
    var meta = this.vodMeta;
    if (!meta) return;
    Resume.remove(meta.kind, meta.progressId || meta.id);
    meta.startAt = 0;
    meta._resumePaused = false;
    this.previousEpisodeArmUntil = 0;
    if (this.previousEpisodeTimer) { clearInterval(this.previousEpisodeTimer); this.previousEpisodeTimer = null; }
    Player.seek(-Math.max(0, Player.position()));
    if (Player.paused) Player.toggle();
    this.showVodControls(4500);
  },

  toggleVodFavorite: function () {
    var meta = this.vodMeta || {};
    var kind = meta.kind === 'ep' ? 'series' : 'movie';
    var id = meta.kind === 'ep' ? meta.seriesId : meta.id;
    var item = meta.item || meta.raw || {
      name: meta.title || meta.name || meta.episodeTitle || '',
      stream_icon: meta.icon || meta.cover || meta.backdrop || ''
    };
    var on = Favs.toggle(kind, id, item);
    UI.toast(on ? 'Favorilere eklendi' : 'Favorilerden cikarildi');
    this.showVodControls(5000);
  },

  openEpisodeList: function () {
    var meta = this.vodMeta || {};
    if (meta.kind !== 'ep') { UI.toast('Bolum listesi yalnizca dizilerde kullanilir'); return; }
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    var data = this.episodePanelData(), currentSeason = String(meta.season || '');
    this.vodEpisodeSeasonIndex = 0;
    for (var i = 0; i < data.seasons.length; i++) {
      if (String(data.seasons[i].season) === currentSeason) { this.vodEpisodeSeasonIndex = i; break; }
    }
    this.vodEpisodeIndex = 0;
    var selected = data.seasons[this.vodEpisodeSeasonIndex];
    if (selected) {
      for (var j = 0; j < selected.episodes.length; j++) {
        if (String(selected.episodes[j].id) === String(meta.id)) { this.vodEpisodeIndex = j; break; }
      }
    }
    this.vodEpisodeColumn = 'episodes';
    this.vodPanel = 'episodes'; this.osdOn = true;
    this.overlay().className = 'on';
    this.renderEpisodePanel();
    this.updateSubtitleLayer();
  },

  episodePanelData: function () {
    var meta = this.vodMeta || {}, rows = [], seen = {}, guard = 0, cursor = meta.previousEpisode;
    var before = [];
    while (cursor && guard++ < 500) {
      if (seen[String(cursor.id)]) break;
      seen[String(cursor.id)] = true; before.unshift(cursor); cursor = cursor.__prev;
    }
    rows = before;
    seen[String(meta.id)] = true;
    rows.push({ id: meta.id, title: meta.episodeTitle, episode_num: meta.episodeNum,
      __season: meta.season, __current: true, info: { plot: meta.plot || '' } });
    cursor = meta.nextEpisode; guard = 0;
    while (cursor && guard++ < 500) {
      if (seen[String(cursor.id)]) break;
      seen[String(cursor.id)] = true; rows.push(cursor); cursor = cursor.__next;
    }
    var seasons = [], map = {};
    for (var i = 0; i < rows.length; i++) {
      var season = String(rows[i].__season || rows[i].season || meta.season || '1');
      if (!map[season]) { map[season] = { season: season, episodes: [] }; seasons.push(map[season]); }
      map[season].episodes.push(rows[i]);
    }
    seasons.sort(function (a, b) { return Number(a.season) - Number(b.season); });
    return { seasons: seasons };
  },

  renderEpisodePanel: function () {
    var data = this.episodePanelData(), seasons = data.seasons;
    if (!seasons.length) { UI.toast('Bolum bilgisi bulunamadi'); this.showVodControls(6000); return; }
    this.vodEpisodeSeasonIndex = Math.max(0, Math.min(seasons.length - 1, this.vodEpisodeSeasonIndex));
    var active = seasons[this.vodEpisodeSeasonIndex], episodes = active.episodes;
    this.vodEpisodeIndex = Math.max(0, Math.min(Math.max(0, episodes.length - 1), this.vodEpisodeIndex));
    var seasonHtml = '', episodeHtml = '';
    for (var i = 0; i < seasons.length; i++) {
      seasonHtml += '<div class="vod-episode-season' + (i === this.vodEpisodeSeasonIndex ? ' selected' : '') +
        (this.vodEpisodeColumn === 'seasons' && i === this.vodEpisodeSeasonIndex ? ' focus' : '') + '">' +
        '<b>Sezon ' + esc(seasons[i].season) + '</b><span>' + seasons[i].episodes.length + ' bolum</span></div>';
    }
    var first = Math.max(0, Math.min(episodes.length - 8, this.vodEpisodeIndex - 3));
    var last = Math.min(episodes.length, first + 8);
    for (var j = first; j < last; j++) {
      var ep = episodes[j], info = ep.info && typeof ep.info === 'object' ? ep.info : {};
      var title = ep.title || info.name || ('Bolum ' + (ep.episode_num || (j + 1)));
      var current = String(ep.id) === String((this.vodMeta || {}).id);
      episodeHtml += '<div class="vod-episode-row' + (current ? ' current' : '') +
        (this.vodEpisodeColumn === 'episodes' && j === this.vodEpisodeIndex ? ' focus' : '') + '">' +
        '<div class="vod-episode-number">' + esc(ep.episode_num || (j + 1)) + '</div>' +
        '<div class="vod-episode-copy"><b>' + esc(title) + '</b><span>' +
        esc(info.plot || info.description || (current ? (this.vodMeta.plot || '') : '')) + '</span></div>' +
        (current ? '<em>Oynatiliyor</em>' : '') + '</div>';
    }
    this.overlay().innerHTML = '<div class="vod-episodes-shade"><div class="vod-episodes-panel">' +
      '<div class="vod-episodes-heading"><span>' + esc((this.vodMeta || {}).title || '') + '</span><b>Bolumler</b></div>' +
      '<div class="vod-episodes-body"><div class="vod-episode-seasons">' + seasonHtml + '</div>' +
      '<div class="vod-episode-list">' + episodeHtml + '</div></div>' +
      '<div class="vod-episodes-help">Yon tuslari Secim · Kanal tuslari Hizli kaydir · OK Oynat · Geri Oynatici</div>' +
      '</div></div>';
  },

  switchEpisode: function (episode) {
    var meta = this.vodMeta || {}, series = meta.seriesItem;
    if (!episode || !series) return;
    var aspect = Player.aspect;
    var seriesMeta = meta.seriesMeta || {};
    this.exit();
    App.detail.playEpisode(series, episode, seriesMeta, { sessionAspect: aspect });
  },

  playPreviousEpisode: function () {
    var meta = this.vodMeta || {}, now = Date.now();
    if (this.previousEpisodeArmUntil > now) {
      this.previousEpisodeArmUntil = 0;
      if (this.previousEpisodeTimer) { clearInterval(this.previousEpisodeTimer); this.previousEpisodeTimer = null; }
      if (meta.previousEpisode) this.switchEpisode(meta.previousEpisode);
      return;
    }
    Player.seek(-Math.max(0, Player.position()));
    if (!meta.previousEpisode) {
      this.previousEpisodeArmUntil = 0;
      UI.toast('Bolumun basina donuldu');
      this.showVodControls(4500);
      return;
    }
    this.previousEpisodeArmUntil = now + 5000;
    var self = this;
    if (this.previousEpisodeTimer) clearInterval(this.previousEpisodeTimer);
    this.previousEpisodeTimer = setInterval(function () {
      if (Date.now() >= self.previousEpisodeArmUntil || self.mode !== 'vod') {
        clearInterval(self.previousEpisodeTimer); self.previousEpisodeTimer = null;
        self.previousEpisodeArmUntil = 0;
      }
      if (self.mode === 'vod' && self.vodPanel === 'controls') self.renderVodControls(Player.position(), Player.duration());
    }, 500);
    UI.toast('Basa donuldu. Onceki bolum icin 5 saniye icinde tekrar basin.', 4800);
    this.showVodControls(5500);
  },

  openPlayerDetails: function () {
    var meta = this.vodMeta || {};
    if (!Tmdb.configured()) {
      UI.toast('Puanlar ve oyuncular icin Ayarlar bolumunden TMDb baglantisini etkinlestirin.', 4500);
      return;
    }
    var item = meta.sourceItem;
    if (!item) { UI.toast('Icerik ayrintisi bulunamadi'); return; }
    var wasPlaying = !!Player.playing && !Player.paused;
    var restorePanel = this.vodPanel;
    if (wasPlaying) Player.toggle();
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    /* Zaman olayi ayrinti penceresini bir saniye sonra ezmesin. */
    this.vodPanel = 'details'; this.osdOn = true;
    var self = this;
    App.tmdb.show(meta.detailKind || (meta.kind === 'ep' ? 'series' : 'movie'), item, meta.sourceInfo || {}, {
      playerMode: true,
      onClose: function () {
        Nav.setOverlay(function (e) { self.keyVod(e); });
        if (wasPlaying && Player.paused) Player.toggle();
        if (restorePanel === 'complete') self.renderCompletion();
        else self.showVodControls(5000);
      }
    });
  },

  renderVodInfo: function (pos, dur) {
    this.ensureVodOsd('info');
    this.updateVodOsd(pos, dur);
  },

  renderVodControls: function (pos, dur) {
    this.ensureVodOsd('controls');
    this.updateVodOsd(pos, dur);
    var controls = this.vodControls();
    var signature = String(this.vodControlIndex) + ':';
    for (var i = 0; i < controls.length; i++) signature += controls[i].id + '=' + controls[i].label + ':' + !!controls[i].disabled + '|';
    var actionsEl = document.getElementById('vod-modern-actions');
    if (actionsEl && signature !== this.vodOsdActionSignature) {
      var transport = '', content = '', utility = '';
      for (var j = 0; j < controls.length; j++) {
        var action = this.vodActionHtml(controls[j], j);
        if (controls[j].group === 'transport') transport += action;
        else if (controls[j].group === 'utility') utility += action;
        else content += action;
      }
      actionsEl.innerHTML = '<div class="vod-action-group transport">' + transport + '</div>' +
        '<div class="vod-action-group content">' + content + '</div>' +
        '<div class="vod-action-group utility">' + utility + '</div>';
      this.vodOsdActionSignature = signature;
    }
    var previousHint = this.previousEpisodeArmUntil > Date.now()
      ? 'Onceki bolum icin tekrar basin · ' + Math.max(1, Math.ceil((this.previousEpisodeArmUntil - Date.now()) / 1000)) : '';
    var hint = document.getElementById('vod-modern-previous');
    if (hint) { hint.textContent = previousHint; hint.style.display = previousHint ? 'block' : 'none'; }
  },

  ensureVodOsd: function (mode) {
    var root = document.getElementById('vod-modern-osd');
    if (root && root.getAttribute('data-mode') === mode) return root;
    var compact = mode === 'info' ? ' compact' : '';
    this.vodOsdActionSignature = '';
    this.overlay().innerHTML = '<div id="vod-modern-osd" data-mode="' + mode + '">' + this.vodIdentityHtml() +
      '<div class="vod-clock"><b id="vod-modern-clock"></b><span id="vod-modern-finish"></span></div>' +
      '<div class="osd vod-osd modern' + compact + '">' +
      '<div class="vod-modern-status" id="vod-modern-state"></div>' +
      '<div class="sub" id="vod-modern-track"></div>' +
      '<div class="seek"><i id="vod-modern-progress"></i></div>' +
      '<div class="times"><span id="vod-modern-now"></span><span id="vod-modern-duration"></span></div>' +
      '<div class="seek-feedback" id="vod-modern-seek"></div>' +
      (mode === 'controls' ? '<div class="vod-actions" id="vod-modern-actions"></div><div class="vod-previous-hint" id="vod-modern-previous"></div>' :
        '<div class="vod-key-help">OK Oynat/Duraklat · Sol −10 sn · Sag +30 sn · Yukari Kontroller · INFO Ayrintilar</div>') +
      '</div></div>';
    return document.getElementById('vod-modern-osd');
  },

  updateVodOsd: function (pos, dur) {
    var pct = dur ? Math.max(0, Math.min(100, pos / dur * 100)) : 0;
    var progress = document.getElementById('vod-modern-progress');
    if (progress) progress.style.transform = 'scaleX(' + (pct / 100).toFixed(4) + ')';
    var nowEl = document.getElementById('vod-modern-now'), durEl = document.getElementById('vod-modern-duration');
    if (nowEl) nowEl.textContent = mmss(pos); if (durEl) durEl.textContent = dur ? mmss(dur) : '';
    var state = document.getElementById('vod-modern-state');
    if (state) state.textContent = Player.paused ? 'Duraklatildi' : 'Oynatiliyor';
    var summary = Player.trackSummary(), track = document.getElementById('vod-modern-track');
    if (track) track.textContent = 'Ses: ' + summary.audio + ' · Altyazi: ' + summary.text;
    var feedback = document.getElementById('vod-modern-seek');
    if (feedback) {
      if (this.seekFeedback && this.seekFeedback.until > Date.now()) {
        feedback.innerHTML = '<b>' + (this.seekFeedback.delta > 0 ? '+' : '') + this.seekFeedback.delta + ' sn</b><span>' +
          mmss(this.seekFeedback.from) + ' → ' + mmss(this.seekFeedback.to) + '</span>';
        feedback.style.display = 'flex';
      } else { feedback.innerHTML = ''; feedback.style.display = 'none'; }
    }
    function two(value) { value = Math.floor(value); return value < 10 ? '0' + value : String(value); }
    var now = new Date(), clock = document.getElementById('vod-modern-clock'), finish = document.getElementById('vod-modern-finish');
    if (clock) clock.textContent = two(now.getHours()) + ':' + two(now.getMinutes());
    if (finish) {
      if (dur && dur > pos) {
        var end = new Date(now.getTime() + Math.max(0, dur - pos) * 1000);
        finish.textContent = 'Bitis ' + two(end.getHours()) + ':' + two(end.getMinutes());
      } else finish.textContent = '';
    }
  },

  vodIdentityHtml: function () {
    var m = this.vodMeta || {};
    var line = [];
    if (m.kind === 'ep') line.push('Sezon ' + (m.season || '?') + ' · Bölüm ' + (m.episodeNum || '?'));
    else if (m.year) line.push(String(m.year).slice(0, 4));
    return '<div class="vod-identity"><div class="vod-identity-type">' + esc(m.mediaType || (m.kind === 'ep' ? 'DİZİ' : 'FİLM')) + '</div>' +
      '<div class="vod-identity-title">' + esc(m.title || m.name || '') + '</div>' +
      (m.episodeTitle ? '<div class="vod-identity-episode">' + esc(m.episodeTitle) + '</div>' : '') +
      (line.length ? '<div class="vod-identity-meta">' + esc(line.join(' · ')) + '</div>' : '') + '</div>';
  },

  schedulePauseCinema: function () {
    if (this.pauseCinemaTimer) clearTimeout(this.pauseCinemaTimer);
    if (!Player.paused || this.mode !== 'vod') return;
    var self = this;
    this.pauseCinemaTimer = setTimeout(function () {
      if (self.mode === 'vod' && Player.paused) self.showPauseCinema();
    }, 6000);
  },

  showPauseCinema: function () {
    if (!Player.paused || this.mode !== 'vod') return;
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    var m = this.vodMeta || {}, pos = Player.position(), dur = Player.duration();
    var episode = m.kind === 'ep' ? ('Sezon ' + (m.season || '?') + ' · Bölüm ' + (m.episodeNum || '?')) : '';
    this.vodPanel = 'pause-cinema'; this.osdOn = true;
    this.overlay().className = 'on';
    this.overlay().innerHTML = '<div class="vod-pause-cinema"><div class="vod-pause-copy">' +
      '<div class="vod-pause-status">DURAKLATILDI</div>' +
      '<div class="vod-pause-parent">' + esc(m.title || (m.kind === 'ep' ? '' : m.name) || '') + '</div>' +
      '<div class="vod-pause-title">' + esc(m.episodeTitle || m.title || m.name || '') + '</div>' +
      (episode ? '<div class="vod-pause-meta">' + esc(episode) + '</div>' : '') +
      (m.plot ? '<div class="vod-pause-plot">' + esc(m.plot) + '</div>' : '') +
      '<div class="vod-pause-time">' + mmss(pos) + (dur ? ' / ' + mmss(dur) : '') + '</div>' +
      '<div class="vod-pause-help">Devam etmek için OK</div></div></div>';
    this.updateSubtitleLayer();
  },

  afterVodToggle: function (controls) {
    if (this.pauseCinemaTimer) { clearTimeout(this.pauseCinemaTimer); this.pauseCinemaTimer = null; }
    if (Player.paused) {
      this.showVodInfo(0);
      this.schedulePauseCinema();
    } else if (controls) this.showVodControls(3500);
    else this.showVodInfo(2500);
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
    if (ms === 0) return;
    var self = this;
    this.osdTimer = setTimeout(function () { self.hideVodOverlay(); }, ms || 4000);
  },

  hideVodOverlay: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.osdOn = false;
    this.vodPanel = 'hidden';
    this.vodTechnicalInfo = false;
    this.vodOsdActionSignature = '';
    if (this.pauseCinemaTimer) { clearTimeout(this.pauseCinemaTimer); this.pauseCinemaTimer = null; }
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
    layer.innerHTML = '';
    if (this.subtitleText) {
      var span = document.createElement('span');
      span.textContent = this.subtitleText;
      layer.appendChild(span);
    }
    var lifted = this.mode === 'vod' && (this.vodPanel === 'info' || this.vodPanel === 'controls' || this.vodPanel === 'tracks');
    var size = Settings.get('subtitleSize') || 'normal';
    var color = Settings.get('subtitleColor') || 'white';
    var background = Settings.get('subtitleBackground') || 'shadow';
    var position = Settings.get('subtitlePosition') || 'bottom';
    layer.className = this.subtitleText
      ? ('on subtitle-size-' + size + ' subtitle-color-' + color + ' subtitle-bg-' + background +
        ' subtitle-pos-' + position + (lifted ? ' lifted' : '')) : '';
  },

  previewSubtitleSize: function () {
    var layer = document.getElementById('subtitle-layer');
    if (!layer) return;
    if (this.subtitlePreviewTimer) clearTimeout(this.subtitlePreviewTimer);
    var labels = { small: 'Kucuk altyazi', normal: 'Normal altyazi', large: 'Buyuk altyazi', xlarge: 'Cok buyuk altyazi' };
    var size = Settings.get('subtitleSize') || 'normal';
    layer.innerHTML = '<span>' + (labels[size] || labels.normal) + '</span>';
    layer.className = 'on subtitle-size-' + size + ' subtitle-color-' + (Settings.get('subtitleColor') || 'white') +
      ' subtitle-bg-' + (Settings.get('subtitleBackground') || 'shadow') +
      ' subtitle-pos-' + (Settings.get('subtitlePosition') || 'bottom');
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

  openSubtitleAppearance: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.vodPanel = 'subtitle-appearance';
    this.subtitleStyleIndex = 0;
    this.osdOn = true;
    this.overlay().className = 'on';
    if (!this.subtitleText) { this.subtitleText = 'Altyazi gorunumu ornegi'; this._stylePreview = true; }
    this.renderSubtitleAppearance();
    this.updateSubtitleLayer();
  },

  subtitleStyleRows: function () {
    return [
      { key: 'subtitleSize', label: 'Boyut', values: ['small', 'normal', 'large', 'xlarge'], names: { small: 'Kucuk', normal: 'Normal', large: 'Buyuk', xlarge: 'Cok buyuk' } },
      { key: 'subtitleColor', label: 'Renk', values: ['white', 'yellow'], names: { white: 'Beyaz', yellow: 'Sari' } },
      { key: 'subtitleBackground', label: 'Arka plan', values: ['shadow', 'soft', 'solid'], names: { shadow: 'Golgelik', soft: 'Yari saydam', solid: 'Siyah' } },
      { key: 'subtitlePosition', label: 'Konum', values: ['bottom', 'middle', 'low'], names: { bottom: 'Alt', middle: 'Orta-alt', low: 'En alt' } }
    ];
  },

  renderSubtitleAppearance: function () {
    var rows = this.subtitleStyleRows(), html = '';
    for (var i = 0; i < rows.length; i++) {
      var value = Settings.get(rows[i].key) || rows[i].values[0];
      html += '<div class="subtitle-style-row' + (i === this.subtitleStyleIndex ? ' focus' : '') + '"><span>' +
        rows[i].label + '</span><b>‹ ' + rows[i].names[value] + ' ›</b></div>';
    }
    this.overlay().innerHTML = '<div class="subtitle-style-shade"><div class="subtitle-style-panel">' +
      '<div class="subtitle-style-title">Altyazi gorunumu</div>' +
      '<div class="subtitle-style-sub">Metin altyazilarinda aninda uygulanir</div>' + html +
      '<div class="subtitle-style-help">↑↓ Secim · ←→ Degistir · Geri Oynatici</div></div></div>';
  },

  changeSubtitleStyle: function (delta) {
    var row = this.subtitleStyleRows()[this.subtitleStyleIndex];
    var index = row.values.indexOf(Settings.get(row.key));
    if (index < 0) index = 0;
    Settings.set(row.key, row.values[(index + delta + row.values.length) % row.values.length]);
    this.renderSubtitleAppearance();
    this.updateSubtitleLayer();
  },

  closeSubtitleAppearance: function () {
    if (this._stylePreview) { this.subtitleText = ''; this._stylePreview = false; }
    this.showVodControls(6000);
    this.updateSubtitleLayer();
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
    if (!this.vodTrackDiscoveryTried && Player.needsSubtitleLabelDiscovery &&
        Player.needsSubtitleLabelDiscovery() && !Player.subtitleCompatibilityBusy()) {
      this.vodTrackDiscoveryTried = true;
      var self = this;
      setTimeout(function () {
        if (self.mode !== 'vod' || self.vodPanel !== 'tracks') return;
        if (Player.startSubtitleCompatibility()) {
          UI.toast('Altyazi dilleri otomatik olarak belirleniyor', 3200);
          self.renderTrackPanel();
        }
      }, 80);
    }
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
          (item.disabled ? ' disabled' : '') +
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
    if (!Player.showSubtitleCompatibilityAction || Player.showSubtitleCompatibilityAction()) {
      var busy = Player.subtitleCompatibilityBusy && Player.subtitleCompatibilityBusy();
      rows.push({
        index: 'compatibility', action: 'compatibility',
        disabled: !!busy,
        label: busy ? 'Altyazi uyumlulugu hazirlaniyor...'
          : (Player._softwareSubtitleTrack
            ? 'Altyaziyi yeniden incele / hazirla'
            : 'Altyazi dillerini goster / Uyumlulugu hazirla')
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
      warning = '<div class="track-warning">' + esc(Player.softwareSubtitleStatus) +
        (Player._softwareLastError
          ? '<div class="track-recovery">Tekrar dene: Uyumlulugu hazirla &nbsp; · &nbsp; Baska altyazi sec &nbsp; · &nbsp; Kapali</div>'
          : '') + '</div>';
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
        if (selected.disabled) { UI.toast('Altyazi islemi halen devam ediyor', 3000); return; }
        ok = Player.startSubtitleCompatibility();
        UI.toast(ok ? 'Altyazi dilleri oynatma kesilmeden inceleniyor'
          : 'Uyumluluk incelemesi baslatilamadi', 4000);
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

  openAspectPanel: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.vodPanel = 'aspect';
    this.osdOn = true;
    this.vodAspectIndex = Player.aspectOrder.indexOf(Player.normalizeAspect(Player.aspect));
    if (this.vodAspectIndex < 0) this.vodAspectIndex = 0;
    this.overlay().className = 'on';
    this.renderAspectPanel();
    this.updateSubtitleLayer();
  },

  renderAspectPanel: function () {
    var rows = '';
    for (var i = 0; i < Player.aspectOrder.length; i++) {
      var mode = Player.aspectOrder[i];
      var unsupported = Player.isUnsupportedAvCrop && Player.isUnsupportedAvCrop(mode);
      rows += '<div class="aspect-row' + (i === this.vodAspectIndex ? ' focus' : '') +
        (mode === Player.normalizeAspect(Player.aspect) ? ' current' : '') +
        (unsupported ? ' unsupported' : '') + '">' +
        '<span class="aspect-check">' + (mode === Player.normalizeAspect(Player.aspect) ? '\u2713' : '') + '</span>' +
        '<span>' + esc(Player.aspectLabel(mode)) + (unsupported ? ' · HTML5 gerekli' : '') + '</span></div>';
    }
    this.overlay().innerHTML = '<div class="aspect-shade"><div class="aspect-panel">' +
      '<div class="aspect-title">Goruntu bicimi</div>' +
      '<div class="aspect-sub">Motor degismeden donanimsal goruntu yerlesimi uygulanir</div>' +
      '<div class="aspect-list">' + rows + '</div>' +
      '<div class="aspect-help">\u2191\u2193 Secim &nbsp; · &nbsp; OK Uygula &nbsp; · &nbsp; Geri Oynatici</div>' +
      '</div></div>';
  },

  moveAspectSelection: function (delta) {
    this.vodAspectIndex = Math.max(0, Math.min(Player.aspectOrder.length - 1, this.vodAspectIndex + delta));
    this.renderAspectPanel();
  },

  selectAspect: function () {
    var mode = Player.aspectOrder[this.vodAspectIndex] || 'auto';
    if (Player.isUnsupportedAvCrop && Player.isUnsupportedAvCrop(mode)) {
      UI.toast('Bu kirpma modu AVPlay ile uygulanamiyor. HTML5 oynatma motorunu secip tekrar deneyin.', 5200);
      this.renderAspectPanel();
      return;
    }
    var name = Player.setAspect(mode);
    if (this.vodMeta) this.vodMeta._sessionAspect = mode;
    this.renderAspectPanel();
    UI.toast(Player.lastAspectApplied ? 'Goruntu bicimi: ' + name : 'Goruntu bicimi uygulanamadi', 3200);
  },

  switchVodEngine: function () {
    if (this.mode !== 'vod' || !this.vodMeta || Player.isPreparing()) {
      UI.toast('Oynatici hazirken motor degistirilebilir'); return;
    }
    if (this.vodMeta._localServiceId) {
      UI.toast('Yerel MP4 uyumluluk yontemi AVPlay ile calisir'); return;
    }
    var target = Player.engine === 'avplay' ? 'html5' : 'avplay';
    if (target === 'avplay' && !Player.hasAvplay()) { UI.toast('Bu cihazda AVPlay kullanilamiyor'); return; }
    var meta = {}, key;
    for (key in this.vodMeta) if (Object.prototype.hasOwnProperty.call(this.vodMeta, key) && key.charAt(0) !== '_') meta[key] = this.vodMeta[key];
    meta._sessionAspect = Player.aspect;
    meta.startAt = Player.position();
    meta._resumePaused = !!Player.paused;
    var trackState = Player.tracks || Player.emptyTracks();
    var audioTrack = Player.trackByIndex('audio', trackState.currentAudio);
    var textTrack = trackState.subtitlesOff ? null : Player.trackByIndex('text', trackState.currentText);
    if (audioTrack) meta._sessionAudioPreference = audioTrack.preferenceKey;
    meta._sessionSubtitlePreference = textTrack ? textTrack.preferenceKey : 'off';
    Resume.save(meta.kind, meta.progressId || meta.id, meta.startAt, Player.duration(), meta.name);
    if (this.saveTimer) { clearInterval(this.saveTimer); this.saveTimer = null; }
    var token = ++this.vodSwitchToken, self = this;
    this.vodReady = false;
    this.vodPanel = 'preparing';
    this.osdOn = true;
    this.overlay().className = 'on';
    this.overlay().innerHTML = '<div class="player-msg"><div class="big">Oynatma motoru degistiriliyor</div>' +
      '<div class="small">' + String(target).toUpperCase() + ' hazirlaniyor<br><br>Tek baglanti icin mevcut oynatici kapatiliyor.</div></div>';
    Player.stop(true);
    setTimeout(function () {
      if (token !== self.vodSwitchToken || self.mode !== 'vod') return;
      self.startVod(meta, target);
    }, 500);
  },

  runVodControl: function () {
    var control = this.vodControls()[this.vodControlIndex];
    if (!control) return;
    if (control.disabled) { UI.toast('Bu secenek bu icerikte kullanilamiyor'); return; }
    if (control.id === 'play') { Player.toggle(); this.afterVodToggle(true); return; }
    if (control.id === 'rewind') { this.seekVod(-10, true); return; }
    if (control.id === 'forward') { this.seekVod(30, true); return; }
    if (control.id === 'previous') { this.playPreviousEpisode(); return; }
    if (control.id === 'episodes') { this.openEpisodeList(); return; }
    if (control.id === 'next') { this.switchEpisode(this.vodMeta.nextEpisode); return; }
    if (control.id === 'restart') { this.restartCurrentVod(); return; }
    if (control.id === 'details') { this.openPlayerDetails(); return; }
    if (control.id === 'favorite') { this.toggleVodFavorite(); return; }
    if (control.id === 'more') { this.openVodTools(); return; }
    this.showVodControls(6000);
  },

  moveVodControl: function (delta) {
    var controls = this.vodControls(), next = this.vodControlIndex, guard = 0;
    do {
      next += delta; guard++;
      if (next < 0 || next >= controls.length) return;
    } while (controls[next].disabled && guard <= controls.length);
    this.vodControlIndex = next;
    this.showVodControls(6000);
  },

  runVodTool: function () {
    var control = this.vodToolControls()[this.vodToolIndex];
    if (!control) return;
    if (control.id === 'tracks') { this.openTrackPanel(); return; }
    if (control.id === 'subtitleSize') { this.openSubtitleAppearance(); return; }
    if (control.id === 'aspect') { this.openAspectPanel(); return; }
    if (control.id === 'engine') { this.switchVodEngine(); return; }
    if (control.id === 'contentInfo') { this.openVodContentInfo(); return; }
  },

  seekVod: function (delta, controls) {
    var from = Player.position(), ok = Player.seek(delta), to = Player.position();
    if (ok) this.seekFeedback = { delta: delta, from: from, to: to, until: Date.now() + 1700 };
    if (controls) this.showVodControls(6000);
    else this.showVodInfo(3500);
  },

  keyVod: function (e) {
    var c = e.keyCode;
    e.preventDefault();

    if (Diag.visible) { if (c === KEY.BACK || c === KEY.ENTER) Diag.hide(); return; }

    if (c === KEY.STOP) { this.exit(); return; }
    if (c === KEY.INFO && this.vodPanel !== 'error' && this.vodPanel !== 'local-service' && this.vodPanel !== 'preparing') {
      this.openPlayerDetails(); return;
    }

    if (this.vodPanel === 'preparing') {
      if (c === KEY.UP) { Player.retrySubtitlePreparation(); return; }
      if (c === KEY.ENTER) { Player.skipSubtitlePreparation(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.exit(); return; }
      return;
    }

    if (this.vodPanel === 'local-service') {
      if (c === KEY.INFO || c === KEY.UP) { Diag.render(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.exit(); return; }
      return;
    }

    if (this.vodPanel === 'next') {
      if (c === KEY.ENTER || c === KEY.PLAY || c === KEY.PLAYPAUSE) { this.playNextEpisode(); return; }
      if (c === KEY.BACK || c === KEY.ESC) {
        if (this.nextTimer || this.nextCountdown) {
          if (this.nextTimer) { clearInterval(this.nextTimer); this.nextTimer = null; }
          this.nextCountdown = 0; this.nextCancelled = true; this.renderNextEpisode();
        } else this.exit();
        return;
      }
      return;
    }

    if (this.vodPanel === 'complete') {
      var completionActions = this.completionActions();
      if (c === KEY.LEFT) { this.completionIndex = Math.max(0, this.completionIndex - 1); this.renderCompletion(); return; }
      if (c === KEY.RIGHT) { this.completionIndex = Math.min(completionActions.length - 1, this.completionIndex + 1); this.renderCompletion(); return; }
      if (c === KEY.ENTER) { this.runCompletionAction(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.exit(); return; }
      return;
    }

    if (this.vodPanel === 'episodes') {
      var episodeData = this.episodePanelData(), seasonRows = episodeData.seasons;
      var activeSeason = seasonRows[this.vodEpisodeSeasonIndex];
      var episodeRows = activeSeason ? activeSeason.episodes : [];
      if (c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) { Player.toggle(); this.renderEpisodePanel(); return; }
      if (c === KEY.LEFT) { this.vodEpisodeColumn = 'seasons'; this.renderEpisodePanel(); return; }
      if (c === KEY.RIGHT) { this.vodEpisodeColumn = 'episodes'; this.renderEpisodePanel(); return; }
      if (c === KEY.UP || c === KEY.DOWN || c === KEY.CH_UP || c === KEY.CH_DOWN) {
        var amount = (c === KEY.UP ? -1 : (c === KEY.DOWN ? 1 : (c === KEY.CH_UP ? -6 : 6)));
        if (this.vodEpisodeColumn === 'seasons') {
          this.vodEpisodeSeasonIndex = Math.max(0, Math.min(seasonRows.length - 1, this.vodEpisodeSeasonIndex + (amount < 0 ? -1 : 1)));
          this.vodEpisodeIndex = 0;
        } else this.vodEpisodeIndex = Math.max(0, Math.min(Math.max(0, episodeRows.length - 1), this.vodEpisodeIndex + amount));
        this.renderEpisodePanel(); return;
      }
      if (c === KEY.ENTER) {
        if (this.vodEpisodeColumn === 'seasons') { this.vodEpisodeColumn = 'episodes'; this.renderEpisodePanel(); return; }
        var chosenSeason = this.episodePanelData().seasons[this.vodEpisodeSeasonIndex];
        var chosen = chosenSeason && chosenSeason.episodes[this.vodEpisodeIndex];
        if (chosen && String(chosen.id) !== String((this.vodMeta || {}).id)) this.switchEpisode(chosen);
        else this.showVodControls(6000);
        return;
      }
      if (c === KEY.BACK || c === KEY.ESC) { this.showVodControls(6000); return; }
      return;
    }

    if (this.vodPanel === 'tools') {
      if (c === KEY.UP) { this.vodToolIndex = Math.max(0, this.vodToolIndex - 1); this.renderVodTools(); return; }
      if (c === KEY.DOWN) { this.vodToolIndex = Math.min(this.vodToolControls().length - 1, this.vodToolIndex + 1); this.renderVodTools(); return; }
      if (c === KEY.ENTER) { this.runVodTool(); return; }
      if (c === KEY.BACK || c === KEY.ESC || c === KEY.LEFT) { this.showVodControls(6000); return; }
      return;
    }

    if (this.vodPanel === 'content-info') {
      if (c === KEY.BACK || c === KEY.ESC || c === KEY.LEFT) {
        this.vodPanel = 'tools'; this.renderVodTools(); return;
      }
      return;
    }

    if (this.vodPanel === 'tracks') {
      if (c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) { Player.toggle(); this.afterVodToggle(false); return; }
      if (c === KEY.LEFT) { this.vodTrackColumn = 'audio'; this.renderTrackPanel(); return; }
      if (c === KEY.RIGHT) { this.vodTrackColumn = 'text'; this.renderTrackPanel(); return; }
      if (c === KEY.UP) { this.moveTrackSelection(-1); return; }
      if (c === KEY.DOWN) { this.moveTrackSelection(1); return; }
      if (c === KEY.ENTER) { this.selectFocusedTrack(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.showVodControls(6000); return; }
      return;
    }

    if (this.vodPanel === 'aspect') {
      if (c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) {
        Player.toggle(); this.renderAspectPanel(); return;
      }
      if (c === KEY.UP) { this.moveAspectSelection(-1); return; }
      if (c === KEY.DOWN) { this.moveAspectSelection(1); return; }
      if (c === KEY.ENTER) { this.selectAspect(); return; }
      if (c === KEY.BACK || c === KEY.ESC || c === KEY.LEFT) { this.showVodControls(6000); return; }
      return;
    }

    if (this.vodPanel === 'controls') {
      if (c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) {
        Player.toggle(); this.afterVodToggle(true); return;
      }
      if (c === KEY.RW) { this.seekVod(-10, true); return; }
      if (c === KEY.FF) { this.seekVod(30, true); return; }
      if (c === KEY.LEFT) {
        this.moveVodControl(-1); return;
      }
      if (c === KEY.RIGHT) {
        this.moveVodControl(1); return;
      }
      if (c === KEY.ENTER) { this.runVodControl(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.hideVodOverlay(); return; }
      if (c === KEY.DOWN) { this.showVodInfo(4000); return; }
      if (c === KEY.INFO) { this.openPlayerDetails(); return; }
      if (c === KEY.UP) { this.showVodControls(6000); return; }
      return;
    }

    if (this.vodPanel === 'error') {
      if (this.vodErrorIndex == null && c === KEY.ENTER && this.canUseLocalMp4Fallback()) {
        this.startLocalMp4Fallback(); return;
      }
      if (this.vodErrorIndex == null) this.vodErrorIndex = 0;
      if (c === KEY.LEFT) { this.vodErrorIndex = Math.max(0, this.vodErrorIndex - 1); this.renderVodError(); return; }
      if (c === KEY.RIGHT) { this.vodErrorIndex = Math.min(2, this.vodErrorIndex + 1); this.renderVodError(); return; }
      if (c === KEY.ENTER) {
        if (this.vodErrorIndex === 0) { this.retryVod(); return; }
        if (this.vodErrorIndex === 1) { this.exit(); return; }
        Diag.render(); return;
      }
      if (c === KEY.INFO || c === KEY.UP) { Diag.render(); return; }
      if (c === KEY.BACK || c === KEY.ESC) this.exit();
      return;
    }

    if (this.vodPanel === 'subtitle-appearance') {
      if (c === KEY.UP) { this.subtitleStyleIndex = Math.max(0, this.subtitleStyleIndex - 1); this.renderSubtitleAppearance(); return; }
      if (c === KEY.DOWN) { this.subtitleStyleIndex = Math.min(this.subtitleStyleRows().length - 1, this.subtitleStyleIndex + 1); this.renderSubtitleAppearance(); return; }
      if (c === KEY.LEFT) { this.changeSubtitleStyle(-1); return; }
      if (c === KEY.RIGHT || c === KEY.ENTER) { this.changeSubtitleStyle(1); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.closeSubtitleAppearance(); return; }
      return;
    }

    if (this.vodPanel === 'pause-cinema') {
      if (c === KEY.ENTER || c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) {
        Player.toggle(); this.afterVodToggle(false); return;
      }
      if (c === KEY.LEFT || c === KEY.RW) { this.seekVod(-10, false); this.schedulePauseCinema(); return; }
      if (c === KEY.RIGHT || c === KEY.FF) { this.seekVod(30, false); this.schedulePauseCinema(); return; }
      if (c === KEY.UP) { this.vodControlIndex = 0; this.showVodControls(6000); return; }
      if (c === KEY.INFO) { this.openPlayerDetails(); return; }
      if (c === KEY.DOWN) { this.showVodInfo(0, false); this.schedulePauseCinema(); return; }
      if (c === KEY.BACK || c === KEY.ESC) { this.hideVodOverlay(); return; }
      return;
    }

    /* OSD kapali veya yalnizca bilgi gorunurken hizli tuslar dogrudan calisir. */
    if (c === KEY.ENTER || c === KEY.PLAYPAUSE || c === KEY.PLAY || c === KEY.PAUSE) {
      Player.toggle(); this.afterVodToggle(false); return;
    }
    if (c === KEY.LEFT || c === KEY.RW) { this.seekVod(-10, false); return; }
    if (c === KEY.RIGHT || c === KEY.FF) { this.seekVod(30, false); return; }
    if (c === KEY.UP) {
      this.vodControlIndex = 0; /* Yukari + OK ile dogrudan Ses ve Altyazi. */
      this.showVodControls(6000); return;
    }
    if (c === KEY.DOWN) {
      if (this.vodPanel === 'info') this.hideVodOverlay();
      else this.showVodInfo(4000);
      return;
    }
    if (c === KEY.INFO) { this.openPlayerDetails(); return; }
    if (c === KEY.BACK || c === KEY.ESC) {
      if (this.vodPanel === 'info') this.hideVodOverlay();
      else this.exit();
      return;
    }
  },

  completeVod: function () {
    var meta = this.vodMeta;
    if (!meta) { this.exit(); return; }
    Resume.remove(meta.kind, meta.progressId || meta.id);
    if (meta.kind === 'movie') WatchState.setContent('movie', meta.id, true, meta.name);
    else if (meta.kind === 'ep') WatchState.setEpisode(meta.seriesId, meta.season, meta.episodeNum, true, meta.name);
    if (this.saveTimer) { clearInterval(this.saveTimer); this.saveTimer = null; }
    if (meta.kind !== 'ep' || !meta.nextEpisode || !meta.seriesItem) {
      this.showCompletion();
      return;
    }
    Player.stop(true);
    this.vodPanel = 'next'; this.osdOn = true;
    this.overlay().className = 'on';
    this.nextCancelled = false;
    this.nextCountdown = Settings.get('nextEpisodeAutoplay') ? 10 : 0;
    this.renderNextEpisode();
    if (this.nextTimer) clearInterval(this.nextTimer);
    if (this.nextCountdown) {
      var self = this;
      this.nextTimer = setInterval(function () {
        self.nextCountdown--;
        if (self.nextCountdown <= 0) { clearInterval(self.nextTimer); self.nextTimer = null; self.playNextEpisode(); }
        else self.renderNextEpisode();
      }, 1000);
    }
  },

  renderNextEpisode: function () {
    var next = this.vodMeta && this.vodMeta.nextEpisode;
    if (!next) return;
    this.overlay().innerHTML = '<div class="next-episode"><div class="next-card">' +
      '<div class="next-kicker">Siradaki bolum</div><div class="next-title">' +
      esc(next.title || ('Bolum ' + next.episode_num)) + '</div>' +
      (this.nextCountdown ? '<div class="next-count">' + this.nextCountdown + ' saniye sonra otomatik olarak sonraki bolum oynatilacak</div>' : '') +
      (this.nextCancelled ? '<div class="next-count cancelled">Otomatik gecis iptal edildi</div>' : '') +
      '<div class="next-actions"><span class="focus">OK Oynat</span><span>Geri Diziye don</span></div>' +
      '<div class="next-help">Bu ozelligi Ayarlar &gt; Oynatma bolumunden kapatabilirsiniz.</div></div></div>';
  },

  playNextEpisode: function () {
    if (this.nextTimer) { clearInterval(this.nextTimer); this.nextTimer = null; }
    var meta = this.vodMeta, next = meta && meta.nextEpisode, series = meta && meta.seriesItem;
    if (!next || !series) { this.exit(); return; }
    this.switchEpisode(next);
  },

  completionActions: function () {
    return [
      { id: 'restart', label: this.vodMeta && this.vodMeta.kind === 'ep' ? 'Bolumu bastan oynat' : 'Bastan oynat' },
      { id: 'details', label: 'Puanlar ve ayrintilar' },
      { id: 'back', label: this.vodMeta && this.vodMeta.kind === 'ep' ? 'Diziye don' : 'Filmlere don' }
    ];
  },

  showCompletion: function () {
    if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }
    this.vodPanel = 'complete'; this.osdOn = true; this.completionIndex = 0;
    this.overlay().className = 'on';
    this.renderCompletion();
  },

  renderCompletion: function () {
    var meta = this.vodMeta || {}, actions = this.completionActions(), buttons = '';
    for (var i = 0; i < actions.length; i++) {
      buttons += '<span class="' + (i === this.completionIndex ? 'focus' : '') + '">' + esc(actions[i].label) + '</span>';
    }
    var finalEpisode = meta.kind === 'ep' && !meta.nextEpisode;
    this.vodPanel = 'complete'; this.osdOn = true;
    this.overlay().className = 'on';
    this.overlay().innerHTML = '<div class="vod-completion"><div class="vod-completion-shade">' +
      '<div class="vod-completion-copy"><div class="vod-completion-kicker">' +
      (finalEpisode ? 'DIZI TAMAMLANDI' : (meta.kind === 'ep' ? 'BOLUM TAMAMLANDI' : 'FILM TAMAMLANDI')) + '</div>' +
      '<div class="vod-completion-title">' + esc(meta.episodeTitle || meta.title || meta.name || '') + '</div>' +
      (finalEpisode ? '<div class="vod-completion-note">Son sezonun son bolumune ulastiniz.</div>' : '') +
      '<div class="vod-completion-actions">' + buttons + '</div>' +
      '<div class="vod-completion-help">Sol/Sag Secim · OK Uygula · Geri Kapat</div>' +
      '</div></div></div>';
  },

  replayCurrentVod: function () {
    var meta = this.vodMeta, self = this;
    if (!meta) return;
    if (this.nextTimer) { clearInterval(this.nextTimer); this.nextTimer = null; }
    Resume.remove(meta.kind, meta.progressId || meta.id);
    meta.startAt = 0; meta._resumePaused = false; meta._sessionAspect = Player.aspect;
    Player.stop(true);
    setTimeout(function () { if (self.mode === 'vod' && self.vodMeta === meta) self.startVod(meta, self.vodEngineOverride); }, 250);
  },

  runCompletionAction: function () {
    var action = this.completionActions()[this.completionIndex];
    if (!action) return;
    if (action.id === 'restart') { this.replayCurrentVod(); return; }
    if (action.id === 'details') { this.openPlayerDetails(); return; }
    this.exit();
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
      self.liveInfoCard = false;
      ov.className = '';
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
      : 'Bu icerigin saglayici kaynagi veya dosya yapisi su anda kullanilamiyor.';
    this.overlay().className = 'on';
    if (this.mode === 'vod') { this.vodPanel = 'error'; this.osdOn = true; this.vodErrorIndex = 0; }
    if (this.mode === 'vod') this.renderSubtitle('');
    if (this.mode === 'vod') this.renderVodError();
    else this.overlay().innerHTML = '<div class="player-msg"><div class="big">Yayin acilamadi</div>' +
      '<div class="small">' + hint + '<br><br>Geri tusu ile listeye donun.</div></div>';
    if (this.osdTimer) clearTimeout(this.osdTimer);
    var source = this.vodMeta
      ? this.vodMeta.kind + ':' + this.vodMeta.id
      : (this.channels && this.channels[this.index] ? 'live:' + this.channels[this.index].stream_id : 'bilinmiyor');
    Diag.add('Oynatma: ' + msg + ' [' + source + ']');
  },

  renderVodError: function () {
    var meta = this.vodMeta || {}, buttons = ['Yeniden dene', 'Listeye don', 'Teshis'];
    var actions = '';
    for (var i = 0; i < buttons.length; i++) actions += '<span class="' + (i === this.vodErrorIndex ? 'focus' : '') + '">' + buttons[i] + '</span>';
    this.overlay().innerHTML = '<div class="vod-error-friendly"><div class="vod-error-card">' +
      (meta.cover ? '<div class="vod-error-poster" style="background-image:url(' + esc(meta.cover) + ')"></div>' : '') +
      '<div class="vod-error-copy"><div class="vod-error-title">Icerik acilamadi</div>' +
      '<div class="vod-error-name">' + esc(meta.name || 'Secilen icerik') + '</div>' +
      '<div class="vod-error-note">Alternatif kaynaklar ve TV uyumluluk yontemi denendi. Biraz sonra yeniden deneyebilir veya listeye donebilirsiniz.</div>' +
      '<div class="vod-error-actions">' + actions + '</div>' +
      '<div class="vod-error-help">← → Secim · OK Uygula · INFO Teknik ayrinti</div></div></div></div>';
  },

  retryVod: function () {
    var self = this, meta = this.vodMeta;
    if (!meta) { this.exit(); return; }
    Player.stop(true);
    meta._localAttempted = false;
    meta._attemptedSourceIds = {};
    meta._localPlaybackUrl = '';
    meta._localSubtitleUrl = '';
    meta.startAt = Resume.get(meta.kind, meta.progressId || meta.id) ? Resume.get(meta.kind, meta.progressId || meta.id).pos : 0;
    this.renderLocalServicePreparation('Kaynak yeniden deneniyor');
    setTimeout(function () { if (self.mode === 'vod' && self.vodMeta === meta) self.startVod(meta, self.vodEngineOverride); }, 500);
  },

  exit: function (focusCategories) {
    if (this.pauseCinemaTimer) { clearTimeout(this.pauseCinemaTimer); this.pauseCinemaTimer = null; }
    if (this.previousEpisodeTimer) { clearInterval(this.previousEpisodeTimer); this.previousEpisodeTimer = null; }
    this.previousEpisodeArmUntil = 0;
    this.vodSwitchToken++;
    if (this.nextTimer) { clearInterval(this.nextTimer); this.nextTimer = null; }
    if (this.mode === 'vod' && this.vodMeta && this.vodPanel !== 'complete' && this.vodPanel !== 'next') {
      Resume.save(this.vodMeta.kind, this.vodMeta.progressId || this.vodMeta.id,
        Player.position(), Player.duration(), this.vodMeta.name);
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
    this.liveRecoveryNoticeOn = false;
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
      previewTimer: null,
      rawItems: [], prefs: null, adultCategoryIds: {}, categoryNames: {}, categoryIndex: {},
      searchInput: null, searchQuery: '', searchTimer: null, searchToken: 0,
      focusResultsAfterSearch: false, searching: false,
      restoreRequested: false, restoreSearchRequested: false,
      savedCatId: null, savedCatIndex: 0, savedGridIndex: 0,
      savedSearch: null, searchBaseIndex: 0,
      beginView: function (restore) {
        this.prefs = typeof VodPrefs !== 'undefined' ? VodPrefs.get(kind) : { view: 'card', sort: 'provider', filter: 'all' };
        if (!restore) this.savedSearch = null;
        this.restoreSearchRequested = !!restore && !!this.savedSearch;
        this.restoreRequested = !!restore && !this.restoreSearchRequested && this.savedCatId != null;
        if (this.timer) clearTimeout(this.timer);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        if (this.previewTimer) clearTimeout(this.previewTimer);
        this.currentCat = null;
        this.searchQuery = this.restoreSearchRequested ? this.savedSearch.query : '';
        this.focusResultsAfterSearch = false;
        this.searching = false;
        this.searchBaseIndex = this.restoreSearchRequested ? this.savedSearch.baseGridIndex : 0;
        this.searchToken++;
        if (this.searchInput) this.searchInput.value = this.restoreSearchRequested ? this.savedSearch.raw : '';
        var state = document.getElementById('g-search-state');
        if (state) state.textContent = this.restoreSearchRequested ? this.savedSearch.items.length + ' sonuc' : '';
      },
      remember: function () {
        if (!this.currentCat || !this.cats || !this.grid) return;
        this.savedCatId = this.currentCat.category_id;
        this.savedCatIndex = this.cats.index;
        this.savedGridIndex = this.grid.index;
        if (this.searchQuery.length >= 3) {
          this.savedSearch = {
            raw: this.searchInput ? this.searchInput.value : this.searchQuery,
            query: this.searchQuery,
            items: this.grid.items.slice(0),
            rawItems: this.rawItems.slice(0),
            gridIndex: this.grid.index,
            baseGridIndex: this.searchBaseIndex
          };
        } else this.savedSearch = null;
      },
      resetSearch: function () {
        if (this.timer) clearTimeout(this.timer);
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.currentCat = null;
        this.searchQuery = '';
        this.searching = false;
        this.searchToken++;
        if (this.searchInput) this.searchInput.value = '';
        var state = document.getElementById('g-search-state');
        if (state) state.textContent = '';
        this.updateSearchEmptyAction(0);
      },
      restoreSearch: function () {
        var saved = this.savedSearch;
        if (!saved || !this.grid) return;
        this.searchQuery = saved.query;
        this.searchBaseIndex = saved.baseGridIndex;
        if (this.searchInput) this.searchInput.value = saved.raw;
        this.grid.emptyText = 'Aramanizla eslesen icerik bulunamadi';
        this.rawItems = (saved.rawItems || saved.items).slice(0);
        if (typeof VodPrefs === 'undefined' || !this.grid.setLayout) this.grid.setItems(saved.items.slice(0));
        else this.applyItems();
        var restoredLength = this.grid.items ? this.grid.items.length : saved.items.length;
        this.grid.jumpTo(Math.max(0, Math.min(saved.gridIndex, restoredLength - 1)));
        var title = document.getElementById('g-title'), count = document.getElementById('g-count');
        var state = document.getElementById('g-search-state');
        if (title) title.textContent = 'Arama: ' + saved.raw;
        if (count) count.textContent = restoredLength + ' baslik';
        if (state) state.textContent = this.searchStateText(saved.raw, restoredLength);
        this.updateSearchEmptyAction(restoredLength);
        this.restoreSearchRequested = false;
        Nav.focus('grid');
      },
      clearSearchResults: function () {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchQuery = '';
        this.searching = false;
        this.searchToken++;
        if (this.searchInput) this.searchInput.value = '';
        var state = document.getElementById('g-search-state');
        if (state) state.textContent = '';
        this.updateSearchEmptyAction(0);
        this.savedSearch = null;
        if (!this.currentCat) return;
        this.savedCatId = this.currentCat.category_id;
        this.savedGridIndex = this.searchBaseIndex || 0;
        this.restoreRequested = true;
        this._load(this.currentCat);
        Nav.focus('grid');
      },
      search: function (value) {
        var self = this;
        var raw = String(value || '').trim();
        var q = searchNorm(raw);
        var state = document.getElementById('g-search-state');
        if (this.searchTimer) clearTimeout(this.searchTimer);

        if (q.length < 3) {
          var wasSearching = this.searchQuery.length >= 3;
          this.searchQuery = '';
          this.searching = false;
          this.searchToken++;
          if (state) state.textContent = q.length ? (3 - q.length) + ' harf daha yazin · ' + this.searchScopeLabel() : this.searchScopeLabel();
          this.updateSearchEmptyAction(0);
          if (wasSearching && this.currentCat) this._load(this.currentCat);
          return;
        }

        if (this.searchQuery.length < 3) this.searchBaseIndex = this.grid ? this.grid.index : 0;
        this.searchQuery = q;
        this.searching = true;
        if (this.timer) clearTimeout(this.timer);
        var token = ++this.searchToken;
        if (state) state.textContent = '“' + raw + '” · ' + this.searchScopeName() + ' · aranıyor…';
        this.updateSearchEmptyAction(0);
        this.searchTimer = setTimeout(function () {
          UI.spin(true);
          var categoryId = self.currentCat && self.currentCat.category_id !== '__all' ? self.currentCat.category_id : '';
          var p = kind === 'movie' ? Api.vodStreams(categoryId) : Api.seriesList(categoryId);
          p.then(function (all) {
            UI.spin(false);
            if (token !== self.searchToken || self.searchQuery !== q) return;
            self.searching = false;
            if (self.searchInput !== document.getElementById('g-search')) return;
            var out = [];
            for (var i = 0; i < all.length; i++) {
              if (!Settings.get('includeAdultSearch') && self.adultCategoryIds[String(all[i].category_id)]) continue;
              if (searchNorm(all[i].name).indexOf(q) !== -1) out.push(all[i]);
            }
            out = self.prepareSearchResults(out);
            self.grid.emptyText = self.currentCat && self.currentCat.category_id !== '__all'
              ? 'Bu kategoride aramanızla eşleşen içerik bulunamadı.'
              : 'Tüm kategorilerde aramanızla eşleşen içerik bulunamadı.';
            self.rawItems = out;
            self.applyItems();
            var title = document.getElementById('g-title');
            var count = document.getElementById('g-count');
            if (title) title.textContent = 'Arama: ' + raw;
            if (count) count.textContent = self.grid.items.length + ' baslik';
            if (state) state.textContent = self.searchStateText(raw, self.grid.items.length);
            self.updateSearchEmptyAction(self.grid.items.length);
            if (typeof VodSearchHistory !== 'undefined') VodSearchHistory.add(kind, raw);
            if (self.focusResultsAfterSearch) {
              self.focusResultsAfterSearch = false;
              if (self.grid.items.length) Nav.focus('grid');
              else if (self.currentCat && self.currentCat.category_id !== '__all') Nav.focus('searchAll');
              else Nav.focus('cats');
            }
          })['catch'](function (e) {
            UI.spin(false);
            if (token !== self.searchToken) return;
            self.searching = false;
            if (state) state.textContent = 'Arama yapilamadi';
            UI.toast(e.message || 'Arama yapilamadi', 3500);
          });
        }, 220);
      },
      searchScopeLabel: function () {
        if (!this.currentCat || this.currentCat.category_id === '__all') return 'Tum kategorilerde ara';
        return (this.currentCat.category_name || 'Secili kategori') + ' icinde ara';
      },
      searchScopeName: function () {
        if (!this.currentCat || this.currentCat.category_id === '__all') return 'Tüm kategorilerde';
        return (this.currentCat.category_name || 'Seçili kategori') + ' içinde';
      },
      searchStateText: function (raw, count) {
        return '“' + String(raw || '') + '” · ' + this.searchScopeName() + ' · ' + count + ' sonuç';
      },
      categoryName: function (id) {
        return this.categoryNames[String(id)] || '';
      },
      categoryKeys: function (item) {
        item = item || {};
        var keys = [], tmdbId = String(item.tmdb_id || item.tmdb || '').replace(/\D/g, '');
        var year = String(item.year || item.releaseDate || item.releasedate || '').match(/\b(?:19|20)\d{2}\b/);
        var titleKey = searchNorm(item.name || item.title || '');
        var contentId = String(kind === 'movie' ? item.stream_id : item.series_id);
        if (tmdbId) keys.push('tmdb:' + tmdbId);
        if (titleKey && year) keys.push('title:' + titleKey + '|' + year[0]);
        if (contentId && contentId !== 'undefined' && contentId !== 'null') keys.push('id:' + contentId);
        return keys;
      },
      indexCategoryItems: function (items, fallbackCategoryId) {
        items = items || [];
        for (var i = 0; i < items.length; i++) {
          var row = items[i] || {};
          var categoryId = row.category_id != null && row.category_id !== ''
            ? String(row.category_id) : String(fallbackCategoryId || '');
          var name = this.categoryName(categoryId);
          if (!name) continue;
          var keys = this.categoryKeys(row);
          for (var k = 0; k < keys.length; k++) {
            if (!this.categoryIndex[keys[k]]) this.categoryIndex[keys[k]] = [];
            if (this.categoryIndex[keys[k]].indexOf(name) === -1) this.categoryIndex[keys[k]].push(name);
          }
        }
      },
      categoryNamesFor: function (item, fallbackCategoryId) {
        item = item || {};
        var names = [], add = function (name) {
          name = String(name || '').trim();
          if (name && names.indexOf(name) === -1) names.push(name);
        };
        var existing = item.__categoryNames || [];
        for (var e = 0; e < existing.length; e++) add(existing[e]);
        var keys = this.categoryKeys(item);
        for (var k = 0; k < keys.length; k++) {
          var indexed = this.categoryIndex[keys[k]] || [];
          for (var n = 0; n < indexed.length; n++) add(indexed[n]);
        }
        var ownId = item.category_id != null && item.category_id !== '' ? item.category_id : fallbackCategoryId;
        add(this.categoryName(ownId));
        return names;
      },
      annotateCategoryItems: function (items, fallbackCategoryId) {
        items = items || [];
        for (var i = 0; i < items.length; i++) {
          items[i].__categoryNames = this.categoryNamesFor(items[i], fallbackCategoryId);
          if (items[i].__categoryNames.length === 1) items[i].__categoryLabel = items[i].__categoryNames[0];
          else if (items[i].__categoryNames.length > 1) {
            items[i].__categoryLabel = items[i].__categoryNames[0] + ' + ' + (items[i].__categoryNames.length - 1) + ' kategori';
          } else items[i].__categoryLabel = '';
        }
      },
      prepareSearchResults: function (items) {
        this.indexCategoryItems(items, this.currentCat && this.currentCat.category_id !== '__all'
          ? this.currentCat.category_id : '');
        var merged = [], byKey = {}, scoped = this.currentCat && this.currentCat.category_id !== '__all'
          ? String(this.currentCat.category_id) : '', self = this;
        for (var i = 0; i < items.length; i++) {
          var source = items[i] || {}, row = {}, prop;
          for (prop in source) if (Object.prototype.hasOwnProperty.call(source, prop)) row[prop] = source[prop];
          var categoryId = source.category_id != null && source.category_id !== '' ? String(source.category_id) : scoped;
          var tmdbId = String(source.tmdb_id || source.tmdb || '').replace(/\D/g, '');
          var year = String(source.year || source.releaseDate || source.releasedate || '').match(/\b(?:19|20)\d{2}\b/);
          year = year ? year[0] : '';
          var titleKey = searchNorm(source.name || source.title || '');
          var contentId = String(kind === 'movie' ? source.stream_id : source.series_id);
          var key = tmdbId ? 'tmdb:' + tmdbId : (titleKey && year ? 'title:' + titleKey + '|' + year : 'id:' + contentId);
          var target = byKey[key];
          if (!target) {
            target = row;
            target.__categoryIds = [];
            target.__categoryNames = [];
            byKey[key] = target;
            merged.push(target);
          }
          if (categoryId && target.__categoryIds.indexOf(categoryId) === -1) {
            target.__categoryIds.push(categoryId);
            var categoryName = self.categoryName(categoryId);
            if (categoryName && target.__categoryNames.indexOf(categoryName) === -1) target.__categoryNames.push(categoryName);
          }
        }
        for (i = 0; i < merged.length; i++) {
          var indexedNames = this.categoryNamesFor(merged[i], '');
          for (var ci = 0; ci < indexedNames.length; ci++) {
            if (merged[i].__categoryNames.indexOf(indexedNames[ci]) === -1) merged[i].__categoryNames.push(indexedNames[ci]);
          }
          var names = merged[i].__categoryNames;
          if (names.length === 1) merged[i].__searchCategoryLabel = names[0];
          else if (names.length > 1) merged[i].__searchCategoryLabel = names[0] + ' + ' + (names.length - 1) + ' kategori';
          else merged[i].__searchCategoryLabel = '';
        }
        return merged;
      },
      updateSearchEmptyAction: function (count) {
        var node = document.getElementById('g-search-all');
        if (!node) return;
        var available = !this.searching && this.searchQuery.length >= 3 && count === 0 && this.currentCat && this.currentCat.category_id !== '__all';
        node.className = 'search-all-action' + (available ? ' on' : '');
        if (available) {
          node.innerHTML = '<b>Bu kategoride sonuç bulunamadı</b><span>Tüm kategorilerde ara</span>';
        }
        if (this.cats) this.cats.neighbors.right = available ? 'searchAll' : 'grid';
      },
      searchAllCategories: function () {
        if (this.searchQuery.length < 3 || !this.cats) return;
        var all = null, index = 0;
        for (var i = 0; i < this.cats.items.length; i++) {
          if (this.cats.items[i].category_id === '__all') { all = this.cats.items[i]; index = i; break; }
        }
        if (!all) return;
        this.currentCat = all;
        this.savedCatId = all.category_id;
        this.cats.setCurrent(all.category_id);
        this.cats.jumpTo(index);
        this.focusResultsAfterSearch = true;
        this.search(this.searchInput ? this.searchInput.value : this.searchQuery);
      },
      openSearchHistory: function () {
        var self = this, rows = typeof VodSearchHistory !== 'undefined' ? VodSearchHistory.list(kind) : [];
        if (!rows.length) { UI.toast('Henüz kayıtlı arama yok'); return; }
        var options = [];
        for (var i = 0; i < rows.length; i++) options.push({ value: rows[i], label: rows[i] });
        options.push({ value: '__clear', label: 'Arama geçmişini temizle' });
        App.choiceDialog('Son aramalar', options, '', function (value) {
          if (value === '__clear') {
            VodSearchHistory.clear(kind); UI.toast('Arama geçmişi temizlendi'); return;
          }
          if (self.searchInput) self.searchInput.value = value;
          self.search(value); Nav.focus('search');
        });
      },
      schedulePreview: function (item) {
        if (this.previewTimer) clearTimeout(this.previewTimer);
        var box = document.getElementById('g-focus-preview');
        if (box) box.className = 'vod-focus-preview';
        this.previewTimer = setTimeout(function () {
          var target = document.getElementById('g-focus-preview');
          if (!target || !item) return;
          var year = item.year || item.releaseDate || item.releasedate || '';
          var rating = ProviderRating.text(item), bits = [];
          if (year) bits.push(String(year).slice(0, 4));
          if (rating) bits.push('★ ' + rating);
          bits.push(kind === 'movie' ? 'Film' : 'Dizi');
          target.innerHTML = '<b>' + esc(item.name) + '</b><span>' + esc(bits.join(' · ')) + '</span>';
          target.className = 'vod-focus-preview on';
        }, 750);
      },
      itemId: function (item) {
        return String(kind === 'movie' ? item.stream_id : item.series_id);
      },
      isContinuing: function (item) {
        var id = this.itemId(item);
        if (kind === 'movie') return !!Resume.get('movie', id);
        var recent = Recent.list();
        for (var i = 0; i < recent.length; i++) {
          if (recent[i].kind === 'series' && String(recent[i].id) === id) return true;
        }
        return false;
      },
      dateValue: function (item) {
        var value = item.added || item.last_modified || item.releaseDate || item.releasedate || item.year || 0;
        if (/^\d+$/.test(String(value))) return parseInt(value, 10);
        var parsed = Date.parse(String(value || '').replace(' ', 'T'));
        return isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
      },
      applyItems: function (focusId) {
        if (!this.grid) return;
        if (focusId == null && this.grid.items.length) focusId = this.itemId(this.grid.items[this.grid.index]);
        var list = (this.rawItems || []).slice(0), pref = this.prefs || VodPrefs.get(kind), self = this;
        list = list.filter(function (item) {
          var id = self.itemId(item);
          if (pref.filter === 'favorites') return Favs.has(kind, id);
          if (pref.filter === 'continue') return self.isContinuing(item);
          if (pref.filter === 'completed') return WatchState.has(kind, id);
          if (pref.filter === 'unwatched') return !WatchState.has(kind, id) && !self.isContinuing(item);
          return true;
        });
        if (pref.sort === 'az' || pref.sort === 'za') {
          list.sort(function (a, b) {
            var result = norm(a.name).localeCompare(norm(b.name));
            return pref.sort === 'za' ? -result : result;
          });
        } else if (pref.sort === 'newest' || pref.sort === 'oldest') {
          list.sort(function (a, b) {
            var result = self.dateValue(b) - self.dateValue(a);
            return pref.sort === 'oldest' ? -result : result;
          });
        } else if (pref.sort === 'ratingDesc' || pref.sort === 'ratingAsc') {
          var ranked = [];
          for (var ri = 0; ri < list.length; ri++) {
            ranked.push({ item: list[ri], index: ri, score: ProviderRating.score(list[ri]) });
          }
          ranked.sort(function (a, b) {
            var aMissing = a.score == null, bMissing = b.score == null;
            if (aMissing || bMissing) {
              if (aMissing && bMissing) return a.index - b.index;
              if (pref.sort === 'ratingAsc') return aMissing ? -1 : 1;
              return aMissing ? 1 : -1;
            }
            var result = pref.sort === 'ratingAsc' ? a.score - b.score : b.score - a.score;
            return result || (a.index - b.index);
          });
          list = [];
          for (var rr = 0; rr < ranked.length; rr++) list.push(ranked[rr].item);
        }
        this.grid.setLayout(pref.view === 'list' ? 1 : 5, pref.view === 'list' ? 116 : 404,
          pref.view === 'list' ? 'grid vod-list' : 'grid vod-cards');
        this.grid.setItems(list);
        if (focusId != null) {
          for (var n = 0; n < list.length; n++) if (this.itemId(list[n]) === String(focusId)) { this.grid.jumpTo(n); break; }
        }
        var count = document.getElementById('g-count');
        if (count) count.textContent = list.length + ' baslik';
      },
      preferenceOptions: function (key) {
        var options = {
          view: [
            { value: 'card', label: 'Kart' }, { value: 'list', label: 'Liste' }
          ],
          sort: [
            { value: 'provider', label: 'Sağlayıcı sırası' }, { value: 'az', label: 'A - Z' },
            { value: 'za', label: 'Z - A' }, { value: 'newest', label: 'En yeni' },
            { value: 'oldest', label: 'En eski' }, { value: 'ratingDesc', label: 'Puan: yüksekten' },
            { value: 'ratingAsc', label: 'Puan: düşükten' }
          ],
          filter: [
            { value: 'all', label: 'Tümü' }, { value: 'continue', label: 'Devam et' },
            { value: 'unwatched', label: 'İzlenmemiş' }, { value: 'completed', label: 'İzlenmiş' },
            { value: 'favorites', label: 'Favoriler' }
          ]
        };
        return options[key] || [];
      },
      setPreference: function (key, value) {
        this.prefs[key] = value;
        VodPrefs.set(kind, key, value);
        var choices = this.preferenceOptions(key), label = value;
        for (var i = 0; i < choices.length; i++) if (choices[i].value === value) label = choices[i].label;
        var node = document.getElementById('g-' + key);
        var prefix = key === 'view' ? 'Gorunum: ' : (key === 'sort' ? 'Sirala: ' : 'Filtre: ');
        if (node) node.innerHTML = prefix + '<b>' + label + '</b>';
        this.applyItems();
        var state = document.getElementById('g-search-state');
        if (state && this.searchQuery.length < 3) {
          var active = this.preferenceOptions('filter').filter(function (x) { return x.value === this.prefs.filter; }, this)[0];
          state.textContent = this.searchScopeLabel() + ' · ' + (active ? active.label : 'Tümü');
        }
      },
      openPreference: function (key) {
        var self = this;
        var title = key === 'view' ? 'Görünüm seçin' : (key === 'sort' ? 'Sıralama seçin' : 'Filtre seçin');
        App.choiceDialog(title, this.preferenceOptions(key), this.prefs[key], function (value) {
          self.setPreference(key, value);
        });
      },
      cyclePreference: function (key) {
        /* Eski kumanda akisiyla ve kayitli tercihlerle geriye uyumluluk. Ana
           arayuz artik openPreference ile tum secenekleri birlikte gosterir. */
        var orders = {
          view: ['card', 'list'],
          sort: ['provider', 'az', 'za', 'newest', 'oldest', 'ratingDesc', 'ratingAsc'],
          filter: ['all', 'continue', 'unwatched', 'completed', 'favorites']
        };
        var values = orders[key] || [], current = values.indexOf(this.prefs[key]);
        if (values.length) this.setPreference(key, values[(current + 1) % values.length]);
      },
      init: function () {
        var self = this;
        UI.spin(true);
        var p = kind === 'movie' ? Api.vodCategories() : Api.seriesCategories();
        p.then(function (list) {
          UI.spin(false);
          self.adultCategoryIds = {};
          self.categoryNames = {};
          self.categoryIndex = {};
          for (var ai = 0; ai < list.length; ai++) {
            if (isAdultCategoryName(list[ai].category_name)) self.adultCategoryIds[String(list[ai].category_id)] = true;
            self.categoryNames[String(list[ai].category_id)] = list[ai].category_name || '';
          }
          list = CategoryVisibility.visibleList(kind, list);
          var all = [{ category_id: '__all', category_name: 'Tumu' }].concat(list);
          for (var ci = 0; ci < all.length; ci++) all[ci].__key = all[ci].category_id;
          self.cats.setItems(all);
          var scopeState = document.getElementById('g-search-state');
          if (scopeState && self.searchQuery.length < 3) scopeState.textContent = self.searchScopeLabel();
          if (self.restoreRequested || self.restoreSearchRequested) {
            var found = -1;
            for (var i = 0; i < all.length; i++) {
              if (String(all[i].category_id) === String(self.savedCatId)) { found = i; break; }
            }
            if (found < 0 && self.savedCatIndex < all.length) found = self.savedCatIndex;
            if (found < 0 && self.restoreSearchRequested && all.length) found = 0;
            if (found >= 0) {
              self.savedCatId = all[found].category_id;
              self.currentCat = all[found];
              self.cats.setCurrent(all[found].category_id);
              self.cats.jumpTo(found);
              if (self.restoreSearchRequested) self.restoreSearch();
              else self._load(all[found], true);
            }
          } else if (all.length) {
            /* Ilk acilista Tumu hazir gelir; sonraki kategori degisimleri ancak
               OK ile etkinlesir. */
            self.currentCat = all[0];
            self.cats.setCurrent(all[0].category_id);
            self._load(all[0], false);
          }
        })['catch'](function (e) {
          UI.spin(false);
          UI.toast(e.message || 'Kategoriler alinamadi', 4000);
        });
      },
      loadCategory: function (cat) {
        /* Geriye uyumluluk: programatik cagri aktif kategori secimi sayilir. */
        this.activateCategory(cat, false);
      },
      activateCategory: function (cat, focusGrid) {
        if (!cat) return;
        this.currentCat = cat;
        this.savedCatId = cat.category_id;
        if (this.cats) this.cats.setCurrent(cat.category_id);
        var scopeState = document.getElementById('g-search-state');
        if (this.searchQuery.length >= 3) {
          this.focusResultsAfterSearch = !!focusGrid;
          if (scopeState) scopeState.textContent = '“' + (this.searchInput ? this.searchInput.value : this.searchQuery) + '” · ' + this.searchScopeName() + ' · aranıyor…';
          this.search(this.searchInput ? this.searchInput.value : this.searchQuery);
          return;
        }
        if (scopeState) scopeState.textContent = this.searchScopeLabel();
        if (this.timer) clearTimeout(this.timer);
        this._load(cat, !!focusGrid);
      },
      _load: function (cat, focusGrid) {
        var self = this;
        if (!cat || this.searchQuery.length >= 3) return;
        var title = document.getElementById('g-title');
        if (!title) return;
        title.textContent = cat.category_name;
        var searchState = document.getElementById('g-search-state');
        if (searchState) searchState.textContent = cat.category_name + ' · içerikler yükleniyor…';
        UI.spin(true);
        var id = cat.category_id === '__all' ? '' : cat.category_id;
        var p = kind === 'movie' ? Api.vodStreams(id) : Api.seriesList(id);
        p.then(function (items) {
          UI.spin(false);
          if (self.currentCat !== cat || self.searchQuery.length >= 3) return;
          self.indexCategoryItems(items, id);
          self.annotateCategoryItems(items, id);
          self.rawItems = items;
          self.applyItems();
          if (self.restoreRequested && String(cat.category_id) === String(self.savedCatId)) {
            self.grid.jumpTo(self.savedGridIndex);
            self.restoreRequested = false;
            Nav.focus('grid');
          } else if (focusGrid) {
            Nav.focus('grid');
          }
          var count = document.getElementById('g-count');
          if (count) count.textContent = items.length + ' baslik';
          if (searchState) searchState.textContent = self.searchScopeLabel();
        })['catch'](function (e) {
          UI.spin(false);
          self.grid.emptyText = 'İçerikler yüklenemedi. Kategoriyi yeniden açmayı deneyin.';
          self.grid.setItems([]);
          if (searchState) searchState.textContent = 'İçerikler yüklenemedi';
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
