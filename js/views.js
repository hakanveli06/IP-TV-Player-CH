/* views.js - ekranlar */
'use strict';

var Views = {};

/* ============================ ILK KURULUM DILI ============================ */

Views.languageSetup = function (opts) {
  opts = opts || {};
  var host = document.getElementById('screen');
  document.getElementById('rail').className = 'hidden';
  host.innerHTML = '<div class="screen language-screen"><div class="language-card">' +
    '<div class="brand">H&amp;M Player<b>.</b></div><div class="page-title">' + esc(t('language.title')) + '</div>' +
    '<div class="page-sub">' + esc(t('language.help')) + '</div><div class="language-list" id="language-list"></div>' +
    '<div class="language-hint">' + esc(t('language.autoHint')) + '</div></div></div>';
  var wrap = document.getElementById('language-list'), nodes = [];
  for (var i = 0; i < I18n.languages.length; i++) {
    var item = I18n.languages[i];
    var node = el('div', 'btn language-choice', esc(item.name));
    node.setAttribute('data-language', item.code); wrap.appendChild(node); nodes.push(node);
  }
  var current = Settings.get('uiLanguage') || 'auto', start = 0;
  for (i = 0; i < I18n.languages.length; i++) if (I18n.languages[i].code === current) start = i;
  var stack = new Stack({
    id: 'language', nodes: nodes,
    onSelect: function (node) {
      Settings.set('uiLanguage', node.getAttribute('data-language'));
      Settings.set('languageChosen', true); I18n.apply();
      if (opts.initial) Views.login({ add: true, initial: true, fromLanguage: true });
      else window.location.reload();
    }
  });
  stack.index = start;
  Nav.setScreen({ zones: { language: stack }, start: 'language', onBack: function () {
    if (opts.initial) App.confirmExit(); else App.go('settings');
  } });
};

/* =============================== GIRIS =============================== */

Views.login = function (opts) {
  opts = opts || {};
  var editing = !!opts.accountId;
  var host = document.getElementById('screen');
  var saved = editing ? (Accounts.byId(opts.accountId) || {}) : {};
  host.innerHTML =
    '<div class="screen"><div id="login-wrap"><div class="login">' +
    '<div class="brand">H&amp;M Player<b>.</b></div>' +
    '<div class="page-sub login-title">' + esc(t(editing ? 'login.editTitle' : 'login.addTitle')) + '</div>' +
    '<div class="hint">' + esc(t(editing ? 'login.editHint' : 'login.addHint')) + '</div>' +
    '<div class="field"><label>' + esc(t('login.profile')) + '</label>' +
    '<input id="f-name" type="text" autocomplete="off" placeholder="' + esc(t('login.profilePlaceholder')) + '" value="' + esc(saved.name || '') + '"></div>' +
    '<div class="field"><label>' + esc(t('login.server')) + '</label>' +
    '<input id="f-server" type="text" placeholder="' + esc(t('login.serverPlaceholder')) + '" value="' + esc(saved.server || '') + '"></div>' +
    '<div class="field"><label>' + esc(t('login.username')) + '</label>' +
    '<input id="f-user" type="text" value="' + esc(saved.username || '') + '"></div>' +
    '<div class="field"><label>' + esc(t('login.password')) + '</label>' +
    '<input id="f-pass" type="password" autocomplete="off" placeholder="' +
    (editing ? esc(t('login.keepPassword')) : '') + '" value=""></div>' +
    '<div class="btn password-toggle" id="f-show">' + uiIcon('eye') + '<span>' + esc(t('login.showPassword')) + '</span></div>' +
    '<div class="err" id="f-err"></div>' +
    '<div class="btnrow"><div class="btn primary" id="f-go">' +
    esc(t(editing ? 'login.update' : 'login.add')) + '</div></div>' +
    '</div></div></div>';

  document.getElementById('rail').className = 'hidden';

  var nodes = [
    document.getElementById('f-name'),
    document.getElementById('f-server'),
    document.getElementById('f-user'),
    document.getElementById('f-pass'),
    document.getElementById('f-show'),
    document.getElementById('f-go')
  ];

  function togglePassword() {
    var input = nodes[3], button = nodes[4];
    var visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.innerHTML = uiIcon(visible ? 'eye' : 'eyeoff') +
      '<span>' + esc(t(visible ? 'login.showPassword' : 'login.hidePassword')) + '</span>';
  }

  function submit() {
    var name = nodes[0].value, s = nodes[1].value, u = nodes[2].value, p = nodes[3].value;
    if (editing && !p) p = saved.password || '';
    var errEl = document.getElementById('f-err');
    if (!s || !u || !p) { errEl.textContent = t('login.required'); return; }
    errEl.textContent = '';
    UI.spin(true);
    Api.validateCredentials(s, u, p).then(function (info) {
      UI.spin(false);
      nodes[3].type = 'password';
      App.saveAccountForm({ name: name, server: s, username: u, password: p }, info, opts);
    })['catch'](function (e) {
      UI.spin(false);
      errEl.textContent = e.message || t('login.failed');
    });
  }

  document.getElementById('f-go').addEventListener('click', submit);
  document.getElementById('f-show').addEventListener('click', togglePassword);

  var stack = new Stack({
    id: 'form', nodes: nodes,
    onSelect: function (node, i) { if (i === 4) togglePassword(); else if (i === 5) submit(); }
  });

  Nav.setScreen({
    zones: { form: stack },
    start: 'form',
    onBack: function () {
      nodes[3].type = 'password';
      if (Accounts.list().length) {
        if (Api.info && !opts.standalone) App.go('accounts');
        else Views.accounts({ standalone: true });
      } else if (opts.initial && opts.fromLanguage) Views.languageSetup({ initial: true });
      else App.confirmExit();
    }
  });
};

/* =============================== HESAPLAR =============================== */

