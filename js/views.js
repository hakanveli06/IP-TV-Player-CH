/* views.js - ekranlar */
'use strict';

var Views = {};

/* Arkadas uygulamasinda Tizen 6'da calistigi cihazda dogrulanan yontem:
   tek bir uzak adresi dogrudan backgroundImage olarak ata. Cok katmanli
   background-image ayni TV motorunda tum bildirimi gecersiz kilabiliyor. */
function viewImageUrl(value, size) {
  var url = String(value || '').trim();
  if (!url) return '';
  if (url.charAt(0) === '/') url = 'https://image.tmdb.org/t/p/' + (size || 'w1280') + url;
  if (/image\.tmdb\.org\/t\/p\/(?:original|w\d+)/i.test(url)) {
    url = url.replace(/image\.tmdb\.org\/t\/p\/(?:original|w\d+)/i,
      'image.tmdb.org/t/p/' + (size || 'w1280'));
  }
  return url;
}

function viewImageCandidates(values, size) {
  var out = [], seen = {};
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (Object.prototype.toString.call(value) === '[object Array]') {
      var nested = viewImageCandidates(value, size);
      for (var ni = 0; ni < nested.length; ni++) if (!seen[nested[ni]]) { seen[nested[ni]] = true; out.push(nested[ni]); }
      continue;
    }
    if (typeof value === 'string' && /^\s*\[/.test(value)) {
      try {
        var parsed = JSON.parse(value), parsedList = viewImageCandidates(parsed, size);
        for (var pi = 0; pi < parsedList.length; pi++) if (!seen[parsedList[pi]]) { seen[parsedList[pi]] = true; out.push(parsedList[pi]); }
        continue;
      } catch (e) { }
    }
    var url = viewImageUrl(value, size);
    if (url && !seen[url]) { seen[url] = true; out.push(url); }
  }
  return out;
}

function applyBackdropCandidates(node, values) {
  if (!node) return;
  var candidates = viewImageCandidates(values, 'w1280');
  var requestId = (node.__imageRequest || 0) + 1;
  node.__imageRequest = requestId;
  node.className = node.className.replace(/\s*\b(?:loaded|fallback)\b/g, '');
  node.style.backgroundImage = '';
  node.innerHTML = '';
  if (!candidates.length) { node.className += ' fallback'; return; }
  function tryCandidate(index) {
    if (requestId !== node.__imageRequest) return;
    if (index >= candidates.length) { node.className += ' fallback'; return; }
    var image = document.createElement('img');
    image.className = 'detail-backdrop-image';
    image.alt = '';
    image.onload = function () {
      if (requestId !== node.__imageRequest) return;
      node.className = node.className.replace(/\s*\bfallback\b/g, '') + ' loaded';
    };
    image.onerror = function () {
      if (requestId !== node.__imageRequest) return;
      if (image.parentNode === node) node.removeChild(image);
      tryCandidate(index + 1);
    };
    image.src = candidates[index];
    node.appendChild(image);
  }
  tryCandidate(0);
}

function providerSeasonMap(info) {
  /* Xtream'in standart ve arkadas uygulamasinda calisan yolu daima once gelir.
     Bolum kaydinin alanlari saglayiciya gore degistigi icin bu koleksiyonu
     episodeLike ile elemek gercek bolumleri kaybettirebilir. */
  var raw = info && info.episodes != null ? info.episodes :
    (info && info.info && info.info.episodes != null ? info.info.episodes :
      ((typeof Api !== 'undefined' && Api.findEpisodes) ? Api.findEpisodes(info) : {}));
  raw = raw || {};
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { raw = {}; }
  }
  var out = {};
  function add(season, ep) {
    if (!ep || typeof ep !== 'object') return;
    season = String(season == null || season === '' ? 1 : season);
    if (!out[season]) out[season] = [];
    out[season].push(ep);
  }
  if (Object.prototype.toString.call(raw) === '[object Array]') {
    for (var i = 0; i < raw.length; i++) {
      var row = raw[i] || {}, rowInfo = row.info && typeof row.info === 'object' ? row.info : {};
      add(row.season || row.season_num || rowInfo.season || rowInfo.season_number || 1, row);
    }
  } else if (raw && typeof raw === 'object') {
    for (var key in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      var value = raw[key];
      var list = value && typeof value === 'object' && (value.id != null || value.episode_num != null)
        ? [value] : Api.asArray(value);
      for (var n = 0; n < list.length; n++) add(key, list[n]);
    }
  }
  return out;
}

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

/* =============================== ANA SAYFA =============================== */

