/* player.js - Tizen AVPlay birinci, HTML5 <video> yedek
   AVPlay ham MPEG-TS ve HLS'i donanimdan cozer; TV'de her zaman
   <video> etiketinden daha genis codec destegi verir. */
'use strict';

var Player = {
  engine: null,          /* 'avplay' | 'html5' */
  url: null,
  live: false,
  playing: false,
  cb: {},
  _tick: null,
  _pos: 0,
  _dur: 0,
  _pendingSeek: 0,
  _sessionId: 0,
  _failed: false,
  _readyAt: 0,
  _buffering: false,
  _bufferingSince: 0,
  _bufferTimer: null,
  _lastProgressAt: 0,
  _lastProgressPos: 0,
  _stallSentAt: 0,
  _lastVideoFrames: -1,
  _lastVideoFrameAt: 0,
  aspect: 'auto',
  lastAspectApplied: true,
  aspectOrder: ['auto', 'ratio16x9', 'cinema21x9', 'ratio4x3', 'zoom4x3', 'zoom21x9'],
  tracks: null,
  subtitleMuted: null,
  _subtitleTimer: null,
  _htmlSubtitleTrack: null,
  _subtitleEventCount: 0,
  _softwareSubInfo: null,
  _softwareSubtitleTrack: null,
  _softwareSubtitleCues: null,
  _softwareDesiredIndex: null,
  _softwareLastText: '',
  _softwareLoadId: 0,
  _softwareLoadingIndex: null,
  _softwareInspecting: false,
  softwareSubtitleStatus: '',
  _seekTimer: null,
  _seekLockTimer: null,
  _seekInFlight: false,
  _seekQueuedTarget: null,
  _seekTarget: 0,
  _seekPreviewUntil: 0,
  _preparing: false,
  _preparationSkip: false,
  _preparationError: false,
  _preparationResume: 0,
  _preparationProgress: 0,
  _engineStarted: false,
  _engineStartTimer: null,
  _requestedSubtitlePreference: 'off',
  _nativeAttemptPreference: null,
  _nativeSubtitleProven: false,
  _statsSample: null,
  _decodedRateBps: 0,
  _decodedFps: 0,
  _avVideoSize: null,
  _sourceVideoInfo: null,
  _engineOverride: null,
  _nativeReselectTimer: null,
  _nativeReselectBufferDone: false,
  _nativeReselectPlaytimeDone: false,
  displayRect: null,
  _viewportTimer: null,
  _viewportApplyCount: 0,

  previewBodyClass: function () {
    return 'playing live-preview' + (this.engine === 'avplay' ? ' av-preview' : ' html5-preview');
  },

  syncBodyClass: function () {
    document.body.className = this.displayRect ? this.previewBodyClass() : 'playing';
  },

  nativeDisplayRect: function () {
    return this.displayRect || { x: 0, y: 0, width: 1920, height: 1080 };
  },

  setNodeRect: function (node, r) {
    if (!node) return;
    node.style.left = r.x + 'px'; node.style.top = r.y + 'px';
    node.style.width = r.width + 'px'; node.style.height = r.height + 'px';
  },

  tizenVersion: function () {
    var ua = '';
    try { ua = navigator.userAgent || ''; } catch (e) { }
    var match = ua.match(/Tizen[\s\/]+(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : 0;
  },

  avCompatibilityLabel: function (mode) {
    return {
      auto: 'Otomatik (önerilen)',
      legacySync: 'Eski TV modu: Açık',
      standard: 'Eski TV modu: Kapalı'
    }[mode] || 'Otomatik';
  },

  avCompatibilityPreference: function () {
    try { return Settings.get('avplayCompatibility') || 'auto'; }
    catch (e) { return 'auto'; }
  },

  resolvedAvCompatibility: function () {
    var selected = this.avCompatibilityPreference();
    if (selected !== 'auto') return selected;
    var version = this.tizenVersion();
    /* Q60R ailesinin kullandigi Tizen 5.0'da oynatma sirasinda yalnizca
       setDisplayRect cagirmak bazen goruntu alanini yenilemiyor. Bilinmeyen
       ve yeni cihazlarda v1.17.0'in dogrulanmis davranisini koru. */
    return version > 0 && version <= 5.0 ? 'legacySync' : 'standard';
  },

  avCompatibilityDiagnostics: function (stage) {
    var selected = this.avCompatibilityPreference();
    var resolved = this.resolvedAvCompatibility();
    var version = this.tizenVersion();
    Diag.set('Tizen surumu', version ? String(version) : 'algilanamadi');
    Diag.set('AVPlay uyumluluk secimi', this.avCompatibilityLabel(selected));
    Diag.set('AVPlay uyumluluk yontemi', this.avCompatibilityLabel(resolved));
    if (stage) Diag.set('AVPlay alan gecisi', stage);
    return resolved;
  },

  applyViewportStyles: function () {
    var logical = this.displayRect || { x: 0, y: 0, width: 1920, height: 1080 };
    var els = this.els();
    /* AVPlay donanim katmani DOM kutusundan bagimsizdir. AU8000'de nesneyi
       kucultmek ses gelirken goruntunun kaybolmasina yol aciyor. OTTplay ile
       dogrulanan duzende object daima tam ekran, yalnizca yerel video alani
       setDisplayRect ile degisir. */
    var avRect = { x: 0, y: 0, width: 1920, height: 1080 };
    if (this.engine === 'avplay' && this.resolvedAvCompatibility() !== 'standard') avRect = logical;
    this.setNodeRect(els.av, avRect);
    this.setNodeRect(els.v, logical);
    if (this.engine === 'avplay') {
      Diag.set('AVPlay DOM alani', [avRect.x, avRect.y, avRect.width, avRect.height].join(' / '));
    }
  },

  setViewport: function (rect) {
    var wasPreview = !!this.displayRect;
    this.displayRect = rect || null;
    var r = rect || { x: 0, y: 0, width: 1920, height: 1080 };
    this.applyViewportStyles();
    if (this.playing) this.syncBodyClass();
    if (this._viewportTimer) { clearTimeout(this._viewportTimer); this._viewportTimer = null; }
    var transition = wasPreview && !rect;
    var method = this.engine === 'avplay' ? this.avCompatibilityDiagnostics(
      transition ? 'On izlemeden tam ekrana' : (rect ? 'On izleme alani' : 'Tam ekran alani')) : 'standard';
    this.applyAspect();
    if (this.playing && this.engine === 'avplay') this.scheduleViewportReapply(method);
    var actual = this.engine === 'avplay' ? this.nativeDisplayRect() : r;
    Diag.set('Video penceresi', [actual.x, actual.y, actual.width, actual.height].join(' / '));
  },

  scheduleViewportReapply: function (method) {
    var self = this, token = this._sessionId;
    var delay = method === 'standard' ? 150 : 260;
    this._viewportTimer = setTimeout(function () {
      self._viewportTimer = null;
      if (token !== self._sessionId || !self.playing || self.engine !== 'avplay') return;
      if (method === 'standard') self.applyAspect();
      else self.applyLegacyAvLayout('gecikmeli tekrar');
    }, delay);
  },

  aspectLabel: function (mode) {
    return {
      auto: 'Otomatik', ratio16x9: '16:9', ratio4x3: '4:3',
      zoom4x3: '4:3 → 16:9 yakinlastir', cinema21x9: '21:9',
      zoom21x9: '21:9 → 16:9 doldur'
    }[this.normalizeAspect(mode)] || 'Otomatik';
  },

  normalizeAspect: function (mode) {
    /* Onceki surumlerdeki adlari kayip yaratmadan yeni sabit geometrilere tasi. */
    if (mode === 'fullscreen') return 'ratio16x9';
    if (mode === 'letterbox') return 'auto';
    return this.aspectOrder.indexOf(mode) === -1 ? 'auto' : mode;
  },

  nextAspect: function (mode) {
    mode = this.normalizeAspect(mode);
    var i = this.aspectOrder.indexOf(mode);
    if (i < 0) i = 0;
    return this.aspectOrder[(i + 1) % this.aspectOrder.length];
  },

  isUnsupportedAvCrop: function (mode) {
    mode = this.normalizeAspect(mode);
    return this.engine === 'avplay' && !this.displayRect &&
      (mode === 'zoom4x3' || mode === 'zoom21x9');
  },

  applyDisplayRect: function () {
    if (this.engine !== 'avplay' || !this.hasAvplay()) return true;
    return this.applyAvLayout();
  },

  readAvVideoSize: function () {
    if (this.engine !== 'avplay' || !this.hasAvplay()) return this._avVideoSize;
    var width = 0, height = 0, info, i, extra;
    try {
      info = webapis.avplay.getVideoSize();
      width = Number(info && (info.width || info.Width)) || 0;
      height = Number(info && (info.height || info.Height)) || 0;
    } catch (e) { }
    if (!width || !height) {
      try {
        info = webapis.avplay.getCurrentStreamInfo();
        for (i = 0; info && i < info.length; i++) {
          if (info[i].type !== 'VIDEO') continue;
          extra = this.parseTrackInfo(info[i].extra_info);
          width = Number(extra.Width || extra.width) || 0;
          height = Number(extra.Height || extra.height) || 0;
          if (width && height) break;
        }
      } catch (streamError) { }
    }
    if (width > 0 && height > 0) this._avVideoSize = { width: width, height: height };
    return this._avVideoSize;
  },

  fitRect: function (width, height) {
    width = Number(width) || 0; height = Number(height) || 0;
    return this.fitRatio(width && height ? width / height : 0);
  },

  ratioNumber: function (value) {
    if (typeof value === 'number') return isFinite(value) && value > 0 ? value : 0;
    var match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*[:\/]\s*(\d+(?:\.\d+)?)$/);
    if (match && Number(match[2]) > 0) return Number(match[1]) / Number(match[2]);
    var direct = Number(value);
    return isFinite(direct) && direct > 0 ? direct : 0;
  },

  sourceDisplayRatio: function () {
    var info = this._sourceVideoInfo || {};
    var direct = this.ratioNumber(info.display_aspect_ratio || info.displayAspectRatio || info.dar || info.DAR);
    if (direct) return direct;
    var width = Number(info.width || info.Width) || 0;
    var height = Number(info.height || info.Height) || 0;
    var sample = this.ratioNumber(info.sample_aspect_ratio || info.sampleAspectRatio || info.sar || info.SAR);
    if (width && height) return width / height * (sample || 1);
    return 0;
  },

  fitRatio: function (sourceRatio) {
    sourceRatio = Number(sourceRatio) || 0;
    if (!sourceRatio) return { x: 0, y: 0, width: 1920, height: 1080 };
    var screenRatio = 1920 / 1080;
    var outWidth, outHeight, x, y;
    if (sourceRatio > screenRatio) {
      outWidth = 1920;
      outHeight = Math.max(2, Math.round((1920 / sourceRatio) / 2) * 2);
      x = 0; y = Math.round((1080 - outHeight) / 2);
    } else {
      outHeight = 1080;
      outWidth = Math.max(2, Math.round((1080 * sourceRatio) / 2) * 2);
      x = Math.round((1920 - outWidth) / 2); y = 0;
    }
    return { x: x, y: y, width: outWidth, height: outHeight };
  },

  avLayout: function () {
    if (this.displayRect) {
      return {
        method: 'PLAYER_DISPLAY_MODE_FULL_SCREEN',
        rect: this.nativeDisplayRect(), strategy: '16:9 kucuk on izleme'
      };
    }
    var mode = this.normalizeAspect(this.aspect);
    /* AU8000/Tizen 6.0, ekran disina tasan negatif AVPlay koordinatlarini
       kabul edilmis gibi raporlasa da kirpma uygulamiyor. Bu iki modda
       guvenli otomatik yerlesimi koru; arayuz kullaniciyi HTML5'e yonlendirir. */
    if (this.isUnsupportedAvCrop(mode)) {
      return {
        method: 'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO',
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        strategy: 'AVPlay kirpma desteklenmiyor · guvenli otomatik', unsupported: true
      };
    }
    var layouts = {
      ratio16x9: { x: 0, y: 0, width: 1920, height: 1080, strategy: 'zorunlu 16:9' },
      ratio4x3: { x: 240, y: 0, width: 1440, height: 1080, strategy: 'zorunlu 4:3' },
      cinema21x9: { x: 0, y: 128, width: 1920, height: 825, strategy: 'zorunlu 21:9 sinema' }
    };
    if (layouts[mode]) {
      return { method: 'PLAYER_DISPLAY_MODE_FULL_SCREEN', rect: layouts[mode], strategy: layouts[mode].strategy };
    }
    return { method: 'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO',
      rect: { x: 0, y: 0, width: 1920, height: 1080 }, strategy: 'yerel otomatik' };
  },

  applyAvLayout: function () {
    if (this.resolvedAvCompatibility() !== 'standard') {
      return this.applyLegacyAvLayout('yerlesim uygulamasi');
    }
    var plan = this.avLayout(), method = plan.fallbackMethod || plan.method;
    var methodOk = true, rectOk = true, methodError = null, rectError = null;
    /* AU8000 icin kritik sira: once goruntu yontemi, sonra hedef alan.
       Ters sira kabul edilse de ikinci komut kucuk alani bozabiliyor. */
    try { webapis.avplay.setDisplayMethod(method); }
    catch (e) { methodOk = false; methodError = e; }
    try {
      webapis.avplay.setDisplayRect(plan.rect.x, plan.rect.y, plan.rect.width, plan.rect.height);
    } catch (e2) { rectOk = false; rectError = e2; }
    Diag.set('AVPlay goruntu modu', this.aspectLabel(this.aspect) + (this.displayRect ? ' · On izleme' : ''));
    Diag.set('AVPlay yerlesim', plan.strategy + ' · ' +
      [plan.rect.x, plan.rect.y, plan.rect.width, plan.rect.height].join(' / '));
    Diag.set('AVPlay oran komutu', methodOk
      ? method + ' · kabul edildi'
      : 'Hata: ' + methodError.name + ' · ' + methodError.message);
    Diag.set('AVPlay alan komutu', rectOk
      ? [plan.rect.x, plan.rect.y, plan.rect.width, plan.rect.height].join(' / ') + ' · kabul edildi'
      : 'Hata: ' + rectError.name + ' · ' + rectError.message);
    this.lastAspectApplied = methodOk && rectOk && !plan.unsupported;
    return this.lastAspectApplied;
  },

  applyLegacyAvLayout: function (stage) {
    var plan = this.avLayout(), method = plan.fallbackMethod || plan.method;
    var methodOk = true, rectOk = true, methodError = null, rectError = null;
    var rect = plan.rect;
    this._viewportApplyCount++;
    /* Eski AVPlay katmaninda DOM alani ile yerel alan ayni karede degismeli.
       Once CSS yerlesimini kesinlestir, sonra setDisplayMethod'in alani geri
       almasina karsi dikdortgeni komuttan once ve sonra uygula. */
    this.applyViewportStyles();
    try {
      var av = this.els().av;
      if (av && typeof av.offsetWidth !== 'undefined') { var layoutFlush = av.offsetWidth; }
    } catch (layoutError) { }
    try { webapis.avplay.setDisplayRect(rect.x, rect.y, rect.width, rect.height); }
    catch (e) { rectOk = false; rectError = e; }
    try { webapis.avplay.setDisplayMethod(method); }
    catch (e2) { methodOk = false; methodError = e2; }
    try { webapis.avplay.setDisplayRect(rect.x, rect.y, rect.width, rect.height); }
    catch (e3) { rectOk = false; rectError = e3; }
    Diag.set('AVPlay goruntu modu', this.aspectLabel(this.aspect) + (this.displayRect ? ' · On izleme' : ''));
    Diag.set('AVPlay yerlesim', plan.strategy + ' · ' +
      [rect.x, rect.y, rect.width, rect.height].join(' / '));
    Diag.set('AVPlay eski TV uygulamasi', this._viewportApplyCount + ' · ' + (stage || 'uygulandi'));
    Diag.set('AVPlay oran komutu', methodOk
      ? method + ' · kabul edildi'
      : 'Hata: ' + methodError.name + ' · ' + methodError.message);
    Diag.set('AVPlay alan komutu', rectOk
      ? [rect.x, rect.y, rect.width, rect.height].join(' / ') + ' · iki kez kabul edildi'
      : 'Hata: ' + rectError.name + ' · ' + rectError.message);
    this.lastAspectApplied = methodOk && rectOk && !plan.unsupported;
    return this.lastAspectApplied;
  },

  applyAspect: function () {
    var mode = this.normalizeAspect(this.aspect);
    this.aspect = mode;
    try {
      if (this.engine === 'avplay' && this.hasAvplay()) {
        return this.applyAvLayout();
      } else {
        var v = this.els().v;
        if (this.displayRect) {
          this.setNodeRect(v, this.displayRect);
          v.style.objectFit = 'fill';
        } else {
          var htmlLayouts = {
            ratio16x9: { x: 0, y: 0, width: 1920, height: 1080 },
            ratio4x3: { x: 240, y: 0, width: 1440, height: 1080 },
            zoom4x3: { x: 0, y: -180, width: 1920, height: 1440 },
            cinema21x9: { x: 0, y: 128, width: 1920, height: 825 },
            zoom21x9: { x: -300, y: 0, width: 2520, height: 1080 }
          };
          this.setNodeRect(v, htmlLayouts[mode] || { x: 0, y: 0, width: 1920, height: 1080 });
          v.style.objectFit = mode === 'auto' ? 'contain' : 'fill';
        }
        Diag.set('HTML5 goruntu modu', this.aspectLabel(mode));
      }
      this.lastAspectApplied = true;
      return true;
    } catch (e) {
      this.lastAspectApplied = false;
      if (this.engine === 'avplay') Diag.set('AVPlay oran komutu', 'Hata: ' + e.name + ' · ' + e.message);
      Diag.add('Goruntu formati uygulanamadi: ' + e.message);
      return false;
    }
  },

  cycleAspect: function () {
    this.aspect = this.nextAspect(this.aspect);
    Settings.set('aspect', this.aspect);
    this.lastAspectApplied = this.applyAspect();
    return this.aspectLabel(this.aspect);
  },

  setAspect: function (mode, persistKey) {
    mode = this.normalizeAspect(mode);
    if (this.isUnsupportedAvCrop(mode)) {
      this.lastAspectApplied = false;
      Diag.set('AVPlay goruntu modu', this.aspectLabel(mode) + ' · bu cihazda desteklenmiyor');
      return this.aspectLabel(mode);
    }
    this.aspect = mode;
    if (persistKey) Settings.set(persistKey, this.aspect);
    this.lastAspectApplied = this.applyAspect();
    return this.aspectLabel(this.aspect);
  },

  /* --- gomulu ses ve altyazi parcalari --- */

  emptyTracks: function () {
    return {
      engine: this.engine || '', supported: false,
      audioSupported: false, textSupported: false,
      audio: [], text: [], currentAudio: null, currentText: null,
      subtitlesOff: true
    };
  },

  parseTrackInfo: function (value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (e) { return {}; }
  },

  trackInfoValue: function (primary, secondary, names) {
    var sources = [primary || {}, secondary || {}];
    for (var s = 0; s < sources.length; s++) {
      var source = sources[s];
      for (var key in source) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        var normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
        for (var n = 0; n < names.length; n++) {
          if (normalized === String(names[n]).toLowerCase().replace(/[^a-z0-9]/g, '') && source[key] != null) {
            return source[key];
          }
        }
      }
    }
    return '';
  },

  normalizeLanguage: function (value) {
    var code = String(value || '').toLowerCase().replace(/_/g, '-').split('-')[0];
    var aliases = {
      tur: 'tr', tr: 'tr', eng: 'en', en: 'en', deu: 'de', ger: 'de', de: 'de',
      fra: 'fr', fre: 'fr', fr: 'fr', spa: 'es', es: 'es', ita: 'it', it: 'it',
      ara: 'ar', ar: 'ar', rus: 'ru', ru: 'ru', nld: 'nl', dut: 'nl', nl: 'nl',
      por: 'pt', pt: 'pt', und: 'und', unk: 'und'
    };
    return aliases[code] || code || 'und';
  },

  languageLabel: function (code) {
    return {
      tr: 'Türkçe', en: 'İngilizce', de: 'Almanca', fr: 'Fransızca',
      es: 'İspanyolca', it: 'İtalyanca', ar: 'Arapça', ru: 'Rusça',
      nl: 'Felemenkçe', pt: 'Portekizce', und: 'Dil belirtilmemiş'
    }[code] || String(code || 'Dil belirtilmemiş').toUpperCase();
  },

  makeTrack: function (info, type, order, currentInfo) {
    var extra = this.parseTrackInfo(info && info.extra_info);
    var currentExtra = this.parseTrackInfo(currentInfo && currentInfo.extra_info);
    var rawLang = this.trackInfoValue(extra, currentExtra,
      ['track_lang', 'track_language', 'language', 'lang', 'srclang']);
    var lang = this.normalizeLanguage(rawLang);
    var label = type === 'text' && lang === 'und' ? 'Altyazi ' + (order + 1) : this.languageLabel(lang);
    var codec = String(this.trackInfoValue(extra, currentExtra, ['fourCC', 'codec', 'codec_name']) || '').toUpperCase();
    if (type === 'audio') {
      var channels = parseInt(this.trackInfoValue(extra, currentExtra, ['channels', 'channel_count']), 10);
      if (channels === 1) label += ' · Mono';
      else if (channels === 2) label += ' · Stereo';
      else if (channels >= 6) label += ' · 5.1';
      if (codec) label += ' · ' + codec;
    }
    return {
      index: info && info.index != null ? info.index : order,
      sourceIndex: order,
      lang: lang,
      label: label,
      preferenceKey: lang !== 'und' ? 'lang:' + lang : (type === 'text' ? 'track:' + order : 'label:' + norm(label)),
      codec: codec
    };
  },

  makeHtmlTrack: function (track, type, order) {
    var raw = track && (track.language || track.srclang || '');
    var lang = this.normalizeLanguage(raw);
    var named = lang === 'und'
      ? (type === 'audio' ? 'Ses ' : 'Altyazi ') + (order + 1)
      : this.languageLabel(lang);
    return {
      index: order, sourceIndex: order, lang: lang, label: named || (type === 'audio' ? 'Ses ' + (order + 1) : 'Altyazı ' + (order + 1)),
      preferenceKey: lang !== 'und' ? 'lang:' + lang : (type === 'text' ? 'track:' + order : 'label:' + norm(named || String(order)))
    };
  },

  refreshTracks: function () {
    var result = this.emptyTracks();
    try {
      if (this.engine === 'avplay' && this.hasAvplay()) {
        var total = webapis.avplay.getTotalTrackInfo() || [];
        var current = webapis.avplay.getCurrentStreamInfo() || [];
        var currentAudio = null, currentText = null, currentByIndex = {};
        for (var c = 0; c < current.length; c++) {
          var currentType = String(current[c].type || '').toUpperCase();
          currentByIndex[String(current[c].index)] = current[c];
          if (currentType === 'AUDIO' && current[c].index >= 0) currentAudio = current[c].index;
          if (currentType === 'TEXT' && current[c].index >= 0) currentText = current[c].index;
        }
        for (var i = 0; i < total.length; i++) {
          var type = String(total[i].type || '').toUpperCase();
          if (type === 'AUDIO') result.audio.push(this.makeTrack(total[i], 'audio', result.audio.length, currentByIndex[String(total[i].index)]));
          if (type === 'TEXT') result.text.push(this.makeTrack(total[i], 'text', result.text.length, currentByIndex[String(total[i].index)]));
        }
        result.supported = true;
        result.audioSupported = true;
        result.textSupported = true;
        result.currentAudio = currentAudio != null ? currentAudio : (result.audio[0] ? result.audio[0].index : null);
        result.currentText = currentText;
        result.subtitlesOff = this.subtitleMuted === true || currentText == null;
      } else {
        var video = this.els().v;
        var audioTracks = video.audioTracks;
        var textTracks = video.textTracks;
        result.audioSupported = !!audioTracks;
        result.textSupported = !!textTracks;
        result.supported = result.audioSupported || result.textSupported;
        if (audioTracks) {
          for (var a = 0; a < audioTracks.length; a++) {
            result.audio.push(this.makeHtmlTrack(audioTracks[a], 'audio', a));
            if (audioTracks[a].enabled) result.currentAudio = a;
          }
        }
        if (textTracks) {
          for (var t = 0; t < textTracks.length; t++) {
            result.text.push(this.makeHtmlTrack(textTracks[t], 'text', t));
            if (textTracks[t].mode === 'showing' || textTracks[t].mode === 'hidden') result.currentText = t;
          }
        }
        result.subtitlesOff = result.currentText == null;
      }
    } catch (e) {
      Diag.add('Ses/altyazi parcalari okunamadi: ' + e.message);
    }
    this.tracks = result;
    this._decorateSoftwareTracks();
    this._applyLearnedTrackLabels();
    this._numberTextTracks();
    this._rememberTrackLabels();
    Diag.set('Medya parcalari', result.audio.length + ' ses / ' + result.text.length + ' altyazi');
    return result;
  },

  _applyLearnedTrackLabels: function () {
    if (typeof TrackLabels === 'undefined' || !this.cb || !this.cb.subtitleCacheKey || !this.tracks) return;
    var learned = TrackLabels.get(this.cb.subtitleCacheKey);
    if (!learned) return;
    var groups = [{ list: this.tracks.audio, langs: learned.audio }, { list: this.tracks.text, langs: learned.text }];
    for (var g = 0; g < groups.length; g++) {
      for (var i = 0; i < groups[g].list.length; i++) {
        var item = groups[g].list[i], lang = this.normalizeLanguage(groups[g].langs && groups[g].langs[item.sourceIndex]);
        if (item.lang !== 'und' || lang === 'und') continue;
        item.lang = lang;
        item.label = this.languageLabel(lang);
        item.preferenceKey = 'lang:' + lang;
      }
    }
  },

  _rememberTrackLabels: function () {
    if (typeof TrackLabels === 'undefined' || !this.cb || !this.cb.subtitleCacheKey || !this.tracks) return;
    function langs(list) {
      var out = [];
      for (var i = 0; i < list.length; i++) out[list[i].sourceIndex] = list[i].lang || 'und';
      return out;
    }
    TrackLabels.set(this.cb.subtitleCacheKey, langs(this.tracks.audio), langs(this.tracks.text));
  },

  _decorateSoftwareTracks: function () {
    if (!this.tracks || !this._softwareSubInfo || !this._softwareSubInfo.tracks) return;
    var source = this._softwareSubInfo.tracks;
    var used = {};
    for (var i = 0; i < this.tracks.text.length; i++) {
      var item = this.tracks.text[i];
      var match = null;
      for (var n = 0; n < source.length; n++) {
        if (used[n]) continue;
        if (this.normalizeLanguage(source[n].lang) === item.lang) { match = source[n]; used[n] = true; break; }
      }
      if (!match && source[item.sourceIndex] && !used[item.sourceIndex]) {
        match = source[item.sourceIndex]; used[item.sourceIndex] = true;
      }
      if (!match) continue;
      item.softwareIndex = match.sourceIndex;
      item.softwareCodec = 'tx3g';
      if (item.lang === 'und' && this.normalizeLanguage(match.lang) !== 'und') {
        item.lang = this.normalizeLanguage(match.lang);
        item.label = this.languageLabel(item.lang);
        item.preferenceKey = 'lang:' + item.lang;
      }
    }
  },

  _numberTextTracks: function () {
    if (!this.tracks || !this.tracks.text) return;
    var totals = {}, seen = {};
    for (var i = 0; i < this.tracks.text.length; i++) {
      var lang = this.tracks.text[i].lang || 'und';
      totals[lang] = (totals[lang] || 0) + 1;
    }
    for (var n = 0; n < this.tracks.text.length; n++) {
      var item = this.tracks.text[n];
      seen[item.lang] = (seen[item.lang] || 0) + 1;
      if (totals[item.lang] > 1) {
        item.label = this.languageLabel(item.lang) + ' ' + seen[item.lang];
        item.preferenceKey = 'lang:' + item.lang + ':' + seen[item.lang];
      }
    }
  },

  trackByIndex: function (type, index) {
    var list = this.tracks && this.tracks[type] ? this.tracks[type] : [];
    for (var i = 0; i < list.length; i++) if (String(list[i].index) === String(index)) return list[i];
    return null;
  },

  trackByPreference: function (type, key) {
    var list = this.tracks && this.tracks[type] ? this.tracks[type] : [];
    if (key === 'auto') return list.length ? list[0] : null;
    for (var i = 0; i < list.length; i++) if (list[i].preferenceKey === key) return list[i];
    /* v1.7 ve oncesinde ayni dildeki birden cok altyazi numaralanmiyordu. */
    var oldLang = String(key || '').match(/^lang:([a-z]{2,3})$/);
    if (oldLang) {
      for (var n = 0; n < list.length; n++) if (list[n].lang === oldLang[1]) return list[n];
    }
    var positional = String(key || '').match(/^track:(\d+)$/);
    if (positional && list[parseInt(positional[1], 10)]) return list[parseInt(positional[1], 10)];
    return null;
  },

  subtitleStrategyMode: function () {
    try {
      if (this.cb.resolveSubtitleStrategy) {
        var resolved = this.cb.resolveSubtitleStrategy(this.engine);
        if (resolved && resolved.mode) return resolved.mode;
      }
    } catch (e) { }
    return this.cb.subtitleStrategyMode || 'unknown';
  },

  _markNativeSubtitleSuccess: function () {
    if (this._nativeSubtitleProven || this.live) return;
    this._nativeSubtitleProven = true;
    this.softwareSubtitleStatus = '';
    Diag.set('Altyazi yolu', 'Yerlesik · dogrulandi');
    if (this.cb.onNativeSubtitle) this.cb.onNativeSubtitle(this.engine);
    if (this.cb.onSubtitleStatus) this.cb.onSubtitleStatus('Yerlesik altyazi dogrulandi');
  },

  _markSoftwareSubtitleSuccess: function () {
    Diag.set('Altyazi yolu', 'TX3G uyumluluk');
    if (this.cb.onSoftwareSubtitle) this.cb.onSoftwareSubtitle(this.engine, this._softwareSubInfo);
  },

  selectAudio: function (index) {
    var track = this.trackByIndex('audio', index);
    if (!track) return false;
    try {
      if (this.engine === 'avplay') {
        try {
          webapis.avplay.setSelectTrack('AUDIO', track.index);
        } catch (firstError) {
          /* Tizen AUDIO degisimini PAUSED durumunda reddedebilir. Kisa sure
             oynatip secimi uygula, ardindan onceki duruma don. */
          if (!this.paused) throw firstError;
          webapis.avplay.play();
          webapis.avplay.setSelectTrack('AUDIO', track.index);
          webapis.avplay.pause();
        }
      } else {
        var list = this.els().v.audioTracks;
        if (!list) return false;
        for (var i = 0; i < list.length; i++) list[i].enabled = i === track.sourceIndex;
      }
      this.tracks.currentAudio = track.index;
      Diag.set('Secili ses', track.label);
      return true;
    } catch (e) {
      Diag.add('Ses parcasi secilemedi: ' + e.message);
      return false;
    }
  },

  selectSubtitle: function (index) {
    var off = index === 'off' || index == null;
    var track = off ? null : this.trackByIndex('text', index);
    if (!off && !track) return false;
    this._requestedSubtitlePreference = off ? 'off' : track.preferenceKey;
    this.cb.subtitlePreference = this._requestedSubtitlePreference;
    if (this._nativeReselectTimer) { clearTimeout(this._nativeReselectTimer); this._nativeReselectTimer = null; }
    this._nativeReselectBufferDone = false;
    this._nativeReselectPlaytimeDone = false;
    var strategyMode = this.subtitleStrategyMode();

    /* Daha once sorunlu oldugu ogrenilen kaynakta ilk secimde guvenli TX3G
       yoluna gec. Bilinmeyen kaynakta yerlesik yol beklemesiz denenir;
       uyumluluk incelemesini yalnizca menudeki acik kullanici eylemi baslatir. */
    if (!off && !this._softwareSubInfo && !this.live && this._engineStarted && this._readyAt) {
      if (strategyMode === 'software') {
        this.subtitleMuted = false;
        this.tracks.subtitlesOff = false;
        this.tracks.currentText = track.index;
        this._emitSubtitle('');
        this._prepareUnknownTrackSafely(track);
        Diag.set('Secili altyazi', track.label);
        return true;
      }
    }
    var software = !off && this._softwareSubInfo && track.softwareIndex != null;
    try {
      if (this.engine === 'avplay') {
        if (off) {
          webapis.avplay.setSilentSubtitle(true);
        } else if (software) {
          /* TX3G metnini uygulama cizer; yerlesik katmani sessiz tut. */
          webapis.avplay.setSilentSubtitle(true);
        } else {
          webapis.avplay.setSelectTrack('TEXT', track.index);
          /* Tizen 6.0 bu akista onsubtitlechange olayi uretmiyor. Samsung API'sine
             gore false altyaziyi AVPlay'in kendi katmaninda dogrudan gosterir. */
          webapis.avplay.setSilentSubtitle(false);
        }
      } else {
        var list = this.els().v.textTracks;
        if (!list) return false;
        for (var i = 0; i < list.length; i++) {
          list[i].mode = (!software && !off && i === track.sourceIndex) ? 'hidden' : 'disabled';
        }
        this._htmlSubtitleTrack = (off || software) ? null : list[track.sourceIndex];
        if (this._htmlSubtitleTrack) {
          var self = this;
          this._htmlSubtitleTrack.oncuechange = function () { self._renderHtmlSubtitle(self._htmlSubtitleTrack); };
        }
      }
      this.subtitleMuted = off;
      this.tracks.subtitlesOff = off;
      this.tracks.currentText = off ? null : track.index;
      this._emitSubtitle('');
      if (off) {
        this._nativeAttemptPreference = null;
        this._nativeSubtitleProven = false;
        this._cancelSoftwareSubtitle();
      } else if (!this._enableSoftwareSubtitle(track) && this.engine === 'html5') {
        this._renderHtmlSubtitle(this._htmlSubtitleTrack);
      }
      if (!off && !software) {
        this._nativeAttemptPreference = track.preferenceKey;
        /* Profil yerlesik yolu onerse de bu icerigi ancak gercek bir cue/metin
           olayi geldiginde dogrulanmis say. Boylece tekil kaynak istisnasinda
           uyumluluk eylemi kullanilabilir kalir. */
        this._nativeSubtitleProven = false;
        this.softwareSubtitleStatus = strategyMode === 'unknown'
          ? 'Yerlesik altyazi deneniyor' : '';
        Diag.set('Altyazi yolu', strategyMode === 'unknown' ? 'Yerlesik · dogrulama bekleniyor' : 'Yerlesik');
      }
      Diag.set('Secili altyazi', off ? 'Kapali' : track.label);
      if (off) Diag.set('Altyazi olayi', 'Kapali');
      else if (track.softwareIndex == null) {
        Diag.set('Altyazi olayi', this.engine === 'avplay' ? 'AVPlay yerlesik gosterim etkin' : 'HTML5 cue bekleniyor');
      }
      return true;
    } catch (e) {
      Diag.add('Altyazi parcasi secilemedi: ' + e.message);
      return false;
    }
  },

  canStartSubtitleCompatibility: function () {
    if (this.live || this._preparing || !this._engineStarted || !this._readyAt) return false;
    if (!this.tracks || this.tracks.subtitlesOff || this.tracks.currentText == null) return false;
    var track = this.trackByIndex('text', this.tracks.currentText);
    return !!track;
  },

  showSubtitleCompatibilityAction: function () {
    return !this.live && !!(this.tracks && this.tracks.text && this.tracks.text.length);
  },

  subtitleCompatibilityBusy: function () {
    return !!(this._preparing || this._softwareInspecting || this._softwareLoadingIndex != null);
  },

  startSubtitleCompatibility: function () {
    if (!this.canStartSubtitleCompatibility()) return false;
    var track = this.trackByIndex('text', this.tracks.currentText);
    if (!track) return false;
    /* Eylem panelde daima kalir. Yazilimsal altyazi zaten calisiyorsa tekrar
       secim, kaynagi yeniden inceler; varsa dogrulanmis cihaz onbellegi hizli
       bicimde yeniden kullanilir. */
    if (this._softwareSubtitleTrack) {
      this._softwareSubInfo = null;
      this._softwareSubtitleTrack = null;
      this._softwareSubtitleCues = null;
      this._softwareLastText = '';
      this._emitSubtitle('');
    }
    this._requestedSubtitlePreference = track.preferenceKey;
    this.cb.subtitlePreference = track.preferenceKey;
    this.subtitleMuted = false;
    this.tracks.subtitlesOff = false;
    this.softwareSubtitleStatus = 'Altyazi uyumluluk modu baslatiliyor';
    Diag.set('Altyazi yolu', 'Kullanici TX3G uyumluluk islemini baslatti');
    this._prepareUnknownTrackSafely(track);
    return true;
  },

  trackSummary: function () {
    var state = this.tracks || this.emptyTracks();
    var audio = this.trackByIndex('audio', state.currentAudio);
    var text = state.subtitlesOff ? null : this.trackByIndex('text', state.currentText);
    return {
      audio: audio ? audio.label : (state.audio.length ? 'Varsayilan ses' : 'Ses bilgisi yok'),
      text: state.subtitlesOff ? 'Kapali' : (text ? text.label : 'Varsayilan altyazi')
    };
  },

  _infoValue: function (object, names) {
    object = object || {};
    for (var key in object) {
      if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
      var normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      for (var i = 0; i < names.length; i++) {
        if (normalized === String(names[i]).toLowerCase().replace(/[^a-z0-9]/g, '')) return object[key];
      }
    }
    return null;
  },

  playbackStats: function () {
    var out = {
      engine: this.engine || '-', format: this.cb.format || (this.live ? 'canli' : 'vod'),
      state: this._buffering ? 'Tamponluyor' : (this.paused ? 'Duraklatildi' : 'Oynuyor'),
      width: 0, height: 0, videoCodec: '', audioCodec: '', bitrate: 0, audioBitrate: 0,
      bandwidth: 0, decodedRate: this._decodedRateBps || 0, fps: this._decodedFps || 0,
      networkDownlink: 0
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.connection && navigator.connection.downlink) {
        out.networkDownlink = Number(navigator.connection.downlink) * 1000000;
      }
    } catch (e) { }
    try {
      if (this.engine === 'avplay' && this.hasAvplay()) {
        var streams = webapis.avplay.getCurrentStreamInfo() || [];
        for (var i = 0; i < streams.length; i++) {
          var extra = this.parseTrackInfo(streams[i].extra_info);
          var type = String(streams[i].type || '').toUpperCase();
          if (type === 'VIDEO') {
            out.width = parseInt(this._infoValue(extra, ['width']), 10) || out.width;
            out.height = parseInt(this._infoValue(extra, ['height']), 10) || out.height;
            out.videoCodec = String(this._infoValue(extra, ['fourCC', 'codec']) || '');
            out.bitrate = parseInt(this._infoValue(extra, ['Bit_rate', 'bitrate']), 10) || out.bitrate;
          } else if (type === 'AUDIO') {
            out.audioCodec = String(this._infoValue(extra, ['fourCC', 'codec']) || '');
            out.audioBitrate = parseInt(this._infoValue(extra, ['bit_rate', 'bitrate']), 10) || 0;
          }
        }
        if ((!out.width || !out.height) && webapis.avplay.getVideoSize) {
          var size = webapis.avplay.getVideoSize();
          out.width = parseInt(size && (size.width || size.Width), 10) || out.width;
          out.height = parseInt(size && (size.height || size.Height), 10) || out.height;
        }
        try {
          out.bandwidth = parseInt(webapis.avplay.getStreamingProperty('CURRENT_BANDWIDTH'), 10) || 0;
        } catch (bandwidthError) { }
      } else {
        var video = this.els().v;
        out.width = Number(video.videoWidth) || 0;
        out.height = Number(video.videoHeight) || 0;
      }
    } catch (e) {
      Diag.add('Oynatma istatistigi okunamadi: ' + e.message);
    }
    return out;
  },

  cleanSubtitleText: function (value) {
    var text = String(value == null ? '' : value);
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/\\N/g, '\n');
    text = text.replace(/\{[^}]*\}/g, '').replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"');
    return text.trim();
  },

  _emitSubtitle: function (text, duration) {
    if (this._subtitleTimer) { clearTimeout(this._subtitleTimer); this._subtitleTimer = null; }
    var cleaned = this.subtitleMuted === true ? '' : this.cleanSubtitleText(text);
    if (this.cb.onSubtitle) this.cb.onSubtitle(cleaned);
    var ms = parseInt(duration, 10);
    if (cleaned && ms > 0) {
      ms = Math.max(500, Math.min(30000, ms));
      var self = this;
      this._subtitleTimer = setTimeout(function () {
        self._subtitleTimer = null;
        if (self.cb.onSubtitle) self.cb.onSubtitle('');
      }, ms);
    }
  },

  _renderHtmlSubtitle: function (track) {
    if (!track || this.subtitleMuted === true) { this._emitSubtitle(''); return; }
    var cues = track.activeCues || [];
    var lines = [];
    for (var i = 0; i < cues.length; i++) if (cues[i] && cues[i].text) lines.push(cues[i].text);

    /* Bazi eski Chromium surumleri hidden text track icin activeCues'u
       doldurmuyor, ancak tum cue listesini veriyor. Zaman araligindan bul. */
    if (!lines.length && track.cues && track.cues.length) {
      var now = Number(this.els().v.currentTime) || 0;
      for (var j = 0; j < track.cues.length; j++) {
        var cue = track.cues[j];
        if (cue && cue.text && Number(cue.startTime) <= now && now < Number(cue.endTime)) lines.push(cue.text);
      }
    }
    if (lines.length) this._markNativeSubtitleSuccess();
    Diag.set('Altyazi olayi', lines.length ? 'HTML5 metin alindi' : 'HTML5 cue bekleniyor');
    this._emitSubtitle(lines.join('\n'));
  },

  _emitPreparation: function (data) {
    data = data || {};
    data.container = data.container || (this._softwareSubInfo && this._softwareSubInfo.kind) || '';
    if (!data.subtitleType && this._softwareSubInfo) {
      data.subtitleType = this._softwareSubInfo.kind === 'mp4' && this._softwareSubInfo.tracks.length
        ? 'TX3G' : 'Yerlesik';
    }
    if (this.cb.onPreparation) this.cb.onPreparation(data);
  },

  _sourceTrackByPreference: function (key) {
    var tracks = this._softwareSubInfo && this._softwareSubInfo.tracks;
    if (!tracks || !tracks.length || !key || key === 'off') return null;
    var match = String(key).match(/^lang:([a-z]{2,3})(?::(\d+))?$/);
    if (match) {
      var wantedLang = this.normalizeLanguage(match[1]);
      var wantedOrder = parseInt(match[2] || '1', 10), seen = 0;
      for (var i = 0; i < tracks.length; i++) {
        if (this.normalizeLanguage(tracks[i].lang) === wantedLang && ++seen === wantedOrder) return tracks[i];
      }
    }
    var positional = String(key).match(/^track:(\d+)$/);
    if (positional && tracks[parseInt(positional[1], 10)]) return tracks[parseInt(positional[1], 10)];
    return tracks[0];
  },

  _restoreSubtitleCache: function (sourceTrack) {
    if (!sourceTrack || sourceTrack.cues || typeof SubtitleCache === 'undefined') return !!(sourceTrack && sourceTrack.cues);
    /* Eski surumler eksik indirmeleri de tamamlanmis olarak kaydedebiliyordu. */
    if (String(sourceTrack.signature || '').indexOf('v2:') !== 0) return false;
    var cues = SubtitleCache.get(this.cb.subtitleCacheKey, sourceTrack.sourceIndex, sourceTrack.signature);
    if (!cues || !cues.length) return false;
    sourceTrack.cues = cues;
    Diag.set('Altyazi onbellegi', cues.length + ' satir cihazdan yuklendi');
    return true;
  },

  _storeSubtitleCache: function (sourceTrack, cues) {
    if (!sourceTrack || typeof SubtitleCache === 'undefined') return;
    if (SubtitleCache.set(this.cb.subtitleCacheKey, sourceTrack.sourceIndex, sourceTrack.signature, cues)) {
      Diag.set('Altyazi onbellegi', cues.length + ' satir kaydedildi');
    }
  },

  _loadSourceTrack: function (sourceIndex, token) {
    var self = this;
    var sourceTrack = this._softwareSubInfo && this._softwareSubInfo.tracks[sourceIndex];
    if (!sourceTrack) return Promise.reject(new Error('TX3G parcasi bulunamadi'));
    if (this._restoreSubtitleCache(sourceTrack)) {
      this._emitPreparation({ stage: 'cached', progress: 100, done: sourceTrack.cues.length,
        total: sourceTrack.cues.length, track: this.languageLabel(this.normalizeLanguage(sourceTrack.lang)) });
      this._markSoftwareSubtitleSuccess();
      return Promise.resolve(sourceTrack.cues);
    }
    var loadId = ++this._softwareLoadId;
    var started = Date.now();
    this._softwareLoadingIndex = sourceIndex;
    this.softwareSubtitleStatus = 'Altyazi hazirlaniyor · %0';
    return Tx3gSubtitles.loadTrack(this._softwareSubInfo, sourceIndex, function (done, total, status) {
      if (token !== self._sessionId || loadId !== self._softwareLoadId) return;
      var pct = total ? Math.floor(done / total * 100) : 0;
      var elapsed = Date.now() - started;
      status = status || {};
      var newlyDone = done - (status.initialCompleted || 0);
      var remaining = newlyDone > 2 ? Math.ceil((elapsed / newlyDone) * (total - done) / 1000) : null;
      self._preparationProgress = pct;
      self.softwareSubtitleStatus = 'Altyazi hazirlaniyor · %' + pct;
      Diag.set('Altyazi olayi', 'TX3G tek baglanti · %' + pct);
      self._emitPreparation({ stage: status.message ? 'retry' : 'subtitle', message: status.message,
        progress: pct, done: done, total: total,
        remaining: remaining, track: self.languageLabel(self.normalizeLanguage(sourceTrack.lang)) });
    }, function () {
      return token === self._sessionId && loadId === self._softwareLoadId && !self._preparationSkip;
    }).then(function (cues) {
      if (token !== self._sessionId || loadId !== self._softwareLoadId) throw new Error('Altyazi hazirlama iptal edildi');
      self._softwareLoadingIndex = null;
      self._storeSubtitleCache(sourceTrack, cues);
      self._markSoftwareSubtitleSuccess();
      return cues;
    });
  },

  _scheduleEngineStart: function (token, delay) {
    var self = this;
    if (token !== this._sessionId || this._engineStarted || this._engineStartTimer) return;
    this._preparationError = false;
    this._emitPreparation({ stage: 'release', progress: 100 });
    this._engineStartTimer = setTimeout(function () {
      self._engineStartTimer = null;
      if (token !== self._sessionId || self._engineStarted) return;
      self._preparing = false;
      self._engineStarted = true;
      self.playing = true;
      self._readyAt = 0;
      self._pendingSeek = self._preparationResume || self.cb.startAt || 0;
      self.show(self.engine);
      self._emitPreparation({ stage: 'player', progress: 100 });
      if (self.engine === 'avplay') self._avStart(self.url, token);
      else self._h5Start(self.url, token);
      self._startTick(token);
    }, delay == null ? 800 : delay);
  },

  _preparationFailed: function (error, token) {
    if (token !== this._sessionId) return;
    if (this._preparationSkip) { this._scheduleEngineStart(token, 800); return; }
    this._preparationError = true;
    this._preparing = true;
    if (error.sourceChanged) this._softwareSubInfo = null;
    this.softwareSubtitleStatus = 'TX3G hazirlanamadi';
    Diag.add('TX3G altyazi hazirlanamadi: ' + error.message);
    this._softwareLoadingIndex = null;
    if (error.progress != null) this._preparationProgress = error.progress;
    this._emitPreparation({ stage: 'error', message: error.message,
      progress: error.progress == null ? this._preparationProgress : error.progress });
  },

  _closeEngineForPreparation: function () {
    this._stopTick();
    this._clearBufferTimer();
    this.playing = false;
    this._readyAt = 0;
    UI.spin(false);
    try {
      if (this.engine === 'avplay' && this.hasAvplay()) {
        try { webapis.avplay.stop(); } catch (e) { }
        try { webapis.avplay.close(); } catch (e) { }
      }
    } catch (e) { }
    try {
      var v = this.els().v;
      v.onerror = null; v.onplaying = null; v.onloadedmetadata = null;
      v.oncanplay = null; v.ontimeupdate = null; v.onended = null;
      v.onwaiting = null; v.onstalled = null;
      v.pause(); v.removeAttribute('src'); v.load();
    } catch (e) { }
    this._emitSubtitle('');
  },

  _prepareSelectedTrackSafely: function (track) {
    var self = this, token = this._sessionId;
    this._preparationResume = this._pos;
    this._preparationSkip = false;
    this._preparationError = false;
    this._preparationProgress = 0;
    this._preparing = true;
    this._engineStarted = false;
    this._softwareDesiredIndex = track.index;
    this._closeEngineForPreparation();
    this._emitPreparation({ stage: 'closing', container: 'mp4', subtitleType: 'TX3G' });
    setTimeout(function () {
      if (token !== self._sessionId || self._preparationSkip) {
        if (token === self._sessionId) self._scheduleEngineStart(token, 800);
        return;
      }
      self._loadSourceTrack(track.softwareIndex, token).then(function () {
        self._scheduleEngineStart(token, 800);
      })['catch'](function (error) { self._preparationFailed(error, token); });
    }, 650);
  },

  _prepareUnknownTrackSafely: function (track) {
    var self = this, token = this._sessionId;
    var preference = track.preferenceKey;
    this._preparationResume = this._pos;
    this._preparationSkip = false;
    this._preparationError = false;
    this._preparationProgress = 0;
    this._preparing = true;
    this._engineStarted = false;
    this._softwareInspecting = true;
    this._softwareDesiredIndex = track.index;
    this._closeEngineForPreparation();
    this._emitPreparation({ stage: 'closing', message: 'Altyazi secimi icin mevcut medya baglantisi kapatiliyor' });
    setTimeout(function () {
      if (token !== self._sessionId) return;
      if (self._preparationSkip) { self._softwareInspecting = false; self._scheduleEngineStart(token, 800); return; }
      self._emitPreparation({ stage: 'inspect', progress: null });
      Diag.set('Altyazi uyumlulugu', 'Kullanici seciminden sonra kaynak inceleniyor');
      Tx3gSubtitles.inspect(self.url, function () {
        return token === self._sessionId && !self._preparationSkip;
      }).then(function (info) {
        if (token !== self._sessionId) return;
        self._softwareInspecting = false;
        self._softwareSubInfo = info || { kind: 'other', tracks: [] };
        var kind = self._softwareSubInfo.kind || 'other';
        if (kind === 'matroska') {
          Diag.set('Altyazi uyumlulugu', 'MKV · yerlesik oynatici');
          self._emitPreparation({ stage: 'detected', container: 'matroska', subtitleType: 'Yerlesik' });
        } else if (kind === 'mp4' && info.tracks.length) {
          Diag.set('Altyazi uyumlulugu', info.tracks.length + ' TX3G parcasi');
          self._emitPreparation({ stage: 'detected', container: 'mp4', subtitleType: 'TX3G',
            trackCount: info.tracks.length });
        } else {
          Diag.set('Altyazi uyumlulugu', kind === 'mp4' ? 'MP4 · yerlesik oynatici' : 'Bilinmeyen kapsayici');
          self._emitPreparation({ stage: 'detected', container: kind, subtitleType: 'Yerlesik' });
        }
        if (self._preparationSkip) { self._scheduleEngineStart(token, 800); return; }
        var source = self._sourceTrackByPreference(preference);
        if (!source || kind !== 'mp4') { self._scheduleEngineStart(token, 800); return; }
        return self._loadSourceTrack(source.sourceIndex, token).then(function () {
          self._scheduleEngineStart(token, 800);
        })['catch'](function (error) { self._preparationFailed(error, token); });
      })['catch'](function (error) {
        if (token !== self._sessionId) return;
        self._softwareInspecting = false;
        Diag.add('Kaynak incelemesi tamamlanamadi: ' + error.message);
        self._preparationFailed(error, token);
      });
    }, 650);
  },

  skipSubtitlePreparation: function () {
    if (!this._preparing) return false;
    this._preparationSkip = true;
    this._requestedSubtitlePreference = 'off';
    this.cb.subtitlePreference = 'off';
    this._softwareLoadId++;
    if (Tx3gSubtitles.cancel) Tx3gSubtitles.cancel();
    this.softwareSubtitleStatus = '';
    this._emitPreparation({ stage: 'closing', message: 'Altyazisiz oynatma hazirlaniyor' });
    if (this._preparationError) this._scheduleEngineStart(this._sessionId, 800);
    return true;
  },

  retrySubtitlePreparation: function () {
    if (!this._preparing || !this._preparationError) return false;
    var until = Tx3gSubtitles._cooldowns && Tx3gSubtitles._cooldowns[this.url];
    if (until > Date.now()) {
      this._emitPreparation({ stage: 'error', progress: this._preparationProgress,
        message: 'Yeniden denemeden once ' + Math.ceil((until - Date.now()) / 1000) + ' sn bekleyin.' });
      return true;
    }
    var track = this.trackByIndex('text', this._softwareDesiredIndex);
    if (!track) return false;
    var resume = this._preparationResume;
    if (track.softwareIndex != null && this._softwareSubInfo &&
        this._softwareSubInfo.tracks[track.softwareIndex] && !this._softwareSubInfo.tracks[track.softwareIndex].manifestOnly) {
      this._prepareSelectedTrackSafely(track);
    } else this._prepareUnknownTrackSafely(track);
    this._preparationResume = resume;
    return true;
  },

  isPreparing: function () { return this._preparing; },

  requestedSubtitlePreference: function () { return this._requestedSubtitlePreference || 'off'; },

  hasSoftwareSubtitles: function () {
    return !!(this._softwareSubInfo && this._softwareSubInfo.kind === 'mp4' && this._softwareSubInfo.tracks.length);
  },

  _cancelSoftwareSubtitle: function () {
    this._softwareLoadId++;
    this._softwareSubtitleTrack = null;
    this._softwareSubtitleCues = null;
    this._cueIndexSource = null;
    this._cueMaxEnds = null;
    this._softwareDesiredIndex = null;
    this._softwareLastText = '';
    this._softwareLoadingIndex = null;
    this.softwareSubtitleStatus = '';
  },

  _enableSoftwareSubtitle: function (track) {
    if (!track) return false;
    this._softwareDesiredIndex = track.index;
    if (!this._softwareSubInfo || track.softwareIndex == null) return false;
    var sourceIndex = track.softwareIndex;
    var sourceTrack = this._softwareSubInfo.tracks[sourceIndex];
    if (!sourceTrack) return false;
    if (this.engine === 'avplay') {
      try { webapis.avplay.setSilentSubtitle(true); } catch (e) { }
    } else {
      var nativeTracks = this.els().v.textTracks;
      if (nativeTracks) for (var i = 0; i < nativeTracks.length; i++) nativeTracks[i].mode = 'disabled';
      this._htmlSubtitleTrack = null;
    }

    if (sourceTrack.cues || this._restoreSubtitleCache(sourceTrack)) {
      this._softwareSubtitleTrack = sourceTrack;
      this._softwareSubtitleCues = sourceTrack.cues;
      this.softwareSubtitleStatus = 'TX3G yazilimsal gosterim';
      Diag.set('Altyazi olayi', 'TX3G hazir · ' + sourceTrack.cues.length + ' satir');
      this._renderSoftwareSubtitle();
      this._markSoftwareSubtitleSuccess();
      return true;
    }

    if (sourceTrack.manifestOnly || !sourceTrack.samples || !sourceTrack.samples.length) {
      /* Manifest dil ve imza bilgisini saglar. Cue cihaza kayitli degilse tam
         sample tablosunu guvenli tek baglanti incelemesiyle yeniden kur. */
      this._softwareSubInfo = null;
      this._prepareUnknownTrackSafely(track);
      return true;
    }

    if (sourceTrack.loading && this._softwareLoadingIndex === sourceIndex) return true;
    this._softwareSubtitleTrack = null;
    this._softwareSubtitleCues = null;
    this._softwareLastText = '';
    this.softwareSubtitleStatus = 'Guvenli altyazi hazirligi';
    this._prepareSelectedTrackSafely(track);
    return true;
  },

  _renderSoftwareSubtitle: function () {
    var cues = this._softwareSubtitleCues;
    if (!cues || this.subtitleMuted === true) return;
    var now = Number(this._pos) || 0;
    /* Bitis zamanlari cakisan altyazilarda sirali olmayabilir. */
    if (this._cueIndexSource !== cues) {
      this._cueIndexSource = cues;
      this._cueMaxEnds = [];
      var maxEnd = 0;
      for (var c = 0; c < cues.length; c++) {
        maxEnd = Math.max(maxEnd, cues[c].end);
        this._cueMaxEnds.push(maxEnd);
      }
    }
    var lo = 0, hi = cues.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (this._cueMaxEnds[mid] <= now) lo = mid + 1; else hi = mid;
    }
    var lines = [];
    for (var i = lo; i < cues.length && cues[i].start <= now; i++) {
      if (now < cues[i].end && cues[i].text) lines.push(cues[i].text);
    }
    var text = lines.join('\n');
    if (text === this._softwareLastText) return;
    this._softwareLastText = text;
    this._emitSubtitle(text);
  },

  prepareSubtitleRenderer: function () {
    var state = this.tracks || this.emptyTracks();
    if (state.subtitlesOff || state.currentText == null) { this.clearSubtitle(); return; }
    try {
      if (this.engine === 'avplay') {
        var selected = this.trackByIndex('text', state.currentText);
        if (selected && this._enableSoftwareSubtitle(selected)) return;
        this.subtitleMuted = false;
        webapis.avplay.setSilentSubtitle(false);
        Diag.set('Altyazi olayi', 'AVPlay yerlesik gosterim etkin');
      } else {
        this.selectSubtitle(state.currentText);
      }
    } catch (e) {
      Diag.add('Altyazi cizim katmani hazirlanamadi: ' + e.message);
    }
  },

  _scheduleNativeSubtitleReselect: function (reason) {
    if (this.live || this.engine !== 'avplay' || this.subtitleMuted === true ||
      !this.tracks || this.tracks.currentText == null || this._softwareSubtitleTrack || this._preparing) return;
    if (reason === 'buffer') {
      if (this._nativeReselectBufferDone) return;
      this._nativeReselectBufferDone = true;
    } else {
      if (this._nativeReselectPlaytimeDone) return;
      this._nativeReselectPlaytimeDone = true;
    }
    if (this._nativeReselectTimer) clearTimeout(this._nativeReselectTimer);
    var self = this, token = this._sessionId, index = this.tracks.currentText;
    this._nativeReselectTimer = setTimeout(function () {
      self._nativeReselectTimer = null;
      if (token !== self._sessionId || self.engine !== 'avplay' || self.subtitleMuted === true ||
        !self.tracks || String(self.tracks.currentText) !== String(index) || self._softwareSubtitleTrack) return;
      try {
        webapis.avplay.setSelectTrack('TEXT', index);
        webapis.avplay.setSilentSubtitle(false);
        Diag.set('Altyazi yeniden secimi', reason === 'buffer' ? 'Tamponlama sonrasi' : 'Ilk oynatma zamani');
      } catch (e) { Diag.add('Altyazi yeniden secilemedi: ' + e.message); }
    }, 200);
  },

  clearSubtitle: function () {
    if (this._subtitleTimer) { clearTimeout(this._subtitleTimer); this._subtitleTimer = null; }
    this._htmlSubtitleTrack = null;
    this._cancelSoftwareSubtitle();
    if (this.cb && this.cb.onSubtitle) this.cb.onSubtitle('');
  },

  hasAvplay: function () {
    try { return typeof webapis !== 'undefined' && webapis && !!webapis.avplay; }
    catch (e) { return false; }
  },

  enginePreference: function (live) {
    var key = live ? 'liveEngine' : 'vodEngine';
    return Settings.get(key) || Settings.get('engine') || 'auto';
  },

  pick: function (live, override) {
    if (live == null) live = this.live;
    var pref = override || this.enginePreference(!!live);
    if (pref === 'html5') return 'html5';
    if (pref === 'avplay') return this.hasAvplay() ? 'avplay' : 'html5';
    return this.hasAvplay() ? 'avplay' : 'html5';
  },

  els: function () {
    return {
      av: document.getElementById('avplayer'),
      v: document.getElementById('html5player')
    };
  },

  show: function (which) {
    var e = this.els();
    e.av.className = (which === 'avplay') ? 'on' : '';
    e.v.className = (which === 'html5') ? 'on' : '';
    this.applyViewportStyles();
    this.syncBodyClass();
  },

  hideAll: function () {
    var e = this.els();
    e.av.className = ''; e.v.className = '';
    document.body.className = '';
  },

  /* --- ana giris --- */

  play: function (url, opts) {
    opts = opts || {};
    this.stop(true);
    if (Diag.begin) Diag.begin(opts.live ? 'Canli' : 'VOD');
    var token = ++this._sessionId;
    this.paused = false;
    this.url = url;
    this.live = !!opts.live;
    this.cb = opts;
    this._pos = 0; this._dur = 0;
    this._failed = false;
    this._readyAt = 0;
    this._buffering = false;
    this._bufferingSince = 0;
    this._lastProgressAt = Date.now();
    this._lastProgressPos = 0;
    this._stallSentAt = 0;
    this._lastVideoFrames = -1;
    this._lastVideoFrameAt = Date.now();
    this._pendingSeek = opts.startAt || 0;
    this.tracks = this.emptyTracks();
    this.subtitleMuted = null;
    this._htmlSubtitleTrack = null;
    this._subtitleEventCount = 0;
    this._softwareSubInfo = null;
    this._softwareSubtitleTrack = null;
    this._softwareSubtitleCues = null;
    this._softwareDesiredIndex = null;
    this._softwareLastText = '';
    this._softwareLoadId++;
    this._softwareLoadingIndex = null;
    this._softwareInspecting = false;
    this.softwareSubtitleStatus = '';
    this._preparing = false;
    this._preparationSkip = false;
    this._preparationError = false;
    this._preparationResume = opts.startAt || 0;
    this._engineStarted = false;
    this._requestedSubtitlePreference = opts.subtitlePreference || 'off';
    this._nativeAttemptPreference = null;
    this._nativeSubtitleProven = false;
    this._statsSample = null;
    this._decodedRateBps = 0;
    this._decodedFps = 0;
    this._avVideoSize = null;
    this._sourceVideoInfo = opts.videoInfo || null;
    this._engineOverride = opts.engine === 'avplay' || opts.engine === 'html5' ? opts.engine : null;
    this._viewportApplyCount = 0;
    if (this._nativeReselectTimer) { clearTimeout(this._nativeReselectTimer); this._nativeReselectTimer = null; }
    this._nativeReselectBufferDone = false;
    this._nativeReselectPlaytimeDone = false;
    if (!this.live && opts.subtitleManifest && opts.subtitleManifest.tracks) {
      this._softwareSubInfo = {
        kind: opts.subtitleManifest.kind || 'mp4',
        sourceUrl: url,
        tracks: opts.subtitleManifest.tracks
      };
    }
    if (this._engineStartTimer) { clearTimeout(this._engineStartTimer); this._engineStartTimer = null; }
    if (this._seekTimer) { clearTimeout(this._seekTimer); this._seekTimer = null; }
    if (this._seekLockTimer) { clearTimeout(this._seekLockTimer); this._seekLockTimer = null; }
    this._seekInFlight = false;
    this._seekQueuedTarget = null;
    this._seekTarget = this._pendingSeek;
    this._seekPreviewUntil = 0;
    this.aspect = this.normalizeAspect(Settings.get(this.live ? 'liveAspect' : 'aspect') || 'auto');
    this.engine = this.pick(null, this._engineOverride);
    window.__engine = this.engine;
    Diag.set(this.live ? 'Canli motor tercihi' : 'VOD motor tercihi',
      this._engineOverride ? ('Oturum: ' + this._engineOverride) : this.enginePreference(this.live));
    Diag.set('Cozulmus oynatici', this.engine);
    if (this.engine === 'avplay') this.avCompatibilityDiagnostics('Oynatici aciliyor');
    this.playing = false;

    /* VOD her zaman hemen ve altyazisiz baslar. Kaynak incelemesi ancak
       kullanici altyazi menusunden bir parca sectiginde yapilir. */
    this._engineStarted = true;
    this.playing = true;
    this.show(this.engine);
    if (this.engine === 'avplay') this._avStart(url, token);
    else this._h5Start(url, token);
    this._startTick(token);
  },

  _fail: function (msg, canFallback) {
    if (this._failed) return;
    /* AVPlay basarisiz olduysa bir kez HTML5 ile dene */
    if (canFallback && this.engine === 'avplay' && !this._engineOverride && this.enginePreference(this.live) === 'auto') {
      Diag.add('AVPlay basarisiz, HTML5 oynaticiya gecildi: ' + msg);
      try { webapis.avplay.stop(); } catch (e) { }
      try { webapis.avplay.close(); } catch (e) { }
      this._clearBufferTimer();
      this._buffering = false;
      this.engine = 'html5';
      this._readyAt = 0;
      this.tracks = this.emptyTracks();
      this.subtitleMuted = null;
      this.clearSubtitle();
      window.__engine = 'html5';
      this.show('html5');
      this._h5Start(this.url, this._sessionId);
      return;
    }
    this._failed = true;
    this.playing = false;
    Diag.set('Son oynatma hatasi', msg);
    if (this.cb.onError) this.cb.onError(msg);
  },

  /* --- AVPlay --- */

  _avStart: function (url, token) {
    var self = this;
    try {
      try { webapis.avplay.close(); } catch (e) { }
      webapis.avplay.open(url);
      this.applyAspect();
      if (!this.live) {
        /* Oynatici hazir olurken varsayilan gomulu altyazinin bir an gorunmesini
           engelle. Kullanici secimi onReady sonrasinda yeniden uygulanir. */
        this.subtitleMuted = true;
        try { webapis.avplay.setSilentSubtitle(true); } catch (subtitleMuteError) { }
      }

      if (this.live && this.cb.buffer) {
        try {
          webapis.avplay.setBufferingParam(
            'PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', this.cb.buffer.play);
          webapis.avplay.setBufferingParam(
            'PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', this.cb.buffer.resume);
          Diag.set('Canli tampon', this.cb.buffer.play + ' sn baslat / ' + this.cb.buffer.resume + ' sn devam');
        } catch (bufferError) {
          Diag.add('AVPlay tampon ayari uygulanamadi, varsayilan kullaniliyor: ' + bufferError.message);
          Diag.set('Canli tampon', 'AVPlay varsayilani');
        }
      }

      webapis.avplay.setListener({
        onbufferingstart: function () {
          if (token !== self._sessionId) return;
          self._bufferStart(token, 'AVPlay');
        },
        onbufferingcomplete: function () {
          if (token !== self._sessionId) return;
          self._bufferEnd(token, 'AVPlay');
          /* Bazi Tizen surumleri tamponlamadan cikarken donanimsal goruntu
             alanini varsayilana donduruyor. OTTplay'in yaptigi gibi ayni
             oturumda yontemi ve alani yeniden uygula. */
          self.applyAspect();
          self._scheduleNativeSubtitleReselect('buffer');
        },
        onbufferingprogress: function () { },
        oncurrentplaytime: function (ms) {
          if (token !== self._sessionId) return;
          self._updateProgress((ms || 0) / 1000);
          self._scheduleNativeSubtitleReselect('playtime');
        },
        onstreamcompleted: function () {
          if (token !== self._sessionId) return;
          self.playing = false;
          if (self.cb.onEnd) self.cb.onEnd();
        },
        onerror: function (err) {
          if (token !== self._sessionId) return;
          UI.spin(false);
          self._fail('AVPlay hatasi: ' + err, true);
        },
        onerrormsg: function (err, detail) {
          if (token !== self._sessionId) return;
          Diag.add('AVPlay ayrintisi: ' + err + (detail ? ' - ' + detail : ''));
        },
        onevent: function () { },
        ondrmevent: function () { },
        onsubtitlechange: function (duration, text, data3, data4) {
          if (token !== self._sessionId) return;
          if (self._preparing) return;
          if (self.subtitleMuted === true) { self._emitSubtitle(''); return; }
          if (self._softwareSubtitleTrack || self.softwareSubtitleStatus.indexOf('hazirlaniyor') !== -1) return;
          var payload = text == null ? '' : text;
          var subtitleType = String(data3 == null ? '0' : data3);
          self._subtitleEventCount++;
          Diag.set('Altyazi olayi', 'AVPlay #' + self._subtitleEventCount + ' · tur ' + subtitleType + ' · ' + String(payload).length + ' karakter');
          /* Goruntu tabanli altyaziyi AVPlay'in yerlesik cizicisine birak.
             API'ye gore tur 1 goruntudur; setSilentSubtitle(false) gosterir. */
          if (subtitleType === '1') {
            self._markNativeSubtitleSuccess();
            try { webapis.avplay.setSilentSubtitle(false); } catch (imageSubtitleError) {
              Diag.add('Goruntu altyazisi acilamadi: ' + imageSubtitleError.message);
            }
            self._emitSubtitle('');
            return;
          }
          if (String(payload).trim()) self._markNativeSubtitleSuccess();
          self._emitSubtitle(payload, duration);
        }
      });

      UI.spin(true);
      webapis.avplay.prepareAsync(function () {
        if (token !== self._sessionId) return;
        UI.spin(false);
        try {
          var info = webapis.avplay.getDuration();
          self._dur = (info || 0) / 1000;
        } catch (e) { self._dur = 0; }
        try {
          if (self._pendingSeek > 0 && self._dur > 0) {
            webapis.avplay.seekTo(Math.floor(self._pendingSeek * 1000));
          }
        } catch (e) { }
        try { webapis.avplay.play(); } catch (e) { self._fail('Oynatma baslatilamadi: ' + e.message, true); return; }
        /* Bazi Tizen 6.0 surumleri prepare/play sirasinda goruntu metodunu sifirlar. */
        self.applyAspect();
        setTimeout(function () {
          if (token === self._sessionId && self.engine === 'avplay' && self.playing) self.applyAspect();
        }, 150);
        self._notifyReady();
      }, function (err) {
        if (token !== self._sessionId) return;
        UI.spin(false);
        self._fail('Yayin hazirlanamadi: ' + err, true);
      });
    } catch (e) {
      UI.spin(false);
      this._fail('AVPlay baslatilamadi: ' + e.message, true);
    }
  },

  /* --- HTML5 --- */

  _h5Start: function (url, token) {
    var self = this;
    var v = this.els().v;
    v.onerror = null;
    try { v.pause(); } catch (e) { }
    v.src = url;
    this.applyAspect();
    UI.spin(true);

    v.onloadedmetadata = function () {
      if (token !== self._sessionId) return;
      if (!self.live && v.textTracks) {
        for (var t = 0; t < v.textTracks.length; t++) v.textTracks[t].mode = 'disabled';
        self.subtitleMuted = true;
      }
      self._dur = v.duration && isFinite(v.duration) ? v.duration : 0;
      if (self._pendingSeek > 0 && self._dur > 0) {
        try { v.currentTime = self._pendingSeek; } catch (e) { }
      }
    };
    v.oncanplay = function () {
      if (token !== self._sessionId) return;
      self._bufferEnd(token, 'HTML5');
    };
    v.onwaiting = function () {
      if (token !== self._sessionId) return;
      self._bufferStart(token, 'HTML5');
    };
    v.onplaying = function () {
      if (token !== self._sessionId) return;
      self._bufferEnd(token, 'HTML5');
      self._notifyReady();
    };
    v.ontimeupdate = function () {
      if (token !== self._sessionId) return;
      self._updateProgress(v.currentTime || 0);
      if (!self._dur && v.duration && isFinite(v.duration)) self._dur = v.duration;
      if (self._htmlSubtitleTrack) self._renderHtmlSubtitle(self._htmlSubtitleTrack);
    };
    v.onended = function () {
      if (token !== self._sessionId) return;
      self.playing = false;
      if (self.cb.onEnd) self.cb.onEnd();
    };
    v.onerror = function () {
      if (token !== self._sessionId) return;
      UI.spin(false);
      var code = v.error ? v.error.code : 0;
      var msg = {
        1: 'Oynatma iptal edildi',
        2: 'Medya indirilirken ag hatasi olustu',
        3: 'Medya cozumlenemedi (codec veya dosya yapisi uyumsuz)',
        4: 'Kaynak veya medya bicimi desteklenmiyor'
      };
      self._fail(msg[code] || ('Oynatma hatasi (' + code + ')'), false);
    };
    try { v.load(); v.play(); } catch (e) { }
  },

  _notifyReady: function () {
    if (this._preparing && !this._engineStarted) return;
    if (this._readyAt) return;
    this._readyAt = Date.now();
    this._lastProgressAt = this._readyAt;
    Diag.set('Oynatici durumu', 'Oynuyor');
    if (this.cb.onReady) this.cb.onReady();
  },

  _updateProgress: function (position) {
    if ((Date.now() < this._seekPreviewUntil || this._seekInFlight) &&
      Math.abs(Number(position || 0) - this._seekTarget) > 2) return;
    this._pos = position || 0;
    if (Math.abs(this._pos - this._lastProgressPos) >= 0.15) {
      this._lastProgressPos = this._pos;
      this._lastProgressAt = Date.now();
    }
    if (this._softwareSubtitleCues) this._renderSoftwareSubtitle();
  },

  _clearBufferTimer: function () {
    if (this._bufferTimer) { clearTimeout(this._bufferTimer); this._bufferTimer = null; }
  },

  _bufferStart: function (token, source) {
    if (token !== this._sessionId) return;
    if (!this._buffering) {
      this._buffering = true;
      this._bufferingSince = Date.now();
      Diag.set('Oynatici durumu', this._readyAt ? 'Yeniden tamponluyor' : 'Hazirlaniyor');
      if (this.cb.onBufferingStart) this.cb.onBufferingStart({ initial: !this._readyAt, source: source });
    }
    UI.spin(true);
    this._clearBufferTimer();
    if (this.live && this._readyAt && !this.paused) {
      var self = this;
      /* Kisa decoder duraksamalarini ogrenme verisi sayma. Kullanici notlarindaki
         esik: oynatma basladiktan sonra 2,5 saniyeyi asan yeniden tamponlama. */
      /* Chromium 76 canli TS akisini AVPlay kadar derin tamponlayamaz. Saglayici
         8-13 sn'lik patlamalarla veri gonderebildigi icin HTML5'i daha erken
         yeniden acmak gereksiz dongu olusturur. */
      var waitMs = this.engine === 'html5' ? 14000 : 2600;
      this._bufferTimer = setTimeout(function () {
        if (token === self._sessionId && self._buffering) self._emitStall('uzun tamponlama');
      }, waitMs);
    }
  },

  _bufferEnd: function (token, source) {
    if (token !== this._sessionId) return;
    var wasBuffering = this._buffering;
    var duration = wasBuffering && this._bufferingSince ? Date.now() - this._bufferingSince : 0;
    this._buffering = false;
    this._bufferingSince = 0;
    this._clearBufferTimer();
    UI.spin(false);
    if (this._readyAt) Diag.set('Oynatici durumu', 'Oynuyor');
    if (wasBuffering && this.cb.onBufferingComplete) {
      this.cb.onBufferingComplete({ initial: !this._readyAt, source: source, durationMs: duration });
    }
  },

  _emitStall: function (reason) {
    var now = Date.now();
    if (!this.live || !this.playing || !this._readyAt) return;
    if (now - this._stallSentAt < 15000) return;
    this._stallSentAt = now;
    Diag.add('Canli yayin takilmasi algilandi: ' + reason);
    if (this.cb.onStall) this.cb.onStall(reason);
  },

  /* --- kontrol --- */

  stop: function (quiet) {
    this._sessionId++;
    if (this._viewportTimer) { clearTimeout(this._viewportTimer); this._viewportTimer = null; }
    if (this._nativeReselectTimer) { clearTimeout(this._nativeReselectTimer); this._nativeReselectTimer = null; }
    if (typeof Tx3gSubtitles !== 'undefined' && Tx3gSubtitles.cancel) Tx3gSubtitles.cancel();
    this.playing = false;
    this._preparing = false;
    this._preparationSkip = true;
    this._preparationError = false;
    this._engineStarted = false;
    if (this._engineStartTimer) { clearTimeout(this._engineStartTimer); this._engineStartTimer = null; }
    if (this._seekTimer) { clearTimeout(this._seekTimer); this._seekTimer = null; }
    if (this._seekLockTimer) { clearTimeout(this._seekLockTimer); this._seekLockTimer = null; }
    this._seekInFlight = false;
    this._seekQueuedTarget = null;
    this._stopTick();
    this._clearBufferTimer();
    this._buffering = false;
    this.clearSubtitle();
    UI.spin(false);
    try {
      if (this.engine === 'avplay' && this.hasAvplay()) {
        try { webapis.avplay.stop(); } catch (e) { }
        try { webapis.avplay.close(); } catch (e) { }
      }
    } catch (e) { }
    try {
      var v = this.els().v;
      v.onerror = null; v.onwaiting = null; v.onplaying = null; v.oncanplay = null;
      v.onloadedmetadata = null; v.ontimeupdate = null; v.onended = null;
      v.pause(); v.removeAttribute('src'); v.load();
    } catch (e) { }
    if (!quiet) this.hideAll();
  },

  paused: false,

  toggle: function () {
    try {
      if (this.engine === 'avplay') {
        var st = webapis.avplay.getState();
        if (st === 'PLAYING') { webapis.avplay.pause(); this.paused = true; }
        else { webapis.avplay.play(); this.paused = false; }
      } else {
        var v = this.els().v;
        if (v.paused) { v.play(); this.paused = false; }
        else { v.pause(); this.paused = true; }
      }
    } catch (e) { Diag.add('Duraklatma hatasi: ' + e.message); }
    return this.paused;
  },

  seek: function (deltaSec) {
    if (this.live) return false;
    if (this._preparing || !this._engineStarted || !this._readyAt) {
      if (this.cb.onSeekStatus) this.cb.onSeekStatus('Yayin hazirlaniyor, birazdan sarabilirsiniz');
      return false;
    }
    var base = (this._seekTimer || this._seekInFlight) ? this._seekTarget : this._pos;
    var target = Math.max(0, base + deltaSec);
    if (this._dur && target > this._dur - 5) target = this._dur - 5;
    this._seekTarget = target;
    this._pos = target;
    this._seekPreviewUntil = Date.now() + 1400;
    if (this._softwareSubtitleCues) this._renderSoftwareSubtitle();
    if (this._seekTimer) clearTimeout(this._seekTimer);
    var self = this, token = this._sessionId;
    this._seekTimer = setTimeout(function () {
      self._seekTimer = null;
      self._commitSeek(self._seekTarget, token);
    }, 400);
    return true;
  },

  _commitSeek: function (target, token) {
    var self = this;
    if (token !== this._sessionId || this._preparing || !this._readyAt) return;
    if (this._seekInFlight) { this._seekQueuedTarget = target; return; }
    if (this.engine !== 'avplay') {
      try {
        this.els().v.currentTime = target;
        this._pos = target;
      } catch (e) {
        if (this.cb.onSeekStatus) this.cb.onSeekStatus('Sarma islemi uygulanamadi');
      }
      return;
    }
    this._seekInFlight = true;
    var settled = false;
    function finish(ok) {
      if (settled) return;
      settled = true;
      if (self._seekLockTimer) { clearTimeout(self._seekLockTimer); self._seekLockTimer = null; }
      self._seekInFlight = false;
      if (ok) self._pos = target;
      else if (self.cb.onSeekStatus) self.cb.onSeekStatus('Sarma islemi tamamlanamadi');
      var queued = self._seekQueuedTarget;
      self._seekQueuedTarget = null;
      if (queued != null && Math.abs(queued - target) > 0.1) self._commitSeek(queued, token);
    }
    try {
      webapis.avplay.seekTo(Math.floor(target * 1000), function () { finish(true); }, function () { finish(false); });
      /* Bazi Tizen surumleri callback cagirmasa bile kilit kalici olmasin. */
      this._seekLockTimer = setTimeout(function () { finish(true); }, 4500);
    } catch (e) { finish(false); }
  },

  position: function () { return this._pos; },
  duration: function () { return this._dur; },

  _startTick: function (token) {
    var self = this;
    this._stopTick();
    this._tick = setInterval(function () {
      if (token !== self._sessionId || !self.playing) return;
      if (self.engine === 'avplay' && !self._dur) {
        try { self._dur = (webapis.avplay.getDuration() || 0) / 1000; } catch (e) { }
      }
      var now = Date.now();
      if (self.engine === 'html5') {
        try {
          var statVideo = self.els().v;
          var videoBytes = Number(statVideo.webkitVideoDecodedByteCount) || 0;
          var audioBytes = Number(statVideo.webkitAudioDecodedByteCount) || 0;
          var statFrames = Number(statVideo.webkitDecodedFrameCount) || 0;
          var totalBytes = videoBytes + audioBytes;
          if (self._statsSample && now > self._statsSample.at) {
            var seconds = (now - self._statsSample.at) / 1000;
            if (totalBytes >= self._statsSample.bytes) self._decodedRateBps = (totalBytes - self._statsSample.bytes) * 8 / seconds;
            if (statFrames >= self._statsSample.frames) self._decodedFps = (statFrames - self._statsSample.frames) / seconds;
          }
          self._statsSample = { at: now, bytes: totalBytes, frames: statFrames };
        } catch (statsError) { }
      }
      if (self.live && self._readyAt && !self._buffering && !self.paused &&
        now - self._lastProgressAt > 6000) {
        self._emitStall('oynatma saati ilerlemiyor');
      }

      /* Chromium 76 HTML5 video sayaci ses ilerlerken donan goruntuyu yakalayabilir. */
      if (self.live && self.engine === 'html5' && self._readyAt && !self._buffering &&
        now - self._readyAt > 12000) {
        try {
          var video = self.els().v;
          var frames = Number(video.webkitDecodedFrameCount);
          if (isFinite(frames)) {
            if (self._lastVideoFrames < 0 || frames !== self._lastVideoFrames) {
              self._lastVideoFrames = frames;
              self._lastVideoFrameAt = now;
            } else if (!video.paused && now - self._lastVideoFrameAt > 14000) {
              self._emitStall('video kareleri ilerlemiyor');
            }
          }
        } catch (e) { }
      }
      if (self.cb.onTime) self.cb.onTime(self._pos, self._dur);
    }, 1000);
  },

  _stopTick: function () {
    if (this._tick) { clearInterval(this._tick); this._tick = null; }
  }
};