Views.accounts = function (opts) {
  opts = opts || {};
  var profiles = Accounts.list(), standalone = !!opts.standalone || !Api.info;
  var host = document.getElementById('screen');
  document.getElementById('rail').className = standalone ? 'hidden' : '';
  host.innerHTML =
    '<div class="screen account-screen"><div class="page-title">Hesaplar <span class="page-count">' +
    profiles.length + ' / ' + Accounts.max + '</span></div>' +
    (opts.error ? '<div class="account-error">' + esc(opts.error) + '</div>' : '') +
    '<div class="account-layout"><div class="account-list listbox" id="ac-list"></div>' +
    '<div class="account-side"><div class="info account-info" id="ac-info"></div>' +
    '<div class="account-actions" id="ac-actions">' +
    '<div class="btn primary" id="ac-switch">Hesaba gec</div>' +
    '<div class="btn" id="ac-test">Baglantiyi test et</div>' +
    '<div class="btn" id="ac-edit">Profili duzenle</div>' +
    '<div class="btn" id="ac-add">Hesap ekle</div>' +
    '<div class="btn danger" id="ac-remove">Profili kaldir</div>' +
    '</div></div></div></div>';

  var active = Accounts.active();
  for (var p = 0; p < profiles.length; p++) profiles[p].__key = profiles[p].id;
  var actionNodes = [
    document.getElementById('ac-switch'), document.getElementById('ac-test'),
    document.getElementById('ac-edit'), document.getElementById('ac-add'), document.getElementById('ac-remove')
  ];

  function statusText(profile) {
    var st = profile.status;
    if (!st || !st.checkedAt) return 'Henuz kontrol edilmedi';
    if (!st.ok) return 'Son kontrol basarisiz';
    var exp = st.expDate ? new Date(parseInt(st.expDate, 10) * 1000) : null;
    return (st.status || 'Active') + (exp && !isNaN(exp.getTime()) ? ' · Bitis ' + exp.toLocaleDateString('tr-TR') : '');
  }

  function showInfo(profile) {
    var box = document.getElementById('ac-info'); if (!box) return;
    if (!profile) {
      box.innerHTML = '<h2>Kayitli hesap yok</h2><div class="desc">Hesap ekleyerek baslayin.</div>';
      return;
    }
    var st = profile.status || {};
    var checked = st.checkedAt ? new Date(st.checkedAt).toLocaleString('tr-TR') : 'kontrol edilmedi';
    box.innerHTML = '<h2>' + esc(profile.name || profile.username) + '</h2>' +
      '<div class="line">' + esc(profile.username) + '</div>' +
      '<div class="desc">Sunucu: ' + esc(profile.server) + '<br>' +
      'Durum: ' + esc(statusText(profile)) + '<br>' +
      'Son kontrol: ' + esc(checked) + '<br>' +
      (st.ok ? 'Baglanti: ' + esc(st.activeCons || '0') + ' / ' + esc(st.maxConnections || '-') :
        (st.error ? 'Hata: ' + esc(st.error) : '')) + '</div>';
    actionNodes[0].innerHTML = active && active.id === profile.id ? 'Aktif hesap' : 'Hesaba gec';
    actionNodes[3].className = 'btn' + (profiles.length >= Accounts.max ? ' disabled' : '');
  }

  var list = new List({
    id: 'profiles', el: document.getElementById('ac-list'), rowH: 112,
    renderRow: function (profile) {
      var isActive = active && active.id === profile.id;
      return '<div class="account-avatar">' + uiIcon('account') + '</div><div class="body">' +
        '<div class="name">' + esc(profile.name || profile.username) + '</div>' +
        '<div class="meta">' + esc(profile.username) + ' · ' + esc(statusText(profile)) + '</div></div>' +
        (isActive ? '<div class="account-active">AKTIF</div>' : '');
    },
    neighbors: { left: standalone ? null : 'rail', right: 'actions' },
    onFocus: showInfo,
    onSelect: function (profile) { App.switchAccount(profile.id); }
  });
  list.emptyText = 'Kayitli hesap yok';
  list.setItems(profiles);

  var actions = new Stack({
    id: 'actions', nodes: actionNodes,
    neighbors: { left: 'profiles' },
    onSelect: function (node, index) {
      var profile = list.items[list.index];
      if (index === 3) {
        if (Accounts.list().length >= Accounts.max) { UI.toast('En fazla ' + Accounts.max + ' hesap eklenebilir.'); return; }
        Views.login({ add: true, standalone: standalone }); return;
      }
      if (!profile) return;
      if (index === 0) App.switchAccount(profile.id);
      else if (index === 1) App.testAccount(profile.id);
      else if (index === 2) Views.login({ accountId: profile.id, standalone: standalone });
      else if (index === 4) App.removeAccount(profile.id);
    }
  });
  if (!profiles.length) actions.index = 3;
  showInfo(profiles[0]);

  var zones = { profiles: list, actions: actions };
  if (!standalone) zones.rail = App.rail;
  Nav.setScreen({
    zones: zones, start: profiles.length ? 'profiles' : 'actions',
    onBack: function () { if (standalone) App.confirmExit(); else App.go('settings'); }
  });
};

/* =============================== CANLI TV =============================== */

