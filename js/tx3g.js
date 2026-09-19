/* tx3g.js - Eski Tizen cihazlarinda gorunmeyen MP4 mov_text/tx3g
   altyazilarini HTTP Range ile okuyup zamanlanmis metne donusturur.

   Bu dosya bilincli olarak harici kutuphane kullanmaz ve ES2017 hedefler.
   Video/ses AVPlay'de kalir; yalnizca secilen altyazi parcasi okunur. */
'use strict';

var Tx3gSubtitles = {
  maxMoovBytes: 24 * 1024 * 1024,
  maxSamples: 12000,
  requestTimeout: 15000,
  maxBatchBytes: 512 * 1024,
  maxBatchGap: 256 * 1024,
  maxBatchOverfetch: 8 * 1024 * 1024,
  maxTrackRequests: 900,
  minRequestInterval: 60,
  retryDelay: 1000,
  maxRecoveries: 4,
  windowBackSeconds: 12,
  windowAheadSeconds: 120,
  partialLifetime: 10 * 60 * 1000,
  _lastRequestAt: 0,
  _generation: 0,
  _queue: null,
  _abortRequest: null,
  _identities: {},
  _network: {},
  diagnostics: [],
  _cooldowns: {},
  _inspectCache: {},
  _inspectUsed: {},
  _resolvedUrls: {},

  _u16: function (view, pos) { return view.getUint16(pos, false); },
  _u32: function (view, pos) { return view.getUint32(pos, false); },
  _i32: function (view, pos) { return view.getInt32(pos, false); },

  _u64: function (view, pos) {
    var high = view.getUint32(pos, false);
    var low = view.getUint32(pos + 4, false);
    var value = high * 4294967296 + low;
    if (value > Number.MAX_SAFE_INTEGER) throw new Error('MP4 dosya konumu cok buyuk');
    return value;
  },

  _ascii: function (bytes, pos, length) {
    var out = '';
    for (var i = 0; i < length && pos + i < bytes.length; i++) {
      out += String.fromCharCode(bytes[pos + i]);
    }
    return out;
  },

  _boxAt: function (bytes, view, pos, limit) {
    if (pos < 0 || pos + 8 > limit) return null;
    var size = this._u32(view, pos);
    var type = this._ascii(bytes, pos + 4, 4);
    var header = 8;
    if (size === 1) {
      if (pos + 16 > limit) return null;
      size = this._u64(view, pos + 8);
      header = 16;
    } else if (size === 0) {
      size = limit - pos;
    }
    if (size < header || pos + size > limit) return null;
    return { type: type, start: pos, size: size, data: pos + header, end: pos + size };
  },

  _children: function (bytes, view, parent) {
    var out = [], pos = parent.data;
    while (pos + 8 <= parent.end) {
      var child = this._boxAt(bytes, view, pos, parent.end);
      if (!child) break;
      out.push(child);
      pos = child.end;
    }
    return out;
  },

  _child: function (bytes, view, parent, type) {
    var list = this._children(bytes, view, parent);
    for (var i = 0; i < list.length; i++) if (list[i].type === type) return list[i];
    return null;
  },

  _path: function (bytes, view, parent, names) {
    var current = parent;
    for (var i = 0; i < names.length && current; i++) {
      current = this._child(bytes, view, current, names[i]);
    }
    return current;
  },

  _language: function (packed) {
    var value = packed & 0x7fff;
    var lang = String.fromCharCode(((value >> 10) & 31) + 96) +
      String.fromCharCode(((value >> 5) & 31) + 96) +
      String.fromCharCode((value & 31) + 96);
    return /^[a-z]{3}$/.test(lang) ? lang : 'und';
  },

  _parseMdhd: function (bytes, view, box) {
    if (!box || box.data + 24 > box.end) return null;
    var version = bytes[box.data];
    var timescalePos = version === 1 ? box.data + 20 : box.data + 12;
    var languagePos = version === 1 ? box.data + 32 : box.data + 20;
    if (languagePos + 2 > box.end) return null;
    var timescale = this._u32(view, timescalePos);
    if (!timescale) return null;
    return { timescale: timescale, language: this._language(this._u16(view, languagePos)) };
  },

  _parseStsdCodec: function (bytes, view, box) {
    if (!box || box.data + 16 > box.end) return '';
    var count = this._u32(view, box.data + 4);
    return count ? this._ascii(bytes, box.data + 12, 4) : '';
  },

  _parseStts: function (bytes, view, box, sampleCount) {
    if (!box || box.data + 8 > box.end) return null;
    var entries = this._u32(view, box.data + 4);
    var pos = box.data + 8, out = new Array(sampleCount), sample = 0, clock = 0;
    for (var i = 0; i < entries; i++) {
      if (pos + 8 > box.end) return null;
      var count = this._u32(view, pos);
      var delta = this._u32(view, pos + 4);
      pos += 8;
      if (count > sampleCount - sample) count = sampleCount - sample;
      for (var n = 0; n < count; n++) {
        out[sample++] = { dts: clock, duration: delta, cto: 0, offset: 0, size: 0 };
        clock += delta;
      }
      if (sample >= sampleCount) break;
    }
    return sample === sampleCount ? out : null;
  },

  _applyCtts: function (bytes, view, box, samples) {
    if (!box || !samples || box.data + 8 > box.end) return;
    var version = bytes[box.data];
    var entries = this._u32(view, box.data + 4);
    var pos = box.data + 8, sample = 0;
    for (var i = 0; i < entries && sample < samples.length; i++) {
      if (pos + 8 > box.end) return;
      var count = this._u32(view, pos);
      var value = version === 1 ? this._i32(view, pos + 4) : this._u32(view, pos + 4);
      pos += 8;
      for (var n = 0; n < count && sample < samples.length; n++) samples[sample++].cto = value;
    }
  },

  _parseStsz: function (bytes, view, box) {
    if (!box || box.data + 12 > box.end) return null;
    var fixed = this._u32(view, box.data + 4);
    var count = this._u32(view, box.data + 8);
    if (!count || count > this.maxSamples) return null;
    var sizes = new Array(count);
    if (fixed) {
      for (var i = 0; i < count; i++) sizes[i] = fixed;
      return sizes;
    }
    var pos = box.data + 12;
    if (pos + count * 4 > box.end) return null;
    for (var n = 0; n < count; n++, pos += 4) sizes[n] = this._u32(view, pos);
    return sizes;
  },

  _parseStsc: function (bytes, view, box) {
    if (!box || box.data + 8 > box.end) return null;
    var count = this._u32(view, box.data + 4);
    var pos = box.data + 8, out = [];
    if (!count || pos + count * 12 > box.end) return null;
    for (var i = 0; i < count; i++, pos += 12) {
      out.push({ first: this._u32(view, pos), perChunk: this._u32(view, pos + 4) });
    }
    return out;
  },

  _parseChunkOffsets: function (bytes, view, box) {
    if (!box || box.data + 8 > box.end) return null;
    var count = this._u32(view, box.data + 4);
    var width = box.type === 'co64' ? 8 : 4;
    var pos = box.data + 8, out = [];
    if (!count || pos + count * width > box.end) return null;
    for (var i = 0; i < count; i++, pos += width) {
      out.push(width === 8 ? this._u64(view, pos) : this._u32(view, pos));
    }
    return out;
  },

  _assignOffsets: function (samples, sizes, chunks, stsc) {
    var sample = 0, rule = 0;
    for (var chunk = 1; chunk <= chunks.length && sample < samples.length; chunk++) {
      while (rule + 1 < stsc.length && chunk >= stsc[rule + 1].first) rule++;
      var offset = chunks[chunk - 1];
      var perChunk = stsc[rule].perChunk;
      for (var n = 0; n < perChunk && sample < samples.length; n++) {
        samples[sample].offset = offset;
        samples[sample].size = sizes[sample];
        offset += sizes[sample];
        sample++;
      }
    }
    return sample === samples.length;
  },

  _parseMoov: function (buffer) {
    var bytes = new Uint8Array(buffer);
    var view = new DataView(buffer);
    var root = this._boxAt(bytes, view, 0, bytes.length);
    if (!root || root.type !== 'moov') throw new Error('MP4 moov kutusu okunamadi');
    var boxes = this._children(bytes, view, root);
    var tracks = [];
    for (var i = 0; i < boxes.length; i++) {
      if (boxes[i].type !== 'trak') continue;
      var trak = boxes[i];
      var mdia = this._child(bytes, view, trak, 'mdia');
      var hdlr = mdia ? this._child(bytes, view, mdia, 'hdlr') : null;
      if (!hdlr || hdlr.data + 12 > hdlr.end) continue;
      var handler = this._ascii(bytes, hdlr.data + 8, 4);
      if (handler !== 'text' && handler !== 'subt' && handler !== 'sbtl') continue;
      var mdhd = this._parseMdhd(bytes, view, this._child(bytes, view, mdia, 'mdhd'));
      var stbl = this._path(bytes, view, mdia, ['minf', 'stbl']);
      if (!mdhd || !stbl) continue;
      var codec = this._parseStsdCodec(bytes, view, this._child(bytes, view, stbl, 'stsd'));
      if (codec !== 'tx3g') continue;
      var sizes = this._parseStsz(bytes, view, this._child(bytes, view, stbl, 'stsz'));
      if (!sizes) continue;
      var samples = this._parseStts(bytes, view, this._child(bytes, view, stbl, 'stts'), sizes.length);
      var stsc = this._parseStsc(bytes, view, this._child(bytes, view, stbl, 'stsc'));
      var chunkBox = this._child(bytes, view, stbl, 'stco') || this._child(bytes, view, stbl, 'co64');
      var chunks = this._parseChunkOffsets(bytes, view, chunkBox);
      if (!samples || !stsc || !chunks || !this._assignOffsets(samples, sizes, chunks, stsc)) continue;
      this._applyCtts(bytes, view, this._child(bytes, view, stbl, 'ctts'), samples);
      tracks.push({
        sourceIndex: tracks.length,
        codec: 'tx3g',
        lang: mdhd.language,
        timescale: mdhd.timescale,
        samples: samples,
        cues: null
      });
    }
    return { kind: 'mp4', sourceUrl: '', tracks: tracks };
  },

  _error: function (message, terminal) {
    var error = new Error(message);
    error.terminal = !!terminal;
    return error;
  },

  _checkActive: function (context) {
    if (context && ((context.generation != null && context.generation !== this._generation) ||
        (context.isActive && !context.isActive()))) {
      var error = this._error('Altyazi hazirlama iptal edildi', true);
      error.cancelled = true;
      throw error;
    }
  },

  cancel: function () {
    this._generation++;
    if (this._abortRequest) this._abortRequest();
  },

  _record: function (url, start, end, status, elapsed, redirected) {
    /* Yalnizca origin: URL yolu, kullanici, parola ve sorgu kaydedilmez. */
    var origin = '';
    try { origin = new URL(url).origin; } catch (e) { origin = 'bilinmeyen'; }
    var entry = { origin: origin, start: start, end: end, status: status,
      elapsedMs: elapsed, redirected: !!redirected };
    this.diagnostics.push(entry);
    if (this.diagnostics.length > 24) this.diagnostics.shift();
    if (typeof Diag !== 'undefined') Diag.set('Altyazi son istek',
      origin + ' · HTTP ' + status + ' · ' + elapsed + ' ms · ' + start + '-' + end +
      (redirected ? ' · medya adresi' : ' · asil adres'));
  },

  _fingerprint: function (buffer) {
    var bytes = new Uint8Array(buffer), a = 2166136261, b = 5381;
    for (var i = 0; i < bytes.length; i++) {
      a = Math.imul(a ^ bytes[i], 16777619);
      b = Math.imul(b, 33) ^ bytes[i];
    }
    return bytes.length + ':' + (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
  },

  _range: function (url, start, end, context) {
    var self = this, generation = this._generation;
    /* Birden fazla cagiran olsa bile tum Range istekleri tek kuyrukta. */
    var job = (this._queue || Promise.resolve()).then(function () {
      self._checkActive({ generation: generation });
      self._checkActive(context);
      return self._requestRange(url, start, end, context);
    });
    this._queue = job['catch'](function () {});
    return job;
  },

  _requestRange: function (url, start, end, context) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var cooldown = self._cooldowns[url] || 0;
      if (cooldown > Date.now()) {
        var waitError = new Error('Sunucu altyazi isteklerini gecici olarak durdurdu. Daha sonra tekrar deneyin.');
        waitError.status = 429; waitError.terminal = true;
        reject(waitError); return;
      }
      var xhr = new XMLHttpRequest();
      var requestUrl = self._resolvedUrls[url] || url;
      var expected = end - start + 1;
      var finished = false, timer = null, sentAt = Date.now();
      function finish(error, data) {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        if (self._abortRequest === cancel) self._abortRequest = null;
        self._record(requestUrl, start, end, error ? (error.status || 0) : xhr.status,
          Date.now() - sentAt, requestUrl !== url);
        if (!error && data) {
          var net = self._network[url] || { latency: 0, bytesPerMs: 0 };
          var duration = Math.max(1, Date.now() - sentAt);
          if (expected <= 1024) net.latency = net.latency ? (net.latency * 0.75 + duration * 0.25) : duration;
          if (expected >= 64 * 1024) net.bytesPerMs = expected / duration;
          self._network[url] = net;
        }
        if (error) reject(error); else resolve(data);
      }
      function cancel() {
        if (finished) return;
        var error = self._error('Altyazi hazirlama iptal edildi', true);
        error.cancelled = true;
        finish(error);
        try { xhr.abort(); } catch (e) { }
      }
      function fail(message, terminal) {
        finish(self._error(message, terminal));
      }
      function statusError(status) {
        var error = new Error('HTTP Range ' + status);
        error.status = status;
        error.terminal = status === 401 || status === 403 || status === 404 || status === 410 ||
          status === 416 || status === 429;
        /* 403, Xtream'in gecici medya adresinin suresi doldugunda da gelebilir.
           Ilk 403'te asil adresi bir kez yenileme sansini _readSafe yonetir.
           Gercek hiz siniri olan 429 ise hemen beklemeye alinir. */
        if (status === 429) {
          var retrySeconds = 0;
          try { retrySeconds = parseInt(xhr.getResponseHeader('Retry-After'), 10) || 0; } catch (e) { }
          self._cooldowns[url] = Date.now() + Math.max(10 * 60 * 1000, retrySeconds * 1000);
        }
        return error;
      }
      xhr.onprogress = function (event) {
        /* Range yok sayilirsa yuzlerce MB'lik filmi bellekte biriktirme. */
        if (event.loaded > expected + 1024 * 1024) {
          fail('Sunucu byte araligini uygulamadi', true);
          try { xhr.abort(); } catch (e) { }
        }
      };
      xhr.onload = function () {
        if (finished) return;
        var data = xhr.response;
        if ((xhr.status === 206 || (xhr.status === 200 && start === 0)) && data && data.byteLength >= expected) {
          var range = '', match;
          try { range = xhr.getResponseHeader('Content-Range') || ''; } catch (e) { }
          match = range.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/i);
          if (xhr.status === 206 && ((range && !match) || (match &&
              (Number(match[1]) !== start || Number(match[2]) !== end)) || data.byteLength !== expected)) {
            fail('Sunucu yanlis byte araligi dondurdu', true); return;
          }
          var identity = self._identities[url];
          if (match && match[3] !== '*') {
            if (identity && identity.total && identity.total !== Number(match[3])) {
              var changed = self._error('Kaynak dosya degisti; icerigi yeniden acin', true);
              changed.sourceChanged = true;
              finish(changed); return;
            }
            if (!identity) identity = self._identities[url] = {};
            identity.total = Number(match[3]);
          }
          /* Xtream adresleri genellikle medya dugumune 302 ile gider. Ilk istegin
             son adresini oturum boyunca kullanmak yuzlerce yonlendirmeyi onler. */
          if (xhr.responseURL && xhr.responseURL !== requestUrl) self._resolvedUrls[url] = xhr.responseURL;
          finish(null, data.byteLength === expected ? data : data.slice(0, expected));
        } else {
          if (xhr.status === 200 || xhr.status === 206) {
            fail('Sunucu eksik veri gonderdi veya Range istegini uygulamadi', xhr.status === 200);
          } else finish(statusError(xhr.status));
        }
      };
      xhr.onerror = function () { fail('Altyazi ag istegi basarisiz'); };
      xhr.ontimeout = function () { fail('Altyazi istegi zaman asimina ugradi'); };
      xhr.onabort = function () { cancel(); };
      function send() {
        if (finished) return;
        try { self._checkActive(context); } catch (e) { finish(e); return; }
        self._lastRequestAt = Date.now();
        sentAt = Date.now();
        try {
          xhr.open('GET', requestUrl, true);
          xhr.responseType = 'arraybuffer';
          xhr.timeout = self.requestTimeout;
          xhr.setRequestHeader('Range', 'bytes=' + start + '-' + end);
          xhr.send();
        } catch (e) { fail('Altyazi istegi baslatilamadi'); }
      }
      self._abortRequest = cancel;
      var delay = Math.max(0, self.minRequestInterval - (Date.now() - self._lastRequestAt));
      if (delay) timer = setTimeout(send, delay); else send();
    });
  },

  _validateSource: function (url, context) {
    var self = this, identity = this._identities[url];
    if (!identity || !identity.fingerprint) return Promise.resolve();
    return this._range(url, identity.offset, identity.offset + identity.size - 1, context).then(function (buffer) {
      if (self._fingerprint(buffer) !== identity.fingerprint) {
        var error = self._error('Kaynak dosya degisti; icerigi yeniden acin', true);
        error.sourceChanged = true;
        throw error;
      }
    });
  },

  _readSafe: function (url, start, end, context) {
    var self = this;
    context = context || { generation: this._generation, recoveries: 0 };
    return this._range(url, start, end, context)['catch'](function (error) {
      self._checkActive(context);
      var refresh403 = error.status === 403 && !context.refreshed403;
      var refresh404 = error.status === 404 && !context.refreshed404;
      var refresh = refresh404 || refresh403;
      if (refresh403) context.refreshed403 = true;
      if (refresh404) context.refreshed404 = true;
      if ((!refresh && self._terminalRangeError(error)) ||
          (self._cooldowns[url] || 0) > Date.now() || context.recoveries >= self.maxRecoveries) throw error;
      context.recoveries = (context.recoveries || 0) + 1;
      if (context.onRetry) context.onRetry(refresh ? 'Adres yenileniyor' : 'Baglanti yeniden deneniyor');
      return new Promise(function (resolve) { setTimeout(resolve, self.retryDelay); }).then(function () {
        self._checkActive(context);
        if (refresh) delete self._resolvedUrls[url];
        /* Adres degisince eski sample konumlariyla yeni dosyayi karistirma. */
        return refresh ? self._validateSource(url, context) : null;
      }).then(function () {
        return self._readSafe(url, start, end, context);
      })['catch'](function (retryError) {
        if (retryError.status === 403 && context.refreshed403) {
          self._cooldowns[url] = Date.now() + 10 * 60 * 1000;
        }
        throw retryError;
      });
    });
  },

  _header: function (buffer) {
    var bytes = new Uint8Array(buffer), view = new DataView(buffer);
    if (bytes.length < 8) throw new Error('MP4 kutu basligi gecersiz');
    var size = this._u32(view, 0);
    var type = this._ascii(bytes, 4, 4);
    if (size === 1) {
      if (bytes.length < 16) throw new Error('MP4 genis kutu basligi eksik');
      size = this._u64(view, 8);
    }
    if (size < 8) throw new Error('MP4 kutu boyutu gecersiz');
    return { type: type, size: size };
  },

  _locateMoov: function (url, context) {
    var self = this, offset = 0, count = 0;
    function next() {
      if (count++ > 24) return Promise.reject(new Error('MP4 moov kutusu bulunamadi'));
      return self._readSafe(url, offset, offset + 15, context).then(function (buffer) {
        var header = self._header(buffer);
        if (offset === 0 && header.type !== 'ftyp') {
          var magic = new Uint8Array(buffer);
          if (magic[0] === 0x1a && magic[1] === 0x45 && magic[2] === 0xdf && magic[3] === 0xa3) {
            return { container: 'matroska' };
          }
          return { container: 'other' };
        }
        if (header.type === 'moov') {
          if (header.size > self.maxMoovBytes) throw new Error('MP4 altyazi indeksi cok buyuk');
          return self._readSafe(url, offset, offset + header.size - 1, context).then(function (moov) {
            var identity = self._identities[url] || {};
            identity.offset = offset; identity.size = header.size;
            identity.fingerprint = self._fingerprint(moov);
            self._identities[url] = identity;
            return moov;
          });
        }
        if (header.size < 8) throw new Error('MP4 kutu boyutu gecersiz');
        offset += header.size;
        return next();
      });
    }
    return next();
  },

  inspect: function (url, isActive) {
    var self = this;
    if (!url || typeof XMLHttpRequest === 'undefined') return Promise.resolve(null);
    this._inspectUsed[url] = Date.now();
    if (this._inspectCache[url]) return this._inspectCache[url];
    var keys = Object.keys(this._inspectCache).sort(function (a, b) {
      return (self._inspectUsed[a] || 0) - (self._inspectUsed[b] || 0);
    });
    while (keys.length >= 4) {
      var old = keys.shift();
      delete this._inspectCache[old]; delete this._inspectUsed[old];
      delete this._resolvedUrls[old]; delete this._identities[old]; delete this._network[old];
    }
    var context = { generation: this._generation, isActive: isActive, recoveries: 0 };
    var promise = this._locateMoov(url, context).then(function (moov) {
      if (moov && moov.container) {
        return { kind: moov.container, sourceUrl: url, tracks: [] };
      }
      var info = self._parseMoov(moov);
      info.sourceUrl = url;
      var fingerprint = self._fingerprint(moov);
      for (var i = 0; i < info.tracks.length; i++) {
        info.tracks[i].signature = 'v3:' + fingerprint + ':' + i;
      }
      return info;
    })['catch'](function (error) {
      delete self._inspectCache[url];
      if (!error.cancelled) {
        self._cooldowns[url] = Math.max(self._cooldowns[url] || 0,
          Date.now() + (error.status === 404 ? 60000 : 30000));
      }
      if (error.sourceChanged) {
        delete self._identities[url]; delete self._resolvedUrls[url];
      }
      throw error;
    });
    this._inspectCache[url] = promise;
    return promise;
  },

  _decodeUtf8: function (bytes, start, end) {
    var out = '', i = start;
    while (i < end) {
      var c = bytes[i++];
      if (c < 128) out += String.fromCharCode(c);
      else if (c < 224 && i < end) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
      else if (c < 240 && i + 1 < end) {
        out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
      } else if (i + 2 < end) {
        var cp = ((c & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
        cp -= 65536;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 1023));
      }
    }
    return out;
  },

  _decodeSample: function (buffer) {
    var bytes = new Uint8Array(buffer);
    if (bytes.length < 2) return '';
    var length = (bytes[0] << 8) | bytes[1];
    if (!length) return '';
    if (length > bytes.length - 2) throw this._error('Altyazi metin parcasi eksik veya gecersiz', true);
    var start = 2, end = Math.min(bytes.length, start + length), out = '';
    if (end - start >= 2 && bytes[start] === 0xfe && bytes[start + 1] === 0xff) {
      for (var i = start + 2; i + 1 < end; i += 2) out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    } else if (end - start >= 2 && bytes[start] === 0xff && bytes[start + 1] === 0xfe) {
      for (var n = start + 2; n + 1 < end; n += 2) out += String.fromCharCode(bytes[n] | (bytes[n + 1] << 8));
    } else {
      out = this._decodeUtf8(bytes, start, end);
    }
    return out.replace(/\u0000/g, '').trim();
  },

  _buildBatches: function (samples, url) {
    var sorted = samples.slice(0).sort(function (a, b) { return a.offset - b.offset; });
    var batches = [], overfetch = 0, parent = [], groups = [], edges = [];
    var net = this._network[url], gapLimit = this.maxBatchGap;
    /* Yavas baglantida az sayida istek ugruna gereksiz video indirmeyelim.
       Buyuk indeks istegi hiz, kucuk baslik istekleri gecikme ornegidir. */
    if (net && net.latency && net.bytesPerMs) {
      gapLimit = Math.min(gapLimit, Math.floor(net.latency * net.bytesPerMs * 0.6));
    }
    for (var i = 0; i < sorted.length; i++) {
      var sample = sorted[i];
      parent.push(i);
      groups.push({ start: sample.offset, end: sample.offset + sample.size - 1 });
      if (i) {
        var gap = sample.offset - (sorted[i - 1].offset + sorted[i - 1].size);
        if (gap >= 0 && gap <= gapLimit) edges.push({ left: i - 1, right: i, gap: gap });
      }
    }
    function find(index) {
      while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
      return index;
    }
    /* Tum bolumde en ucuz birlestirmeleri once yap; butce ilk dakikalarda bitmesin. */
    edges.sort(function (a, b) { return a.gap - b.gap || a.left - b.left; });
    for (var e = 0; e < edges.length; e++) {
      var edge = edges[e], left = find(edge.left), right = find(edge.right);
      if (left === right || overfetch + edge.gap > this.maxBatchOverfetch ||
          groups[right].end - groups[left].start + 1 > this.maxBatchBytes) continue;
      parent[right] = left;
      groups[left].end = groups[right].end;
      overfetch += edge.gap;
    }
    var previous = -1;
    for (var n = 0; n < sorted.length; n++) {
      var group = find(n);
      if (group !== previous) {
        batches.push({ start: groups[group].start, end: groups[group].end, samples: [] });
        previous = group;
      }
      batches[batches.length - 1].samples.push(sorted[n]);
    }
    return batches;
  },

  _terminalRangeError: function (error) {
    return !!(error && (error.terminal || error.status === 401 || error.status === 403 ||
      error.status === 404 || error.status === 410 || error.status === 416 || error.status === 429));
  },

  _mergeCues: function (target, incoming) {
    target = target || [];
    var seen = {}, i, cue, key;
    for (i = 0; i < target.length; i++) {
      cue = target[i];
      seen[Math.round(cue.start * 1000) + ':' + Math.round(cue.end * 1000) + ':' + cue.text] = true;
    }
    for (i = 0; i < incoming.length; i++) {
      cue = incoming[i];
      key = Math.round(cue.start * 1000) + ':' + Math.round(cue.end * 1000) + ':' + cue.text;
      if (!seen[key]) { seen[key] = true; target.push(cue); }
    }
    target.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    return target;
  },

  _rangeCovered: function (ranges, from, to) {
    ranges = ranges || [];
    for (var i = 0; i < ranges.length; i++) {
      if (ranges[i].from <= from + 0.25 && ranges[i].to >= to - 0.25) return true;
    }
    return false;
  },

  _mergeRanges: function (ranges, from, to) {
    var rows = (ranges || []).concat([{ from: from, to: to }]);
    rows.sort(function (a, b) { return a.from - b.from; });
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i], last = out[out.length - 1];
      if (last && row.from <= last.to + 1) last.to = Math.max(last.to, row.to);
      else out.push({ from: row.from, to: row.to });
    }
    return out;
  },

  /* Yalnizca oynatma konumunun cevresindeki TX3G orneklerini getirir. Bir batch
     tamamlanir tamamlanmaz cue'lari yayinlar; bolum sonunu beklemez. Tum isler
     global _range kuyrugundan gectigi icin ayni anda tek HTTP Range acilir. */
  loadWindow: function (info, sourceIndex, from, to, options) {
    var self = this;
    options = options || {};
    if (!info || !info.tracks || !info.tracks[sourceIndex]) {
      return Promise.reject(new Error('tx3g parcasi bulunamadi'));
    }
    var track = info.tracks[sourceIndex];
    from = Math.max(0, Number(from) || 0);
    to = Math.max(from + 1, Number(to) || (from + this.windowAheadSeconds));
    track.cues = track.cues || [];
    track.loadedRanges = track.loadedRanges || [];
    if (this._rangeCovered(track.loadedRanges, from, to)) {
      return Promise.resolve({ cues: track.cues, from: from, to: to, cached: true });
    }
    var wanted = [];
    for (var i = 0; i < track.samples.length; i++) {
      var sample = track.samples[i];
      var start = (sample.dts + sample.cto) / track.timescale;
      var end = start + Math.max(0.05, sample.duration / track.timescale);
      if (end > from && start < to && sample.size > 2 && sample.size <= 1024 * 1024) wanted.push(sample);
    }
    if (!track.timescale || !wanted.length) {
      track.loadedRanges = this._mergeRanges(track.loadedRanges, from, to);
      return Promise.resolve({ cues: track.cues, from: from, to: to, empty: true });
    }
    var batches = this._buildBatches(wanted, info.sourceUrl);
    if (batches.length > this.maxTrackRequests) {
      return Promise.reject(new Error('Altyazi cok parcali; sunucu guvenligi icin istek siniri asilmadi'));
    }
    var cursor = 0, completed = 0, started = Date.now();
    var context = {
      generation: this._generation,
      isActive: options.isActive,
      recoveries: 0,
      onRetry: function (message) { report(message); }
    };
    function report(message) {
      if (options.onProgress) options.onProgress(completed, wanted.length, {
        message: message || '', batch: Math.min(cursor + 1, batches.length), batches: batches.length,
        recoveries: context.recoveries, elapsed: Date.now() - started, from: from, to: to
      });
    }
    function waitWhilePaused() {
      self._checkActive(context);
      if (!options.shouldPause || !options.shouldPause()) return Promise.resolve();
      return new Promise(function (resolve) { setTimeout(resolve, 250); }).then(waitWhilePaused);
    }
    function worker() {
      self._checkActive(context);
      if (cursor >= batches.length) return Promise.resolve();
      return waitWhilePaused().then(function () {
        var batch = batches[cursor];
        return self._readSafe(info.sourceUrl, batch.start, batch.end, context).then(function (buffer) {
          self._checkActive(context);
          var batchCues = [];
          var batchReadyUntil = from;
          for (var s = 0; s < batch.samples.length; s++) {
            var sample = batch.samples[s];
            var part = buffer.slice(sample.offset - batch.start, sample.offset - batch.start + sample.size);
            var text = self._decodeSample(part);
            if (text) {
              var cueStart = (sample.dts + sample.cto) / track.timescale;
              var duration = sample.duration / track.timescale;
              batchCues.push({ start: cueStart, end: cueStart + Math.max(0.05, duration), text: text });
              batchReadyUntil = Math.max(batchReadyUntil, cueStart + Math.max(0.05, duration));
            }
          }
          self._mergeCues(track.cues, batchCues);
          cursor++; completed += batch.samples.length;
          if (options.onChunk) options.onChunk(track.cues, batchCues,
            { from: from, to: to, readyUntil: batchReadyUntil });
          report();
          return worker();
        });
      });
    }
    report();
    return worker().then(function () {
      track.loadedRanges = self._mergeRanges(track.loadedRanges, from, to);
      report();
      return { cues: track.cues, from: from, to: to, cached: false };
    })['catch'](function (error) {
      if (error.sourceChanged) {
        track.cues = []; track.loadedRanges = [];
        delete self._inspectCache[info.sourceUrl];
        delete self._identities[info.sourceUrl];
        delete self._resolvedUrls[info.sourceUrl];
      }
      error.progress = wanted.length ? Math.floor(completed / wanted.length * 100) : 0;
      throw error;
    });
  },

  loadTrack: function (info, sourceIndex, onProgress, isActive) {
    var self = this;
    if (!info || !info.tracks || !info.tracks[sourceIndex]) return Promise.reject(new Error('tx3g parcasi bulunamadi'));
    var track = info.tracks[sourceIndex];
    if (track.cues) return Promise.resolve(track.cues);
    if (track.loading) return track.loading;
    var wanted = [];
    for (var i = 0; i < track.samples.length; i++) {
      if (track.samples[i].size > 2 && track.samples[i].size <= 1024 * 1024) wanted.push(track.samples[i]);
    }
    var batches = this._buildBatches(wanted, info.sourceUrl);
    if (!track.timescale || !wanted.length) return Promise.reject(this._error('Gecerli zamanlanmis altyazi bulunamadi', true));
    var partial = track.partial;
    if (!partial || Date.now() - partial.updated > this.partialLifetime) {
      partial = { cues: [], cursor: 0, completed: 0, updated: Date.now(), batches: batches };
    }
    /* Yeniden denemede ag olcumu degisse bile onceki planin imlecini kullan. */
    batches = partial.batches;
    if (batches.length > this.maxTrackRequests) {
      return Promise.reject(new Error('Altyazi cok parcali; sunucu guvenligi icin istek siniri asilmadi'));
    }
    track.partial = partial;
    var cues = partial.cues, cursor = partial.cursor, completed = partial.completed;
    var started = Date.now(), initialCompleted = completed;
    var context = { generation: this._generation, isActive: isActive, recoveries: 0,
      onRetry: function (message) { report(message); } };
    function report(message) {
      if (onProgress) onProgress(completed, wanted.length, { message: message || '',
        batch: Math.min(cursor + 1, batches.length), batches: batches.length, recoveries: context.recoveries,
        elapsed: Date.now() - started, initialCompleted: initialCompleted });
      if (typeof Diag !== 'undefined') Diag.set('Altyazi indirme',
        completed + '/' + wanted.length + ' metin · ' + Math.min(cursor + 1, batches.length) + '/' + batches.length +
        ' istek grubu · ' + Math.round((Date.now() - started) / 1000) + ' sn · ' + context.recoveries + ' tekrar');
    }
    function worker() {
      self._checkActive(context);
      if (cursor >= batches.length) {
        return Promise.resolve();
      }
      var batch = batches[cursor];
      return self._readSafe(info.sourceUrl, batch.start, batch.end, context).then(function (buffer) {
        self._checkActive(context);
        var batchCues = [];
        for (var s = 0; s < batch.samples.length; s++) {
          var sample = batch.samples[s];
          var from = sample.offset - batch.start;
          var part = buffer.slice(from, from + sample.size);
          var text = self._decodeSample(part);
          if (text) {
            var start = (sample.dts + sample.cto) / track.timescale;
            var duration = sample.duration / track.timescale;
            batchCues.push({ start: start, end: start + Math.max(0.05, duration), text: text });
          }
        }
        Array.prototype.push.apply(cues, batchCues);
        cursor++;
        completed += batch.samples.length;
        partial.cursor = cursor; partial.completed = completed; partial.updated = Date.now();
        report();
        return worker();
      });
    }
    report();
    track.loading = Promise.resolve().then(function () {
      self._checkActive(context);
      if (cursor) {
        report('Kaynak dogrulaniyor');
        delete self._resolvedUrls[info.sourceUrl];
        return self._validateSource(info.sourceUrl, context);
      }
    }).then(worker).then(function () {
      self._checkActive(context);
      if (!cues.length) throw self._error('Altyazi parcasinda gosterilebilir metin bulunamadi', true);
      cues.sort(function (a, b) { return a.start - b.start; });
      track.cues = cues;
      track.partial = null;
      completed = wanted.length;
      report();
      track.loading = null;
      return cues;
    })['catch'](function (error) {
      track.loading = null;
      if (error.sourceChanged) {
        track.partial = null;
        delete self._inspectCache[info.sourceUrl];
        delete self._identities[info.sourceUrl];
        delete self._resolvedUrls[info.sourceUrl];
      }
      if (!error.cancelled) {
        self._cooldowns[info.sourceUrl] = Math.max(self._cooldowns[info.sourceUrl] || 0,
          Date.now() + (error.status === 404 ? 60000 : 30000));
      }
      error.progress = wanted.length ? Math.floor(completed / wanted.length * 100) : 0;
      if (error.status === 403 || error.status === 429) {
        error.message = 'Sunucu altyazi isteklerini reddetti. Islem durduruldu (HTTP ' + error.status + '). Daha sonra deneyin.';
      }
      throw error;
    });
    return track.loading;
  }
};