Views.home = function () {
  var host = document.getElementById('screen'), sections = App.home.localSections();
  var html = '<div class="screen home-screen"><div class="home-hero"><div><div class="home-kicker">H&amp;M FAMILY</div>' +
    '<div class="home-title">İyi seyirler</div><div class="home-sub">Kaldığınız yerden devam edin veya son eklenenlere göz atın.</div></div>' +
    '<div class="home-hero-mark">' + uiIcon('movies') + '</div></div><div class="home-rows">';
  for (var i = 0; i < sections.length; i++) {
    html += '<div class="home-section ' + esc(sections[i].layout || 'portrait') + '"><div class="home-section-title">' + esc(sections[i].title) + '</div>' +
      '<div class="home-row" id="home-row-' + i + '"></div></div>';
  }
  host.innerHTML = html + '</div></div>';

  var zones = { rail: App.rail }, stacks = [];
  function nodesFor(index, section) {
    var wrap = document.getElementById('home-row-' + index), nodes = [];
    wrap.innerHTML = '';
    var items = section.items && section.items.length ? section.items : [{ __empty: true, name: section.empty }];
    for (var n = 0; n < items.length; n++) {
      var card = items[n], image = card.icon || '';
      var cardLayout = card.kind === 'live' ? ' landscape' : ' portrait';
      var node = el('div', 'home-card' + cardLayout + (card.__empty ? ' empty' : ''),
        '<div class="home-art"' + (image ? ' style="background-image:url(&quot;' + esc(image) + '&quot;)"' : '') + '>' +
        (!image && !card.__empty ? '<span>' + uiIcon(card.kind === 'live' ? 'live' : (card.kind === 'series' ? 'series' : 'movies')) + '</span>' : '') + '</div>' +
        '<div class="home-card-title">' + esc(card.name) + '</div>' +
        (card.sub ? '<div class="home-card-sub">' + esc(card.sub) + '</div>' : ''));
      node.__homeCard = card; wrap.appendChild(node); nodes.push(node);
    }
    return nodes;
  }
  function makeStack(index) {
    var stack = new Stack({
      id: 'home' + index, nodes: nodesFor(index, sections[index]), horizontal: true,
      neighbors: {
        left: 'rail', up: index > 0 ? 'home' + (index - 1) : null,
        down: index < sections.length - 1 ? 'home' + (index + 1) : null
      },
      onSelect: function (node) {
        var card = node && node.__homeCard;
        if (!card || card.__empty) {
          if (index === 0) App.go('recent');
          else if (index === 1) App.go('favs');
          else if (index === 2) App.go('series');
          else if (index === 3) App.go('live');
          else App.go('movies');
          return;
        }
        App.home.open(card);
      },
      onFocus: function () {
        var rows = document.querySelector('.home-rows');
        var section = document.querySelectorAll('.home-section')[index];
        if (rows && section) rows.scrollTop = Math.max(0, section.offsetTop - rows.offsetTop);
      }
    });
    return stack;
  }
  for (i = 0; i < sections.length; i++) {
    stacks[i] = makeStack(i); zones['home' + i] = stacks[i];
  }
  Nav.setScreen({ zones: zones, start: 'home0', onBack: function () { App.backToRailOrExit(); } });
  App.home.onLatest = function (latest) {
    if (App.route !== 'home' || !document.getElementById('home-row-4')) return;
    sections[4].items = latest;
    stacks[4].setNodes(nodesFor(4, sections[4]));
  };
  setTimeout(function () { if (App.route === 'home') App.home.refreshLatest(); }, 450);
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
      var words = String(c.name || '').split(/\s+/), initials = '';
      for (var wi = 0; wi < words.length && wi < 2; wi++) initials += words[wi].charAt(0);
      initials = initials.toUpperCase();
      var epg = c.__epg || [], nowLine = '', nextLine = '', progress = '';
      if (epg.length) {
        var current = epg[0], start = epgStart(current), end = epgEnd(current);
        nowLine = b64(current.title) || '';
        if (epg[1]) nextLine = b64(epg[1].title) || '';
        if (start && end && end > start) {
          var pct = Math.max(0, Math.min(100, Math.round((Date.now() - start.getTime()) * 100 / (end.getTime() - start.getTime()))));
          progress = '<div class="live-row-progress"><i style="width:' + pct + '%"></i></div>';
        }
      }
      return '<div class="num">' + esc(c.num || '') + '</div>' +
        '<div class="logo"' + logo + '>' + (!c.stream_icon ? '<span class="logo-fallback">' + esc(initials || 'TV') + '</span>' : '') + '</div>' +
        '<div class="body"><div class="name">' + esc(c.name) + '</div>' +
        '<div class="meta" data-epg="' + esc(c.stream_id) + '">' +
        (nowLine ? '<span class="live-now">Şimdi: ' + esc(nowLine) + '</span>' : '') +
        (nextLine ? '<span class="live-next"> · Sonra: ' + esc(nextLine) + '</span>' : '') +
        '</div>' + progress + '</div>' + fav;
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
  var state = App.vod[kind];
  state.prefs = VodPrefs.get(kind);
  function viewLabel() { return state.prefs.view === 'list' ? 'Liste' : 'Kart'; }
  function sortLabel() {
    return {
      provider: 'Sağlayıcı sırası', az: 'A - Z', za: 'Z - A', newest: 'En yeni', oldest: 'En eski',
      ratingDesc: 'Puan: yüksekten', ratingAsc: 'Puan: düşükten'
    }[state.prefs.sort] || 'Sağlayıcı sırası';
  }
  function filterLabel() {
    return { all: 'Tumu', continue: 'Devam et', unwatched: 'Izlenmemis', completed: 'Izlenmis', favorites: 'Favoriler' }[state.prefs.filter] || 'Tumu';
  }
  host.innerHTML =
    '<div class="screen">' +
    '<div class="section-tools vod-section-tools"><div class="section-search" id="g-search-wrap">' +
    '<span class="search-ic">' + uiIcon('search') + '</span><input id="g-search" type="text" autocomplete="off" ' +
    'placeholder="' + esc(t(kind === 'movie' ? 'library.movieSearch' : 'library.seriesSearch')) + '"></div>' +
    '<div class="library-options" id="g-options">' +
    '<div class="library-tool" id="g-view">Gorunum: <b>' + viewLabel() + '</b></div>' +
    '<div class="library-tool" id="g-sort">Sirala: <b>' + sortLabel() + '</b></div>' +
    '<div class="library-tool" id="g-filter">Filtre: <b>' + filterLabel() + '</b></div></div>' +
    '<div class="search-state" id="g-search-state"></div>' +
    '<div class="library-nav-hint">Yön tuşları: Tek tek · Kanal tuşları: Sayfa sayfa · Aramada Sarı: Son 5 arama</div></div>' +
    '<div class="cols" style="height:calc(1080px - var(--overscan) - 110px)">' +
    '<div class="col col-cats"><div class="col-head"><span>' + esc(t('live.categories')) + '</span></div>' +
    '<div class="listbox" id="g-cats"></div></div>' +
    '<div class="col col-list"><div class="col-head"><span id="g-title">' + title + '</span>' +
    '<span id="g-count"></span></div><div class="vod-focus-preview" id="g-focus-preview"></div><div class="listbox" id="g-grid" ' +
    'style="background:transparent;border:0"></div><div class="vod-position" id="g-position">' +
    '<i id="g-position-thumb"></i><span id="g-position-label"></span></div>' +
    '<div class="search-all-action" id="g-search-all"></div></div>' +
    '</div></div>';

  var positionTimer = null;
  function updateVodPosition(info) {
    var bar = document.getElementById('g-position');
    var thumb = document.getElementById('g-position-thumb');
    var label = document.getElementById('g-position-label');
    if (!bar || !thumb || !label || !info || !info.total || info.totalRows <= info.visibleRows) {
      if (bar) bar.className = 'vod-position';
      return;
    }
    var track = bar.clientHeight || 690;
    var height = Math.max(48, Math.round(track * info.visibleRows / info.totalRows));
    var maxRow = Math.max(1, info.totalRows - info.visibleRows);
    var top = Math.round((track - height) * Math.min(maxRow, info.row) / maxRow);
    thumb.style.height = height + 'px';
    thumb.style.transform = 'translateY(' + top + 'px)';
    label.style.top = Math.max(0, Math.min(track - 48, top + Math.floor(height / 2) - 24)) + 'px';
    label.textContent = (info.first + 1) + '–' + info.last + ' / ' + info.total;
    bar.className = 'vod-position visible' + (info.fast ? ' active' : '');
    if (positionTimer) clearTimeout(positionTimer);
    if (info.fast) {
      positionTimer = setTimeout(function () {
        var current = document.getElementById('g-position');
        if (current) current.className = 'vod-position visible';
      }, 1600);
    }
  }

  var cats = new List({
    id: 'cats', el: document.getElementById('g-cats'), rowH: 68,
    renderRow: function (c) { return '<div class="body"><div class="name">' + esc(c.category_name) + '</div></div>'; },
    neighbors: { left: 'rail', right: 'grid', up: 'search' },
    onFocus: function () { },
    onSelect: function (c) { if (c) state.activateCategory(c, true); }
  });
  cats.emptyText = t('live.noCategory');

  var grid = new Grid({
    id: 'grid', el: document.getElementById('g-grid'), cols: state.prefs.view === 'list' ? 1 : 5,
    rowH: state.prefs.view === 'list' ? 116 : 404,
    layoutClass: state.prefs.view === 'list' ? 'grid vod-list' : 'grid vod-cards',
    onPosition: updateVodPosition,
    renderCard: function (m) {
      var img = kind === 'movie' ? m.stream_icon : m.cover;
      var failed = img && PosterFailures.has(img);
      var art = '';
      var poster = img && !failed ? '<img class="vod-poster-img" src="' + esc(img) + '" alt="" loading="lazy">' : '';
      var ph = !img || failed ? '<div class="ph">' + esc(m.name) + '</div>' : '';
      var id = kind === 'movie' ? m.stream_id : m.series_id;
      var r = kind === 'movie' ? Resume.get('movie', id) : null;
      var bar = (r && r.dur) ? '<div class="bar"><i style="width:' +
        Math.round(r.pos / r.dur * 100) + '%"></i></div>' : '';
      var favoriteOn = Favs.has(kind, id);
      if (favoriteOn && !Favs.info(kind, id)) Favs.remember(kind, id, m, false);
      var star = favoriteOn ? '<span class="vod-fav">★</span>' : '';
      var watched = WatchState.has(kind, id) ? '<span class="vod-watched">✓ Izlendi</span>' : '';
      var year = m.year || m.releaseDate || m.releasedate || '';
      var rating = ProviderRating.text(m);
      var ratingBadge = rating ? '<span class="vod-rating-badge">★ ' + esc(rating) + '</span>' : '';
      var categoryLabel = m.__searchCategoryLabel || m.__categoryLabel || '';
      var categoryBadge = categoryLabel ? '<span class="vod-category-badge">' + esc(categoryLabel) + '</span>' : '';
      var newBadge = kind === 'series' && typeof SeriesUpdates !== 'undefined' && SeriesUpdates.candidate(m)
        ? '<span class="vod-new-badge">YENİ</span>' : '';
      if (state.prefs.view === 'list') {
        return '<div class="vod-list-art"' + art + '>' + poster + ph + ratingBadge + newBadge + bar + '</div>' +
          '<div class="vod-list-copy"><div class="vod-list-title"><span class="vod-title-scroll' + (String(m.name).length > 42 ? ' long' : '') + '">' + esc(m.name) + '</span>' + star + '</div>' +
          '<div class="vod-list-meta">' + esc(year ? String(year).slice(0, 4) : '') +
          (rating ? ' · Sağlayıcı puanı ' + esc(rating) : ' · Puan bilgisi yok') +
          (r ? ' · ' + Math.round(r.pos / r.dur * 100) + '% izlendi' : '') +
          '</div>' + (categoryLabel ? '<div class="vod-list-category">' + esc(categoryLabel) + '</div>' : '') + '</div>' + watched;
      }
      return '<div class="art"' + art + '>' + poster + ph + ratingBadge + newBadge + categoryBadge + bar + '</div>' +
        '<div class="cap"><span class="vod-title-scroll' + (String(m.name).length > 24 ? ' long' : '') + '">' + esc(m.name) + '</span>' + star + watched + '</div>';
    },
    neighbors: { left: 'cats', up: 'options' },
    onFocus: function (m) { if (m) state.schedulePreview(m); },
    onSelect: function (m) { App.detail.open(kind, m); },
    onAltSelect: function (m) {
      var id = kind === 'movie' ? m.stream_id : m.series_id;
      var on = Favs.toggle(kind, id, m);
      UI.toast(on ? t('favs.added') : t('favs.removed'));
      grid.draw();
    }
  });
  grid.emptyText = t('library.noContent');

  state.cats = cats;
  state.grid = grid;

  var searchInput = document.getElementById('g-search');
  var searchWrap = document.getElementById('g-search-wrap');
  var searchEditing = false;
  function finishSearchEdit(reason) {
    searchEditing = false;
    Nav.imeOpen = false;
    Nav.imeTarget = null;
    try { searchInput.blur(); } catch (e) { }
    if (reason === 'done' && state.searchQuery.length >= 3) {
      state.focusResultsAfterSearch = true;
      if (state.searching) Nav.focus('cats');
      else if (state.grid.items.length) { state.focusResultsAfterSearch = false; Nav.focus('grid'); }
      else if (state.currentCat && state.currentCat.category_id !== '__all') { state.focusResultsAfterSearch = false; Nav.focus('searchAll'); }
      else { state.focusResultsAfterSearch = false; Nav.focus('cats'); }
    } else Nav.focus('search');
  }
  searchInput.addEventListener('focus', function () { searchWrap.className = 'section-search focus editing'; });
  searchInput.addEventListener('blur', function () {
    searchEditing = false;
    searchWrap.className = 'section-search' + (Nav.zone && Nav.zone.id === 'search' ? ' focus' : '');
  });
  searchInput.addEventListener('input', function () { state.search(searchInput.value); });
  searchInput.addEventListener('change', function () { state.search(searchInput.value); });
  var search = new Stack({
    id: 'search', nodes: [searchWrap], horizontal: true,
    neighbors: { left: 'options', right: 'options', down: 'cats' },
    onSelect: function () {
      searchEditing = true;
      Nav.openIme(searchInput);
      try { searchInput.focus(); searchInput.click(); } catch (e) { }
    }
  });
  var optionNodes = [document.getElementById('g-view'), document.getElementById('g-sort'), document.getElementById('g-filter')];
  var options = new Stack({
    id: 'options', nodes: optionNodes, horizontal: true,
    neighbors: { left: 'search', right: 'search', down: 'grid' },
    onSelect: function (node, index) {
      if (index === 0) state.openPreference('view');
      else if (index === 1) state.openPreference('sort');
      else state.openPreference('filter');
    }
  });
  var searchAll = new Stack({
    id: 'searchAll', nodes: [document.getElementById('g-search-all')],
    neighbors: { left: 'cats', up: 'options', down: 'grid' },
    onSelect: function () { state.searchAllCategories(); }
  });
  state.searchInput = searchInput;
  state.beginView(opts && opts.restoreVod === kind);

  Nav.setScreen({
    zones: { rail: App.rail, search: search, options: options, cats: cats, grid: grid, searchAll: searchAll },
    start: 'cats',
    onImeClose: function (reason) { finishSearchEdit(reason); },
    onKey: function (e) {
      if (e.keyCode === KEY.CH_UP || e.keyCode === KEY.CH_DOWN) {
        if (Nav.zone === grid) grid.page(e.keyCode === KEY.CH_UP ? -1 : 1);
        return true;
      }
      if (Nav.zone && Nav.zone.id === 'search' && e.keyCode === KEY.YELLOW) {
        state.openSearchHistory(); return true;
      }
      if (searchEditing && (e.keyCode === KEY.BACK || e.keyCode === KEY.ESC)) {
        finishSearchEdit('back');
        return true;
      }
      return false;
    },
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
  App.recent.removeMode = false;
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
      return '<div class="recent-main"><div class="logo"' + logo + '></div><div class="body">' +
        '<div class="name">' + esc(it.name) + '</div>' +
        '<div class="meta">' + kind + esc(extra) + '</div></div></div>' +
        '<div class="recent-remove' + (App.recent.removeMode ? ' focus' : '') + '">×</div>';
    },
    neighbors: { left: 'rail', up: 'bar' },
    onFocus: function (it) { App.recent.showInfo(it); },
    onSelect: function (it) { App.recent.open(it); },
    onAltSelect: function (it) { App.recent.confirmRemove(it); }
  });
  list.emptyText = t('recent.empty');

  App.recent.list = list;
  App.recent.bar = bar;
  Nav.setScreen({
    zones: { rail: App.rail, bar: bar, list: list },
    start: 'list',
    onKey: function (e) {
      if (Nav.zone !== list) return false;
      if (e.keyCode === KEY.RIGHT) {
        App.recent.removeMode = true; list.draw(); return true;
      }
      if (e.keyCode === KEY.LEFT && App.recent.removeMode) {
        App.recent.removeMode = false; list.draw(); return true;
      }
      if (e.keyCode === KEY.ENTER && App.recent.removeMode) {
        App.recent.confirmRemove(list.items[list.index]); return true;
      }
      return false;
    },
    onBack: function () {
      if (App.recent.removeMode) { App.recent.removeMode = false; list.draw(); return; }
      App.backToRailOrExit();
    }
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
    '<div class="settings-heading"><div class="page-title">' + esc(t('settings.title')) + '</div>' +
    '<div class="settings-search" id="st-search-wrap"><span class="search-ic">' + uiIcon('search') + '</span>' +
    '<input id="st-search" type="text" autocomplete="off" placeholder="Ayarlarda ara"></div></div>' +
    '<div class="settings-search-state" id="st-search-state">OK: Klavyeyi aç · Geri: Klavyeyi kapat</div>' +
    '<div class="settings-layout"><div class="settings-categories"><div class="btnrow" id="st-cats"></div></div>' +
    '<div class="settings-list"><div class="btnrow" id="st-btns"></div></div>' +
    '<div class="settings-help info" id="st-help"></div>' +
    '</div></div>';

  var wrap = document.getElementById('st-btns');
  var defs = App.settings.defs();
  var categories = App.settings.categories();
  var catWrap = document.getElementById('st-cats'), catNodes = [];
  var activeCategory = categories[0].id, visibleDefs = [], searchQuery = '', searchEditing = false;
  for (var ci = 0; ci < categories.length; ci++) {
    var catNode = el('div', 'btn settings-category', esc(categories[ci].label));
    catWrap.appendChild(catNode); catNodes.push(catNode);
  }

  function showHelp(index) {
    var def = visibleDefs[index] || visibleDefs[0], box = document.getElementById('st-help');
    if (!def || !box) return;
    var meta = App.settings.meta(def);
    box.innerHTML = '<div class="settings-help-kicker">' + esc(t('settings.what')) + '</div><h2>' +
      esc(def.title || def.label()) + '</h2><div class="settings-help-copy">' +
      esc(def.help || t('settings.selectHelp')) + '</div>' +
      (def.recommended ? '<div class="settings-recommended"><b>' + esc(t('common.recommended')) + '</b><br>' + esc(def.recommended) + '</div>' : '') +
      (meta.choices ? '<div class="settings-choice-note">OK ile bütün seçenekleri açın.</div>' : '') +
      '<div class="settings-help-footer">' + esc(t('settings.footer')) + '</div>';
  }

  var stack = new Stack({
    id: 'list', nodes: [],
    neighbors: { left: 'cats', up: 'search' },
    onFocus: function (node, i) { showHelp(i); },
    onSelect: function (node, i) {
      var def = visibleDefs[i], meta = def ? App.settings.meta(def) : null;
      if (!def || !meta) return;
      if (meta.choices) {
        App.choiceDialog(def.title || def.label(), meta.choices, meta.value, function (value) {
          meta.set(value); renderSettings(i); UI.toast('Ayar kaydedildi');
        });
        return;
      }
      function runAction() {
        if (def.run() === false) return;
        renderSettings(i);
      }
      if (meta.destructive) {
        App.confirmDialog(def.title, 'Bu işlem geri alınamaz. Devam etmek istiyor musunuz?', 'Uygula', runAction);
      } else runAction();
    }
  });

  function renderSettings(keepIndex) {
    visibleDefs = [];
    var q = norm(searchQuery).trim();
    for (var i = 0; i < defs.length; i++) {
      var meta = App.settings.meta(defs[i]);
      if (q) {
        if (norm(defs[i].label() + ' ' + meta.keywords).indexOf(q) !== -1) visibleDefs.push(defs[i]);
      } else if (meta.category === activeCategory) visibleDefs.push(defs[i]);
    }
    wrap.innerHTML = '';
    var nodes = [];
    for (i = 0; i < visibleDefs.length; i++) {
      var b = el('div', 'btn settings-option', esc(visibleDefs[i].label()));
      wrap.appendChild(b); nodes.push(b);
    }
    if (!nodes.length) wrap.innerHTML = '<div class="settings-empty">Eşleşen ayar bulunamadı.</div>';
    stack.nodes = nodes;
    stack.index = Math.max(0, Math.min(keepIndex || 0, nodes.length - 1));
    stack.draw();
    var state = document.getElementById('st-search-state');
    if (state) state.textContent = q ? visibleDefs.length + ' ayar bulundu' : 'OK: Seçenekleri aç · ← Kategoriler · ↑ Arama';
    if (visibleDefs.length) showHelp(stack.index);
    else document.getElementById('st-help').innerHTML = '<div class="empty">Arama ifadenizi değiştirin.</div>';
  }

  var cats = new Stack({
    id: 'cats', nodes: catNodes,
    neighbors: { left: 'rail', right: 'list', up: 'search' },
    onFocus: function (node, index) {
      if (searchQuery) return;
      activeCategory = categories[index].id;
      renderSettings(0);
    },
    onSelect: function () { if (visibleDefs.length) Nav.focus('list'); }
  });

  var searchInput = document.getElementById('st-search');
  var searchWrap = document.getElementById('st-search-wrap');
  searchInput.addEventListener('focus', function () { searchWrap.className = 'settings-search focus editing'; });
  searchInput.addEventListener('blur', function () {
    searchEditing = false;
    searchWrap.className = 'settings-search' + (Nav.zone && Nav.zone.id === 'search' ? ' focus' : '');
  });
  searchInput.addEventListener('input', function () { searchQuery = searchInput.value; renderSettings(0); });
  searchInput.addEventListener('change', function () { searchQuery = searchInput.value; renderSettings(0); });
  var search = new Stack({
    id: 'search', nodes: [searchWrap], horizontal: true,
    neighbors: { left: 'rail', right: 'list', down: 'cats' },
    onSelect: function () {
      searchEditing = true; Nav.openIme(searchInput);
      try { searchInput.focus(); searchInput.click(); } catch (e) { }
    }
  });

  function finishSearch(reason) {
    searchEditing = false; Nav.imeOpen = false; Nav.imeTarget = null;
    try { searchInput.blur(); } catch (e) { }
    if (reason === 'done' && visibleDefs.length) Nav.focus('list');
    else Nav.focus('search');
  }

  Nav.setScreen({
    zones: { rail: App.rail, search: search, cats: cats, list: stack },
    start: 'cats',
    onImeClose: function (reason) { finishSearch(reason); },
    onKey: function (e) {
      if (searchEditing && (e.keyCode === KEY.BACK || e.keyCode === KEY.ESC)) { finishSearch('back'); return true; }
      return false;
    },
    onBack: function () {
      if (searchQuery) {
        searchQuery = ''; searchInput.value = ''; renderSettings(0); Nav.focus('search'); return;
      }
      App.backToRailOrExit();
    }
  });
  renderSettings(0);
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
  var proxy = Tmdb.proxyConfigured();
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
    (proxy ? '<div class="settings-recommended"><b>' + esc(t('tmdb.public')) + '</b><br>' + esc(t('tmdb.publicReady')) + '</div>' :
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
    UI.toast(proxy ? t('tmdb.proxyFallback') : t('tmdb.cleared'));
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

Views.detailLoading = function (kind, item, onBack) {
  var host = document.getElementById('screen');
  var image = kind === 'movie' ? item.stream_icon : item.cover;
  host.innerHTML = '<div class="screen detail-screen detail-loading-screen">' +
    '<div class="detail-backdrop" id="detail-loading-backdrop"></div><div class="detail-gradient"></div>' +
    '<div class="detail-loading-copy"><div class="detail-type">' + (kind === 'movie' ? 'FİLM' : 'DİZİ') + '</div>' +
    '<div class="detail-title">' + esc(item.name || '') + '</div>' +
    '<div class="detail-loading-line">Bilgiler hazırlanıyor…</div></div></div>';
  applyBackdropCandidates(document.getElementById('detail-loading-backdrop'), [item.backdrop, item.backdrop_path, item.movie_image, item.cover_big, image]);
  Nav.setScreen({ zones: {}, onBack: function () { if (onBack) onBack(); } });
};

Views.detail = function (kind, item, info) {
  var host = document.getElementById('screen');
  var isMovie = kind === 'movie';
  var id = isMovie ? item.stream_id : item.series_id;
  var meta = (info && (info.info || info)) || {};
  var img = (isMovie ? item.stream_icon : item.cover) || meta.cover_big || meta.movie_image || '';
  var backdropCandidates = [meta.backdrop, meta.backdrop_path, meta.movie_image, meta.cover_big,
    item.backdrop, item.backdrop_path, item.movie_image, item.cover_big, img];
  var plot = meta.plot || meta.description || '';
  var line = [];
  if (meta.releasedate || meta.releaseDate) line.push(String(meta.releasedate || meta.releaseDate).slice(0, 4));
  if (meta.genre) line.push(meta.genre);
  if (meta.rating) line.push(t('detail.rating') + ' ' + meta.rating);
  if (isMovie && meta.duration) line.push(meta.duration);
  var detailCategoryNames = item.__categoryNames ? item.__categoryNames.slice(0) : [];
  var vodState = App.vod && App.vod[kind];
  if (vodState && vodState.categoryNamesFor) detailCategoryNames = vodState.categoryNamesFor(item,
    vodState.currentCat && vodState.currentCat.category_id !== '__all' ? vodState.currentCat.category_id : '');
  var categoryHtml = '';
  if (detailCategoryNames.length) {
    categoryHtml = '<div class="detail-categories"><span>Kategoriler</span>';
    for (var categoryIndex = 0; categoryIndex < detailCategoryNames.length; categoryIndex++) {
      categoryHtml += '<b class="detail-category">' + esc(detailCategoryNames[categoryIndex]) + '</b>';
    }
    categoryHtml += '</div>';
  }

  host.innerHTML =
    '<div class="screen detail-screen">' +
    '<div class="detail-backdrop" id="detail-backdrop"></div>' +
    '<div class="detail-gradient"></div><div class="detail-content">' +
    '<div class="detail-hero"><div class="detail-type">' + (isMovie ? 'FİLM' : 'DİZİ') + '</div>' +
    '<div class="detail-title">' + esc(item.name) + '</div>' +
    '<div class="detail-meta" id="detail-meta">' + esc(line.join('  ·  ')) + '</div>' + categoryHtml +
    '<div class="detail-description" id="detail-description">' + esc(plot || 'Özet bilgisi bulunmuyor.') + '</div>' +
    '<div class="detail-summary-hint" id="detail-summary-hint">OK: Özeti genişlet</div>' +
    '<div class="btnrow detail-actions" id="d-btns"></div></div>' +
    '<div id="d-body" class="detail-body"></div>' +
    '</div></div>';
  applyBackdropCandidates(document.getElementById('detail-backdrop'), backdropCandidates);
  var initialBackdrops = viewImageCandidates(backdropCandidates, 'w1280');
  Diag.set('Detay arka plan', initialBackdrops.length ? 'saglayici/listeden adres bulundu' : 'ilk asamada adres yok');

  Views.enhanceDetail = function (tmdb) {
    if (!tmdb) return;
    var bg = document.getElementById('detail-backdrop');
    if (bg) applyBackdropCandidates(bg, [tmdb.backdrop, tmdb.backdropPath].concat(backdropCandidates));
    Diag.set('TMDb arka plan', (tmdb.backdrop || tmdb.backdropPath) ? 'adres bulundu ve uygulandi' : 'eslesen kayitta arka plan yok');
    var desc = document.getElementById('detail-description');
    if (desc && (!plot || plot.length < 20) && (tmdb.overviewLocalized || tmdb.overviewEn)) {
      desc.textContent = tmdb.overviewLocalized || tmdb.overviewEn;
    }
    var detailMeta = document.getElementById('detail-meta'), extra = line.slice(0);
    if (tmdb.voteAverage) extra.push('TMDb ★ ' + Number(tmdb.voteAverage).toFixed(1).replace('.', ','));
    if (detailMeta) detailMeta.textContent = extra.join('  ·  ');
  };

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
      var on = Favs.toggle(kind, id, item);
      UI.toast(on ? t('favs.added') : t('favs.removed'));
      btns.nodes[btns.index].innerHTML = on ? t('detail.removeFav') : t('detail.addFav');
    }
  });
  actions.push({
    label: WatchState.has(kind, id) ? 'Izlenmedi olarak isaretle' : 'Izlendi olarak isaretle',
    run: function () {
      var watched = !WatchState.has(kind, id);
      WatchState.setContent(kind, id, watched, item.name);
      if (watched && isMovie) Resume.remove('movie', id);
      UI.toast(watched ? 'Izlendi olarak isaretlendi' : 'Izlendi isareti kaldirildi');
      Views.detail(kind, item, info);
    }
  });

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

  var summaryExpanded = false;
  var summaryNode = document.getElementById('detail-description');
  var summary = new Stack({
    id: 'summary', nodes: [summaryNode],
    neighbors: { left: 'rail', down: 'btns' },
    onSelect: function () {
      summaryExpanded = !summaryExpanded;
      summaryNode.className = 'detail-description' + (summaryExpanded ? ' expanded' : '') + ' focus';
      document.getElementById('detail-summary-hint').textContent = summaryExpanded ? 'Geri: Özeti daralt' : 'OK: Özeti genişlet';
    }
  });
  zones.summary = summary;

  if (!isMovie) {
    /* dizi: sezonlar + bolumler */
    var body = document.getElementById('d-body');
    body.innerHTML =
      '<div class="col detail-seasons">' +
      '<div class="col-head">' + esc(t('detail.season')) + '</div><div class="listbox" id="d-seasons"></div></div>' +
      '<div class="col detail-episodes"><div class="col-head">' + esc(t('detail.episodes')) + '</div>' +
      '<div class="listbox" id="d-eps"></div></div>';

    var providerEpisodes = providerSeasonMap(info);
    var episodes = {};
    var providerSeasonKeys = Object.keys(providerEpisodes);
    for (var pk = 0; pk < providerSeasonKeys.length; pk++) {
      var seasonId = providerSeasonKeys[pk], sourceList = Api.asArray(providerEpisodes[seasonId]);
      var groups = {}, order = [];
      for (var se = 0; se < sourceList.length; se++) {
        var sourceEp = sourceList[se];
        if (!sourceEp || typeof sourceEp !== 'object') continue;
        var sourceInfo = sourceEp.info && typeof sourceEp.info === 'object' ? sourceEp.info : {};
        var epNo = String(sourceEp.episode_num || sourceEp.episode || sourceInfo.episode_num || sourceInfo.episode_number || (se + 1));
        if (!groups[epNo]) { groups[epNo] = []; order.push(epNo); }
        groups[epNo].push(sourceEp);
      }
      order.sort(function (a, b) { return (+a) - (+b); });
      episodes[seasonId] = [];
      for (var og = 0; og < order.length; og++) {
        var no = order[og], candidates = groups[no].slice(0).reverse();
        var preferredId = EpisodeSources.preferred(id, seasonId, no);
        if (preferredId) {
          for (var pc = 0; pc < candidates.length; pc++) {
            if (String(candidates[pc].id) === preferredId) {
              var preferred = candidates.splice(pc, 1)[0]; candidates.unshift(preferred); break;
            }
          }
        }
        var representative = {}, src = candidates[0] || {};
        for (var prop in src) if (Object.prototype.hasOwnProperty.call(src, prop)) representative[prop] = src[prop];
        representative.__candidates = candidates;
        representative.__season = seasonId;
        representative.__progressId = String(id) + ':s' + seasonId + 'e' + no;
        representative.__canonical = 's' + String(seasonId) + 'e' + String(no);
        representative.__seriesMeta = meta;
        episodes[seasonId].push(representative);
      }
    }
    var seasonKeys = Object.keys(episodes).sort(function (a, b) { return (+a) - (+b); });
    var seasons = seasonKeys.map(function (k) {
      return { id: k, name: 'Sezon ' + k, count: Api.asArray(episodes[k]).length };
    });
    var providerEpisodeCount = 0;
    for (var dc = 0; dc < seasonKeys.length; dc++) providerEpisodeCount += Api.asArray(episodes[seasonKeys[dc]]).length;
    Diag.set('Dizi bolumleri', seasonKeys.length + ' sezon · ' + providerEpisodeCount + ' oynatilabilir bolum');

    var episodeKeys = [];
    for (var uk = 0; uk < seasonKeys.length; uk++) {
      var updateRows = episodes[seasonKeys[uk]];
      for (var ui = 0; ui < updateRows.length; ui++) episodeKeys.push(updateRows[ui].__canonical);
    }
    var pendingNew = typeof SeriesUpdates !== 'undefined'
      ? SeriesUpdates.inspect(id, episodeKeys, SeriesUpdates.lm(item, info)) : {};
    for (uk = 0; uk < seasonKeys.length; uk++) {
      updateRows = episodes[seasonKeys[uk]];
      for (ui = 0; ui < updateRows.length; ui++) {
        updateRows[ui].__new = !!pendingNew[updateRows[ui].__canonical] &&
          !WatchState.episodeWatched(id, updateRows[ui].__season, updateRows[ui].episode_num);
      }
    }

    var eps = new List({
      id: 'eps', el: document.getElementById('d-eps'), rowH: 154,
      renderRow: function (ep) {
        var provider = ep.info && typeof ep.info === 'object' ? ep.info : {}, tm = ep.__tmdb || {};
        var r = Resume.get('ep', ep.__progressId || ep.id);
        var prog = (r && r.dur) ? '<div class="prog"><i style="width:' +
          Math.round(r.pos / r.dur * 100) + '%"></i></div>' : '';
        var watchedOn = WatchState.episodeWatched(id, ep.__season, ep.episode_num);
        var watched = watchedOn ? '<span class="episode-watched">✓ İzlenmiş</span>' : '';
        var alternatives = ep.__candidates && ep.__candidates.length > 1 ? '<span class="episode-source">Yedekli kaynak</span>' : '';
        var image = viewImageUrl(provider.movie_image || provider.cover_big || tm.still || '', 'w300');
        var title = ep.title || provider.name || tm.title || ('Bölüm ' + ep.episode_num);
        var overview = provider.plot || provider.description || tm.overview || 'Bölüm özeti bulunmuyor.';
        var date = provider.releasedate || provider.release_date || tm.date || '';
        var duration = provider.duration || ep.duration || (tm.runtime ? tm.runtime + ' dk' : '');
        var rating = provider.rating || ep.rating || (tm.rating ? Number(tm.rating).toFixed(1).replace('.', ',') : '');
        var details = [];
        if (duration) details.push(duration);
        if (date) details.push(String(date).slice(0, 10));
        if (rating) details.push('★ ' + rating);
        var newMark = ep.__new && !watchedOn ? '<span class="episode-new">YENİ</span>' : '';
        return '<div class="episode-thumb">' +
          (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '<span>' + esc(ep.episode_num || '') + '</span>') +
          '<b>' + esc(ep.episode_num || '') + '</b></div>' +
          '<div class="body episode-copy"><div class="name">' + esc(title) + newMark + '</div>' +
          '<div class="meta episode-meta">' + esc(details.join(' · ')) + watched + alternatives + '</div>' +
          '<div class="episode-overview">' + esc(overview) + '</div>' + prog + '</div>';
      },
      neighbors: { left: 'seasons', up: 'btns' },
      onSelect: function (ep) { App.detail.playEpisode(item, ep, meta); }
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
        App.detail.activeSeason = String(s.id);
        App.detail.loadSeasonVisuals(String(s.id), App.detail.requestId);
      },
      onSelect: function () { Nav.focus('eps'); }
    });
    seasonsList.emptyText = 'Sezon yok';

    zones.seasons = seasonsList;
    zones.eps = eps;
    btns.neighbors = { up: 'summary', down: 'seasons', left: 'rail' };
    var flat = [];
    for (var sk = 0; sk < seasonKeys.length; sk++) flat = flat.concat(episodes[seasonKeys[sk]]);
    for (var fi = 0; fi < flat.length; fi++) {
      flat[fi].__prev = fi > 0 ? flat[fi - 1] : null;
      flat[fi].__next = fi < flat.length - 1 ? flat[fi + 1] : null;
    }
    App.detail.applyTmdbSeason = function (season, data) {
      var rows = episodes[String(season)] || [];
      for (var ti = 0; ti < rows.length; ti++) rows[ti].__tmdb = data[String(rows[ti].episode_num)] || {};
      if (App.detail.activeSeason === String(season)) eps.draw();
    };
    seasonsList.setItems(seasons);
    if (!seasons.length) {
      seasonsList.emptyText = 'Dizi bölüm bilgisi alınamadı. Geri dönüp yeniden deneyin.';
      seasonsList.draw();
      eps.emptyText = 'Oynatılabilir bölüm bulunamadı.';
      eps.setItems([]);
      var responseKeys = info && typeof info === 'object' ? Object.keys(info).slice(0, 16).join(',') : String(info);
      Diag.add('Dizi detayinda sezon/bolum verisi bulunamadi: ' + String(item.name || id) + ' · yanit=' + responseKeys);
    }
  } else {
    btns.neighbors = { up: 'summary', left: 'rail' };
  }

  zones.rail = App.rail;

  Nav.setScreen({
    zones: zones,
    start: 'btns',
    onKey: function (e) {
      if (e.keyCode === KEY.INFO) { App.tmdb.show(kind, item, info); return true; }
      return false;
    },
    onBack: function () {
      if (summaryExpanded) {
        summaryExpanded = false;
        summaryNode.className = 'detail-description';
        document.getElementById('detail-summary-hint').textContent = 'OK: Özeti genişlet';
        Nav.focus('summary');
        return;
      }
      App.back();
    }
  });
};