Views.live = function () {
  var host = document.getElementById('screen');
  var livePreviewHelp = App.live.previewHelpHtml();
  host.innerHTML =
    '<div class="screen">' +
    '<div class="section-tools"><div class="section-search" id="lv-search-wrap">' +
    '<span class="search-ic">' + uiIcon('search') + '</span><input id="lv-search" type="text" autocomplete="off" ' +
    'placeholder="' + esc(t('live.search')) + '"></div>' +
    '<div class="search-state" id="lv-search-state"></div></div>' +
    '<div class="cols" style="height:calc(1080px - var(--overscan) - 110px)">' +
    '<div class="col col-cats"><div class="col-head"><span>' + esc(t('live.categories')) + '</span></div>' +
    '<div class="listbox" id="lv-cats"></div></div>' +
    '<div class="col col-list"><div class="col-head"><span id="lv-title">' + esc(t('live.channels')) + '</span>' +
    '<span id="lv-count"></span></div><div class="listbox" id="lv-chans"></div></div>' +
    '<div class="col col-info"><div class="col-head"><span>' + esc(t('live.epg')) + '</span></div>' +
    '<div class="info live-info-panel"><div id="lv-preview" class="live-preview-slot">' +
    '<span>' + livePreviewHelp + '</span></div><div id="lv-playing" class="preview-caption"></div>' +
    '<div id="lv-info"><div class="empty">' + esc(t('live.select')) + '</div></div></div></div>' +
    '</div></div>';

  var cats = new List({
    id: 'cats', el: document.getElementById('lv-cats'), rowH: 68,
    renderRow: function (c) {
      return '<div class="body"><div class="name">' + esc(c.category_name) + '</div></div>';
    },
    neighbors: { left: 'rail', right: 'chans', up: 'searchbox' },
    onFocus: function (c) { if (c) App.live.loadCategory(c); },
    onSelect: function () { Nav.focus('chans'); }
  });
  cats.emptyText = t('live.noCategory');

  var chans = new List({
    id: 'chans', el: document.getElementById('lv-chans'), rowH: 76,
    renderRow: function (c) {
      var fav = Favs.has('live', c.stream_id) ? '<div class="tag">*</div>' : '';
      var logo = c.stream_icon ? ' style="background-image:url(' + esc(c.stream_icon) + ')"' : '';
      return '<div class="num">' + esc(c.num || '') + '</div>' +
        '<div class="logo"' + logo + '></div>' +
        '<div class="body"><div class="name">' + esc(c.name) + '</div>' +
        '<div class="meta" data-epg="' + esc(c.stream_id) + '"></div></div>' + fav;
    },
    neighbors: { left: 'cats', up: 'searchbox' },
    onFocus: function (c) { App.live.showEpg(c); },
    onSelect: function (c, i) { App.live.open(i); },
    onAltSelect: function (c) {
      var on = Favs.toggle('live', c.stream_id);
      UI.toast(on ? t('favs.added') : t('favs.removed'));
      chans.draw();
    }
  });
  chans.emptyText = t('live.noChannel');
  chans.key = function (item) { return item && item.stream_id; };

  App.live.cats = cats;
  App.live.chans = chans;

  var searchInput = document.getElementById('lv-search');
  var searchWrap = document.getElementById('lv-search-wrap');
  searchInput.addEventListener('focus', function () { searchWrap.className = 'section-search focus'; });
  searchInput.addEventListener('blur', function () { searchWrap.className = 'section-search'; });
  searchInput.addEventListener('input', function () { App.live.search(searchInput.value); });
  searchInput.addEventListener('change', function () { App.live.search(searchInput.value); });
  var searchbox = new Stack({
    id: 'searchbox', nodes: [searchInput],
    neighbors: { left: 'rail', down: 'cats' }
  });
  App.live.searchInput = searchInput;
  App.live.resetSearch();

  Nav.setScreen({
    zones: { rail: App.rail, searchbox: searchbox, cats: cats, chans: chans },
    start: 'cats',
    onBack: function () { App.backToRailOrExit(); },
    onKey: function (e) {
      if (document.activeElement === searchInput) return false;
      if (e.keyCode === KEY.INFO) { Diag.toggle(); return true; }
      if (e.keyCode === KEY.RIGHT && Nav.zone === chans) {
        App.live.openDailyEpg(chans.items[chans.index]); return true;
      }
      if (e.keyCode >= KEY.N0 && e.keyCode <= KEY.N9) { App.live.numberJump(e.keyCode - KEY.N0); return true; }
      return false;
    }
  });

  App.live.init();
};

/* =============================== FILM / DIZI IZGARASI =============================== */

function gridScreen(kind, opts) {
  var host = document.getElementById('screen');
  var title = t(kind === 'movie' ? 'rail.movies' : 'rail.series');
  host.innerHTML =
    '<div class="screen">' +
    '<div class="section-tools"><div class="section-search" id="g-search-wrap">' +
    '<span class="search-ic">' + uiIcon('search') + '</span><input id="g-search" type="text" autocomplete="off" ' +
    'placeholder="' + esc(t(kind === 'movie' ? 'library.movieSearch' : 'library.seriesSearch')) + '"></div>' +
    '<div class="search-state" id="g-search-state"></div></div>' +
    '<div class="cols" style="height:calc(1080px - var(--overscan) - 110px)">' +
    '<div class="col col-cats"><div class="col-head"><span>' + esc(t('live.categories')) + '</span></div>' +
    '<div class="listbox" id="g-cats"></div></div>' +
    '<div class="col col-list"><div class="col-head"><span id="g-title">' + title + '</span>' +
    '<span id="g-count"></span></div><div class="listbox" id="g-grid" ' +
    'style="background:transparent;border:0"></div></div>' +
    '</div></div>';

  var state = App.vod[kind];

  var cats = new List({
    id: 'cats', el: document.getElementById('g-cats'), rowH: 68,
    renderRow: function (c) { return '<div class="body"><div class="name">' + esc(c.category_name) + '</div></div>'; },
    neighbors: { left: 'rail', right: 'grid', up: 'searchbox' },
    onFocus: function (c) { if (c) state.loadCategory(c); },
    onSelect: function () { Nav.focus('grid'); }
  });
  cats.emptyText = t('live.noCategory');

  var grid = new Grid({
    id: 'grid', el: document.getElementById('g-grid'), cols: 4, rowH: 404,
    renderCard: function (m) {
      var img = kind === 'movie' ? m.stream_icon : m.cover;
      var art = img ? ' style="background-image:url(' + esc(img) + ')"' : '';
      var ph = img ? '' : '<div class="ph">' + esc(m.name) + '</div>';
      var id = kind === 'movie' ? m.stream_id : m.series_id;
      var r = kind === 'movie' ? Resume.get('movie', id) : null;
      var bar = (r && r.dur) ? '<div class="bar"><i style="width:' +
        Math.round(r.pos / r.dur * 100) + '%"></i></div>' : '';
      var star = Favs.has(kind, id) ? ' *' : '';
      return '<div class="art"' + art + '>' + ph + bar + '</div>' +
        '<div class="cap">' + esc(m.name) + star + '</div>';
    },
    neighbors: { left: 'cats', up: 'searchbox' },
    onSelect: function (m) { App.detail.open(kind, m); },
    onAltSelect: function (m) {
      var id = kind === 'movie' ? m.stream_id : m.series_id;
      var on = Favs.toggle(kind, id);
      UI.toast(on ? t('favs.added') : t('favs.removed'));
      grid.draw();
    }
  });
  grid.emptyText = t('library.noContent');

  state.cats = cats;
  state.grid = grid;

  var searchInput = document.getElementById('g-search');
  var searchWrap = document.getElementById('g-search-wrap');
  searchInput.addEventListener('focus', function () { searchWrap.className = 'section-search focus'; });
  searchInput.addEventListener('blur', function () { searchWrap.className = 'section-search'; });
  searchInput.addEventListener('input', function () { state.search(searchInput.value); });
  searchInput.addEventListener('change', function () { state.search(searchInput.value); });
  var searchbox = new Stack({
    id: 'searchbox', nodes: [searchInput],
    neighbors: { left: 'rail', down: 'cats' }
  });
  state.searchInput = searchInput;
  state.beginView(opts && opts.restoreVod === kind);

  Nav.setScreen({
    zones: { rail: App.rail, searchbox: searchbox, cats: cats, grid: grid },
    start: 'cats',
    onBack: function () {
      if (state.searchQuery.length >= 3) { state.clearSearchResults(); return; }
      App.backToRailOrExit();
    }
  });

  state.init();
}

Views.movies = function (opts) { gridScreen('movie', opts); };
Views.series = function (opts) { gridScreen('series', opts); };

/* =============================== FAVORILER =============================== */

Views.favs = function () {
  var host = document.getElementById('screen');
  host.innerHTML =
    '<div class="screen">' +
    '<div class="page-title">' + esc(t('rail.favs')) + '</div>' +
    '<div class="cols" style="height:calc(1080px - 40px - 90px)">' +
    '<div class="col col-list"><div class="listbox" id="fv-list"></div></div>' +
    '<div class="col col-info"><div class="info" id="fv-info"><div class="empty">Oge secin</div></div></div>' +
    '</div></div>';

  var list = new List({
    id: 'list', el: document.getElementById('fv-list'), rowH: 76,
    renderRow: function (it) {
      var kindTx = { live: 'Kanal', movie: 'Film', series: 'Dizi' }[it.kind];
      var logo = it.icon ? ' style="background-image:url(' + esc(it.icon) + ')"' : '';
      return '<div class="logo"' + logo + '></div><div class="body">' +
        '<div class="name">' + esc(it.name) + '</div>' +
        '<div class="meta">' + kindTx + '</div></div>';
    },
    neighbors: { left: 'rail' },
    onSelect: function (it) { App.favs.open(it); },
    onAltSelect: function (it) {
      Favs.toggle(it.kind, it.id);
      UI.toast(t('favs.removed'));
      App.favs.load();
    }
  });
  list.emptyText = t('favs.empty');

  App.favs.list = list;

  Nav.setScreen({
    zones: { rail: App.rail, list: list },
    start: 'list',
    onBack: function () { App.backToRailOrExit(); }
  });

  App.favs.load();
};

/* =============================== SON IZLEDIKLERIM =============================== */

Views.recent = function () {
  var host = document.getElementById('screen');
  host.innerHTML =
    '<div class="screen">' +
    '<div style="display:flex;align-items:center;justify-content:space-between">' +
    '<div class="page-title">' + esc(t('rail.recent')) + ' <span class="page-count" id="rc-count"></span></div>' +
    '<div class="btn" id="rc-clear">' + esc(t('recent.clear')) + '</div></div>' +
    '<div class="cols" style="height:calc(1080px - 40px - 100px)">' +
    '<div class="col col-list"><div class="col-head"><span>' + esc(t('recent.newest')) + '</span>' +
    '<span>' + esc(t('recent.removeHint')) + '</span></div><div class="listbox" id="rc-list"></div></div>' +
    '<div class="col col-info"><div class="col-head"><span>' + esc(t('recent.content')) + '</span></div>' +
    '<div class="info" id="rc-info"><div class="empty">' + esc(t('recent.content')) + '</div></div></div>' +
    '</div></div>';

  var clearNode = document.getElementById('rc-clear');
  var bar = new Stack({
    id: 'bar', nodes: [clearNode],
    neighbors: { left: 'rail', down: 'list' },
    onSelect: function () { App.recent.clear(); }
  });

  var list = new List({
    id: 'list', el: document.getElementById('rc-list'), rowH: 82,
    renderRow: function (it) {
      var logo = it.icon ? ' style="background-image:url(' + esc(it.icon) + ')"' : '';
      var kind = it.kind === 'movie' ? 'Film' : 'Dizi';
      var extra = it.episodeTitle ? ' · ' + it.episodeTitle : '';
      return '<div class="logo"' + logo + '></div><div class="body">' +
        '<div class="name">' + esc(it.name) + '</div>' +
        '<div class="meta">' + kind + esc(extra) + '</div></div>' +
        '<div class="tag">×</div>';
    },
    neighbors: { left: 'rail', up: 'bar' },
    onFocus: function (it) { App.recent.showInfo(it); },
    onSelect: function (it) { App.recent.open(it); },
    onAltSelect: function (it) { App.recent.remove(it); }
  });
  list.emptyText = t('recent.empty');

  App.recent.list = list;
  App.recent.bar = bar;
  Nav.setScreen({
    zones: { rail: App.rail, bar: bar, list: list },
    start: 'list',
    onBack: function () { App.backToRailOrExit(); }
  });
  App.recent.load();
};

/* =============================== ARAMA =============================== */

Views.search = function () {
  var host = document.getElementById('screen');
  host.innerHTML =
    '<div class="screen">' +
    '<div class="page-title">Ara</div>' +
    '<div style="display:flex;align-items:flex-end;margin-bottom:22px">' +
    '<div class="field" style="width:660px;margin:0 20px 0 0">' +
    '<input id="s-q" type="text" placeholder="Kanal, film veya dizi adi"></div>' +
    '<div class="btn" id="s-scope">Kapsam: Canli</div>' +
    '<div class="btn primary" id="s-go">Ara</div>' +
    '</div>' +
    '<div class="cols" style="height:calc(1080px - 40px - 190px)">' +
    '<div class="col col-list"><div class="listbox" id="s-list"></div></div>' +
    '</div></div>';

  var nodes = [
    document.getElementById('s-q'),
    document.getElementById('s-scope'),
    document.getElementById('s-go')
  ];

  var bar = new Stack({
    id: 'bar', nodes: nodes, horizontal: true,
    onSelect: function (n, i) {
      if (i === 1) App.search.cycleScope();
      else if (i === 2) App.search.run(nodes[0].value);
    },
    neighbors: { left: 'rail', down: 'list' }
  });

  var list = new List({
    id: 'list', el: document.getElementById('s-list'), rowH: 76,
    renderRow: function (it) {
      var logo = it.icon ? ' style="background-image:url(' + esc(it.icon) + ')"' : '';
      return '<div class="logo"' + logo + '></div><div class="body">' +
        '<div class="name">' + esc(it.name) + '</div>' +
        '<div class="meta">' + esc(it.sub || '') + '</div></div>';
    },
    neighbors: { left: 'rail', up: 'bar' },
    onSelect: function (it) { App.search.open(it); }
  });
  list.emptyText = 'Arama yapmak icin yukaridaki kutuyu kullanin.';

  App.search.list = list;
  App.search.bar = bar;
  App.search.input = nodes[0];
  App.search.scopeBtn = nodes[1];
  App.search.paint();

  Nav.setScreen({
    zones: { rail: App.rail, bar: bar, list: list },
    start: 'bar',
    onBack: function () { App.backToRailOrExit(); }
  });
};

/* =============================== AYARLAR =============================== */

Views.settings = function () {
  var host = document.getElementById('screen');
  host.innerHTML =
    '<div class="screen settings-screen">' +
    '<div class="page-title">' + esc(t('settings.title')) + '</div>' +
    '<div class="settings-layout"><div class="settings-list"><div class="btnrow" id="st-btns"></div></div>' +
    '<div class="settings-help info" id="st-help"></div>' +
    '</div></div>';

  var wrap = document.getElementById('st-btns');
  var defs = App.settings.defs();
  var nodes = [];
  for (var i = 0; i < defs.length; i++) {
    var b = el('div', 'btn', esc(defs[i].label()));
    wrap.appendChild(b);
    nodes.push(b);
  }

  function showHelp(index) {
    var def = defs[index] || defs[0], box = document.getElementById('st-help');
    if (!def || !box) return;
    box.innerHTML = '<div class="settings-help-kicker">' + esc(t('settings.what')) + '</div><h2>' +
      esc(def.title || def.label()) + '</h2><div class="settings-help-copy">' +
      esc(def.help || t('settings.selectHelp')) + '</div>' +
      (def.recommended ? '<div class="settings-recommended"><b>' + esc(t('common.recommended')) + '</b><br>' + esc(def.recommended) + '</div>' : '') +
      '<div class="settings-help-footer">' + esc(t('settings.footer')) + '</div>';
  }

  var stack = new Stack({
    id: 'list', nodes: nodes,
    neighbors: { left: 'rail' },
    onFocus: function (node, i) { showHelp(i); },
    onSelect: function (node, i) {
      if (defs[i].run() === false) return;
      for (var j = 0; j < defs.length; j++) nodes[j].innerHTML = esc(defs[j].label());
      showHelp(i);
    }
  });

  Nav.setScreen({
    zones: { rail: App.rail, list: stack },
    start: 'list',
    onBack: function () { App.backToRailOrExit(); }
  });
  showHelp(0);
};

Views.languageSettings = function () { Views.languageSetup({ initial: false }); };

Views.regionSettings = function () {
  var host = document.getElementById('screen');
  host.innerHTML = '<div class="screen region-screen"><div class="page-title">' + esc(t('tmdb.regionTitle')) + '</div>' +
    '<div class="page-sub">' + esc(t('tmdb.regionHelp')) + '</div><div class="region-layout">' +
    '<div class="region-list" id="region-list"></div><div class="info region-help">' +
    '<h2>' + esc(t('tmdb.region')) + '</h2><div class="settings-help-copy">' + esc(t('tmdb.regionAutoHint')) +
    '</div></div></div></div>';
  var wrap = document.getElementById('region-list'), nodes = [];
  for (var i = 0; i < I18n.regions.length; i++) {
    var row = I18n.regions[i], node = el('div', 'btn', esc(I18n.regionName(row.code)));
    node.setAttribute('data-region', row.code); wrap.appendChild(node); nodes.push(node);
  }
  var selected = Settings.get('contentRegion') || 'auto', start = 0;
  for (i = 0; i < I18n.regions.length; i++) if (I18n.regions[i].code === selected) start = i;
  var stack = new Stack({ id: 'list', nodes: nodes, neighbors: { left: 'rail' }, onSelect: function (node) {
    Settings.set('contentRegion', node.getAttribute('data-region'));
    Tmdb.clearLocaleCache(); UI.toast(t('tmdb.regionSaved')); Views.tmdbSettings();
  } });
  stack.index = start;
  Nav.setScreen({ zones: { rail: App.rail, list: stack }, start: 'list', onBack: function () { Views.tmdbSettings(); } });
};

/* =========================== TMDB YAPILANDIRMASI =========================== */

Views.tmdbSettings = function () {
  var host = document.getElementById('screen');
  var saved = Tmdb.userCredential();
  var family = !!Tmdb.embeddedToken();
  var chosenRegion = Settings.get('contentRegion') || 'auto';
  host.innerHTML = '<div class="screen tmdb-settings-screen"><div class="page-title">' + esc(t('tmdb.title')) + '</div>' +
    '<div class="tmdb-settings-layout"><div class="tmdb-settings-form">' +
    '<div class="tmdb-settings-status ' + (Tmdb.configured() ? 'ready' : '') + '" id="tmdb-setting-status">' +
    esc(Tmdb.sourceLabel()) + '</div>' +
    '<div class="field"><label>' + esc(t('tmdb.credential')) + '</label>' +
    '<input id="tmdb-key" type="password" autocomplete="off" value="' + esc(saved) + '" ' +
    'placeholder="' + esc(t('tmdb.placeholder')) + '"></div>' +
    '<div class="btn password-toggle" id="tmdb-show">' + uiIcon('eye') + '<span>' + esc(t('tmdb.showKey')) + '</span></div>' +
    '<div class="btn tmdb-region-button" id="tmdb-region">' + esc(t('tmdb.region')) + ': <b>' +
    esc(I18n.regionName(chosenRegion)) + '</b></div>' +
    '<div class="err" id="tmdb-error"></div><div class="tmdb-settings-actions">' +
    '<div class="btn primary" id="tmdb-save">' + esc(t('common.saveTest')) + '</div>' +
    '<div class="btn" id="tmdb-clear">' + esc(t('tmdb.clear')) + '</div>' +
    '<div class="btn" id="tmdb-back">' + esc(t('tmdb.backSettings')) + '</div></div></div>' +
    '<div class="info tmdb-settings-help"><h2>' + esc(t('tmdb.why')) + '</h2>' +
    '<div class="tmdb-settings-copy tmdb-benefits">' + esc(t('tmdb.benefits')) + '<br><br>' + esc(t('tmdb.optional')) + '</div>' +
    '<h2 class="tmdb-how-title">' + esc(t('tmdb.how')) + '</h2><div class="tmdb-settings-copy">' +
    esc(t('tmdb.steps')) + '<br><br>' +
    '<span class="tmdb-settings-url">www.themoviedb.org/settings/api</span><br><br>' +
    esc(t('tmdb.private')) + '</div>' +
    (family ? '<div class="settings-recommended"><b>' + esc(t('tmdb.family')) + '</b><br>' + esc(t('tmdb.familyReady')) + '</div>' :
      '<div class="settings-recommended"><b>' + esc(t('tmdb.public')) + '</b><br>' + esc(t('tmdb.publicInfo')) + '</div>') +
    '</div></div></div>';

  var input = document.getElementById('tmdb-key');
  var show = document.getElementById('tmdb-show');
  var region = document.getElementById('tmdb-region');
  var save = document.getElementById('tmdb-save');
  var clear = document.getElementById('tmdb-clear');
  var back = document.getElementById('tmdb-back');
  var error = document.getElementById('tmdb-error');
  var status = document.getElementById('tmdb-setting-status');
  var busy = false;

  function paintStatus(message, ok) {
    status.className = 'tmdb-settings-status' + (ok ? ' ready' : '');
    status.textContent = message;
  }
  function toggle() {
    var visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    show.innerHTML = uiIcon(visible ? 'eye' : 'eyeoff') +
      '<span>' + esc(t(visible ? 'tmdb.showKey' : 'tmdb.hideKey')) + '</span>';
  }
  function saveAndTest() {
    if (busy) return;
    var value = Tmdb.normalizeCredential(input.value);
    error.textContent = '';
    if (!value) { error.textContent = t('tmdb.enterFirst'); return; }
    busy = true; UI.spin(true); paintStatus(t('tmdb.testing'), false);
    Tmdb.testCredential(value).then(function () {
      busy = false; UI.spin(false); Settings.set('tmdbCredential', value);
      paintStatus(t('tmdb.success'), true);
      input.type = 'password'; show.innerHTML = uiIcon('eye') + '<span>' + esc(t('tmdb.showKey')) + '</span>';
      UI.toast(t('tmdb.saved'));
    })['catch'](function (e) {
      busy = false; UI.spin(false); paintStatus(Tmdb.sourceLabel(), Tmdb.configured());
      error.textContent = e.message || t('tmdb.failed');
    });
  }
  function clearPersonal() {
    if (busy) return;
    Settings.set('tmdbCredential', ''); input.value = ''; input.type = 'password';
    show.innerHTML = uiIcon('eye') + '<span>' + esc(t('tmdb.showKey')) + '</span>';
    error.textContent = ''; paintStatus(Tmdb.sourceLabel(), Tmdb.configured());
    UI.toast(family ? t('tmdb.familyFallback') : t('tmdb.cleared'));
  }
  function goBack() { input.type = 'password'; App.go('settings'); }

  show.addEventListener('click', toggle);
  region.addEventListener('click', function () { Views.regionSettings(); });
  save.addEventListener('click', saveAndTest);
  clear.addEventListener('click', clearPersonal);
  back.addEventListener('click', goBack);
  var nodes = [input, show, region, save, clear, back];
  var stack = new Stack({
    id: 'list', nodes: nodes, neighbors: { left: 'rail' },
    onSelect: function (node, index) {
      if (index === 1) toggle(); else if (index === 2) Views.regionSettings();
      else if (index === 3) saveAndTest(); else if (index === 4) clearPersonal(); else if (index === 5) goBack();
    }
  });
  Nav.setScreen({ zones: { rail: App.rail, list: stack }, start: 'list', onBack: goBack });
};

/* ===================== KATEGORI GOSTER / GIZLE ===================== */

Views.categoryVisibility = function (kind) {
  var names = { live: 'Canlı TV', movie: 'Film', series: 'Dizi' };
  var host = document.getElementById('screen');
  host.innerHTML = '<div class="screen category-settings"><div class="page-title">' + names[kind] +
    ' kategorileri</div><div class="category-settings-top"><div class="btn" id="cv-all">Tümünü göster</div>' +
    '<div class="page-sub">OK ile göster/gizle · Değişiklikler otomatik kaydedilir</div></div>' +
    '<div class="category-settings-list listbox" id="cv-list"></div></div>';

  var list = new List({
    id: 'list', el: document.getElementById('cv-list'), rowH: 72,
    renderRow: function (item) {
      var hidden = CategoryVisibility.hidden(kind, item.category_id);
      return '<div class="visibility-mark">' + (hidden ? '○' : '●') + '</div><div class="body"><div class="name">' +
        esc(item.category_name) + '</div></div><div class="visibility-state">' + (hidden ? 'Gizli' : 'Gösteriliyor') + '</div>';
    },
    neighbors: { left: 'rail', up: 'bar' },
    onSelect: function (item) {
      var visible = CategoryVisibility.toggle(kind, item.category_id);
      UI.toast(visible ? 'Kategori gösterilecek' : 'Kategori gizlendi');
      list.draw();
    }
  });
  list.emptyText = 'Kategori bulunamadı';
  var allButton = document.getElementById('cv-all');
  var bar = new Stack({
    id: 'bar', nodes: [allButton], neighbors: { left: 'rail', down: 'list' },
    onSelect: function () { CategoryVisibility.showAll(kind); list.draw(); UI.toast('Tüm kategoriler gösterilecek'); }
  });
  Nav.setScreen({
    zones: { rail: App.rail, bar: bar, list: list }, start: 'list',
    onBack: function () { App.go('settings'); }
  });
  UI.spin(true);
  var request = kind === 'live' ? Api.liveCategories() : (kind === 'movie' ? Api.vodCategories() : Api.seriesCategories());
  request.then(function (items) { UI.spin(false); list.setItems(items); })['catch'](function (e) {
    UI.spin(false); UI.toast(e.message || 'Kategoriler alınamadı', 4000);
  });
};

/* ======================== FAVORI KANAL SIRASI ======================== */

Views.favoriteOrder = function () {
  var host = document.getElementById('screen');
  host.innerHTML = '<div class="screen favorite-order"><div class="page-title">Favori kanalları sırala</div>' +
    '<div class="page-sub favorite-order-help" id="fo-help">OK ile kanalı tutun, Yukarı/Aşağı ile taşıyın, tekrar OK ile bırakın.</div>' +
    '<div class="favorite-order-list listbox" id="fo-list"></div></div>';
  var moving = false;
  var list = new List({
    id: 'list', el: document.getElementById('fo-list'), rowH: 76,
    renderRow: function (item, index) {
      var logo = item.stream_icon ? ' style="background-image:url(' + esc(item.stream_icon) + ')"' : '';
      return '<div class="favorite-order-num">' + (index + 1) + '</div><div class="logo"' + logo + '></div>' +
        '<div class="body"><div class="name">' + esc(item.name) + '</div></div>' +
        (moving && index === list.index ? '<div class="favorite-moving">Taşınıyor</div>' : '');
    },
    neighbors: { left: 'rail' },
    onSelect: function () {
      moving = !moving;
      document.getElementById('fo-help').textContent = moving
        ? 'Kanal tutuldu. Yukarı/Aşağı ile taşıyın; OK ile bırakın.'
        : 'Sıra kaydedildi. Başka bir kanalı taşımak için OK tuşuna basın.';
      list.draw();
    }
  });
  list.emptyText = 'Sıralanacak favori kanal yok';
  Nav.setScreen({
    zones: { rail: App.rail, list: list }, start: 'list',
    onKey: function (e) {
      if (!moving || (e.keyCode !== KEY.UP && e.keyCode !== KEY.DOWN)) return false;
      var from = list.index, to = from + (e.keyCode === KEY.UP ? -1 : 1);
      if (to < 0 || to >= list.items.length) return true;
      var item = list.items.splice(from, 1)[0]; list.items.splice(to, 0, item);
      Favs.setLiveOrder(list.items.map(function (channel) { return channel.stream_id; }));
      list.index = to; list.ensure(); list.draw();
      return true;
    },
    onBack: function () {
      if (moving) { moving = false; list.draw(); UI.toast('Favori sırası kaydedildi'); }
      else App.go('settings');
    }
  });
  UI.spin(true);
  Api.liveStreams('').then(function (all) {
    UI.spin(false);
    var byId = {}, ids = Favs.list('live'), ordered = [];
    for (var i = 0; i < all.length; i++) byId[String(all[i].stream_id)] = all[i];
    for (var n = 0; n < ids.length; n++) if (byId[ids[n]]) ordered.push(byId[ids[n]]);
    if (ordered.length !== ids.length) Favs.setLiveOrder(ordered.map(function (channel) { return channel.stream_id; }));
    list.setItems(ordered);
  })['catch'](function (e) { UI.spin(false); UI.toast(e.message || 'Favoriler alınamadı', 4000); });
};

/* ============================ KUMANDA REHBERI ============================ */

Views.remoteGuide = function () {
  var host = document.getElementById('screen');
  var sections = [
    { title: 'Canlı TV listesi', body: 'OK: Kanalı sağdaki küçük pencerede ön izle; oynayan kanalda tekrar OK: Tam ekran.<br>Sağ: Seçili kanalın bugünkü yayın akışı.<br>Sarı: Favoriye ekle veya çıkar.<br>Kanal tuşları: Listede sayfa atla.' },
    { title: 'Canlı TV tam ekran', body: 'Kanal tuşları: Önceki/sonraki kanal.<br>Sol: Son iki kanal arasında geçiş.<br>Sağ: Son izlenen sekiz kanal.<br>Yukarı: Kanal ve temel teknik bilgi kartı.<br>Aşağı: Bugünkü yayın akışı.<br>OK veya Geri: Ön izlemeli kanal ekranına dön.<br>INFO: Ayrıntılı teknik bilgi ve teşhis.' },
    { title: 'Film ve dizi', body: 'OK veya Oynat/Duraklat: Oynatmayı duraklat veya sürdür.<br>Sol/Sağ: 10 saniye geri / 30 saniye ileri.<br>Yukarı: Ses/altyazı, yazı boyutu, görüntü biçimi ve motor menüsü.<br>Motor seçimi yalnızca açık içeriği AVPlay/HTML5 arasında değiştirir.<br>Aşağı: İçerik bilgisi.<br>Geri: Önce menüyü kapatır, sonra içeriğe döner.' },
    { title: 'Ses ve altyazı', body: 'Film veya dizi oynarken Yukarı ile menüyü açın.<br>Ses ya da Altyazı alanına yön tuşlarıyla gidip OK ile seçin.<br>Bozuk TX3G kaynağında uygulama altyazıyı güvenli biçimde hazırlayabilir.' },
    { title: 'Genel kullanım', body: 'Geri: Bir önceki ekrana döner.<br>Ana ekranda Geri: Uygulamadan çıkış onayı.<br>INFO: Oynatma ve bağlantı bilgileri.<br>Ev tuşu: Samsung ana ekranı.' }
  ];
  host.innerHTML = '<div class="screen remote-guide"><div class="page-title">Kumanda kullanım rehberi</div>' +
    '<div class="remote-guide-layout"><div class="remote-guide-menu" id="rg-menu"></div>' +
    '<div class="info remote-guide-info" id="rg-info"></div></div></div>';
  var wrap = document.getElementById('rg-menu'), nodes = [];
  function paint(index) {
    var item = sections[index];
    document.getElementById('rg-info').innerHTML = '<h2>' + esc(item.title) + '</h2><div class="remote-guide-copy">' + item.body + '</div>';
  }
  for (var i = 0; i < sections.length; i++) {
    var node = el('div', 'btn', esc(sections[i].title)); wrap.appendChild(node); nodes.push(node);
  }
  var stack = new Stack({ id: 'list', nodes: nodes, neighbors: { left: 'rail' }, onFocus: function (node, i) { paint(i); }, onSelect: function (node, i) { paint(i); } });
  Nav.setScreen({ zones: { rail: App.rail, list: stack }, start: 'list', onBack: function () { App.go('settings'); } });
  paint(0);
};

/* =============================== HAKKINDA =============================== */

Views.about = function () {
  var host = document.getElementById('screen');
  host.innerHTML =
    '<div class="screen about-screen">' +
    '<div class="page-title">' + esc(t('about.title')) + '</div>' +
    '<div class="about-card">' +
    '<img class="about-logo" src="./icon.png" alt="H&amp;M IP TV">' +
    '<div class="about-copy"><div class="about-brand">H&amp;M</div>' +
    '<div class="about-product">H&amp;M Player</div>' +
    '<div class="about-credit">' + esc(t('about.credit')) + '</div>' +
    '<div class="about-mail">hakanveli@gmail.com</div>' +
    '<div class="about-version">' + esc(App.versionLabel) + '</div>' +
    '<div class="tmdb-attribution"><img class="tmdb-wordmark" src="./assets/tmdb-logo.svg" alt="TMDB">' +
    '<span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span></div>' +
    '<div class="btn" id="about-back">' + esc(t('about.menu')) + '</div></div></div></div>';

  var actions = new Stack({
    id: 'btns', nodes: [document.getElementById('about-back')],
    neighbors: { left: 'rail' },
    onSelect: function () { Nav.focus('rail'); }
  });
  Nav.setScreen({
    zones: { rail: App.rail, btns: actions },
    start: 'btns',
    onBack: function () { App.backToRailOrExit(); }
  });
};

/* =============================== DETAY (film / dizi) =============================== */

Views.detail = function (kind, item, info) {
  var host = document.getElementById('screen');
  var isMovie = kind === 'movie';
  var id = isMovie ? item.stream_id : item.series_id;
  var meta = (info && (info.info || info)) || {};
  var img = (isMovie ? item.stream_icon : item.cover) || meta.cover_big || meta.movie_image || '';
  var plot = meta.plot || meta.description || '';
  var line = [];
  if (meta.releasedate || meta.releaseDate) line.push(String(meta.releasedate || meta.releaseDate).slice(0, 4));
  if (meta.genre) line.push(meta.genre);
  if (meta.rating) line.push(t('detail.rating') + ' ' + meta.rating);
  if (isMovie && meta.duration) line.push(meta.duration);

  host.innerHTML =
    '<div class="screen"><div style="display:flex;height:calc(1080px - 40px)">' +
    '<div style="width:340px;flex:0 0 340px;margin-right:40px">' +
    '<div class="poster" style="width:340px;height:500px;border-radius:10px;background:' +
    (img ? 'url(' + esc(img) + ') center/cover no-repeat' : 'var(--panel-2)') + '"></div></div>' +
    '<div style="flex:1;min-width:0;display:flex;flex-direction:column">' +
    '<div class="page-title" style="margin-bottom:8px">' + esc(item.name) + '</div>' +
    '<div class="page-sub" style="margin-bottom:18px">' + esc(line.join('  ·  ')) + '</div>' +
    '<div class="desc" style="font-size:20px;color:#C3D0DA;max-height:190px;overflow:hidden;margin-bottom:24px">' +
    esc(plot) + '</div>' +
    '<div class="btnrow" id="d-btns"></div>' +
    '<div id="d-body" style="flex:1;min-height:0;display:flex;margin-top:14px"></div>' +
    '</div></div></div>';

  var btnWrap = document.getElementById('d-btns');
  var actions = [];

  if (isMovie) {
    var r = Resume.get('movie', id);
    if (r) actions.push({ label: t('detail.resume') + ' (' + mmss(r.pos) + ')', run: function () { App.detail.playMovie(item, info, r.pos); } });
    actions.push({ label: r ? t('detail.restart') : t('detail.play'), run: function () { App.detail.playMovie(item, info, 0); } });
  }
  actions.push({
    label: t('detail.ratings'),
    run: function () { App.tmdb.show(kind, item, info); }
  });
  actions.push({
    label: Favs.has(kind, id) ? t('detail.removeFav') : t('detail.addFav'),
    run: function () {
      var on = Favs.toggle(kind, id);
      UI.toast(on ? t('favs.added') : t('favs.removed'));
      btns.nodes[btns.index].innerHTML = on ? t('detail.removeFav') : t('detail.addFav');
    }
  });
  actions.push({ label: t('common.back'), run: function () { App.back(); } });

  var nodes = [];
  for (var i = 0; i < actions.length; i++) {
    var b = el('div', 'btn' + (i === 0 ? ' primary' : ''), esc(actions[i].label));
    btnWrap.appendChild(b);
    nodes.push(b);
  }

  var zones = {};
  var btns = new Stack({
    id: 'btns', nodes: nodes, horizontal: true,
    onSelect: function (n, i) { actions[i].run(); }
  });
  zones.btns = btns;

  if (!isMovie) {
    /* dizi: sezonlar + bolumler */
    var body = document.getElementById('d-body');
    body.innerHTML =
      '<div class="col" style="width:260px;flex:0 0 260px;margin-right:24px">' +
      '<div class="col-head">' + esc(t('detail.season')) + '</div><div class="listbox" id="d-seasons"></div></div>' +
      '<div class="col" style="flex:1"><div class="col-head">' + esc(t('detail.episodes')) + '</div>' +
      '<div class="listbox" id="d-eps"></div></div>';

    var episodes = (info && info.episodes) || {};
    var seasonKeys = Object.keys(episodes).sort(function (a, b) { return (+a) - (+b); });
    var seasons = seasonKeys.map(function (k) {
      return { id: k, name: 'Sezon ' + k, count: Api.asArray(episodes[k]).length };
    });

    var eps = new List({
      id: 'eps', el: document.getElementById('d-eps'), rowH: 76,
      renderRow: function (ep) {
        var r = Resume.get('ep', ep.id);
        var prog = (r && r.dur) ? '<div class="prog"><i style="width:' +
          Math.round(r.pos / r.dur * 100) + '%"></i></div>' : '';
        return '<div class="num">' + esc(ep.episode_num || '') + '</div>' +
          '<div class="body"><div class="name">' + esc(ep.title || ('Bolum ' + ep.episode_num)) + '</div>' +
          prog + '</div>';
      },
      neighbors: { left: 'seasons', up: 'btns' },
      onSelect: function (ep) { App.detail.playEpisode(item, ep); }
    });
    eps.emptyText = 'Bolum yok';

    var seasonsList = new List({
      id: 'seasons', el: document.getElementById('d-seasons'), rowH: 68,
      renderRow: function (s) {
        return '<div class="body"><div class="name">' + esc(s.name) + '</div>' +
          '<div class="meta">' + s.count + ' bolum</div></div>';
      },
      neighbors: { left: 'rail', right: 'eps', up: 'btns' },
      onFocus: function (s) {
        if (!s) return;
        eps.setItems(Api.asArray(episodes[s.id]));
      },
      onSelect: function () { Nav.focus('eps'); }
    });
    seasonsList.emptyText = 'Sezon yok';

    zones.seasons = seasonsList;
    zones.eps = eps;
    btns.neighbors = { down: 'seasons', left: 'rail' };
    seasonsList.setItems(seasons);
  } else {
    btns.neighbors = { left: 'rail' };
  }

  zones.rail = App.rail;

  Nav.setScreen({
    zones: zones,
    start: 'btns',
    onBack: function () { App.back(); }
  });
};
