/* Read-only provider diagnosis. Credentials are read from environment, never logged.
   Run only while the account is idle on every other device. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');
let active = 0, peak = 0, requests = 0, bytes = 0;
class NodeXHR {
  constructor() { this.headers = {}; this.status = 0; this.timeout = 15000; this.stopped = false; }
  open(method, url) { this.url = url; }
  setRequestHeader(k, v) { this.headers[k] = v; }
  getResponseHeader(k) { return this.responseHeaders && this.responseHeaders[k.toLowerCase()] || null; }
  send() { active++; peak = Math.max(peak, active); this.counted = true; this.follow(this.url, 0); }
  release() { if (this.counted) { active--; this.counted = false; } }
  follow(url, redirects) {
    if (this.stopped) return;
    requests++;
    this.req = (url.startsWith('https:') ? https : http).get(url, { headers: this.headers, agent: false }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 6) {
        const target = new URL(res.headers.location, url).href;
        res.resume(); res.on('end', () => this.follow(target, redirects + 1)); return;
      }
      this.status = res.statusCode; this.responseHeaders = res.headers; this.responseURL = url;
      const chunks = []; let loaded = 0;
      res.on('data', chunk => {
        if (this.stopped) return;
        loaded += chunk.length; bytes += chunk.length;
        if (loaded > 32 * 1024 * 1024) { this.abort(); return; }
        chunks.push(chunk);
        if (this.onprogress) this.onprogress({ loaded });
      });
      res.on('end', () => {
        if (this.stopped) return;
        const b = Buffer.concat(chunks);
        this.response = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        this.release(); this.onload();
      });
      res.on('error', () => this.fail());
    });
    this.req.setTimeout(this.timeout, () => { this.req.destroy(); this.fail(true); });
    this.req.on('error', () => this.fail());
  }
  fail(timeout) {
    if (this.stopped) return;
    this.stopped = true; this.release();
    if (timeout && this.ontimeout) this.ontimeout(); else if (this.onerror) this.onerror();
  }
  abort() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.req) this.req.destroy();
    this.release(); if (this.onabort) this.onabort();
  }
}
global.XMLHttpRequest = NodeXHR;
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'tx3g.js'), 'utf8'));
const base = process.env.IPTV_TEST_SERVER;
const user = process.env.IPTV_TEST_USER;
const pass = process.env.IPTV_TEST_PASS;
function api(action, extra) {
  const url = new URL('/player_api.php', base);
  url.searchParams.set('username', user); url.searchParams.set('password', pass);
  if (action) url.searchParams.set('action', action);
  Object.entries(extra || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Promise((resolve, reject) => {
    const x = new NodeXHR(); x.open('GET', url.href);
    x.onload = () => {
      if (x.status !== 200) return reject(new Error('Panel HTTP ' + x.status));
      try { resolve(JSON.parse(Buffer.from(x.response).toString('utf8').replace(/^\uFEFF/, ''))); }
      catch (_) { reject(new Error('Panel JSON okunamadi')); }
    };
    x.onerror = x.ontimeout = x.onabort = () => reject(new Error('Panel baglantisi kesildi'));
    x.send();
  });
}
module.exports = { NodeXHR, api, subtitles: Tx3gSubtitles,
  counters: () => ({ active, peak, requests, bytes }) };
if (require.main === module) (async () => {
  if (!base || !user || !pass) throw new Error('IPTV_TEST_SERVER / USER / PASS gerekli');
  const account = await api();
  if (process.argv.includes('--status-only')) {
    console.log(JSON.stringify({ activeConnections: Number(account.user_info && account.user_info.active_cons),
      maxConnections: Number(account.user_info && account.user_info.max_connections) }));
    return;
  }
  if (Number(account.user_info && account.user_info.active_cons) > 0) throw new Error('Hesapta aktif yayin var; test baslatilmadi');
  const series = await api('get_series');
  const matches = Object.values(series).filter(s => /pluribus/i.test(s.name || ''));
  console.log(JSON.stringify({ series: matches.map(s => ({ id: s.series_id, name: s.name })) }));
  if (!matches.length) throw new Error('Pluribus bulunamadi');
  const details = await api('get_series_info', { series_id: matches[0].series_id });
  const eps = Object.values(details.episodes).flat();
  for (const number of [3, 8]) {
    const ep = eps.find(e => Number(e.season) === 1 && Number(e.episode_num) === number);
    if (!ep) { console.log('Episode missing: ' + number); continue; }
    const media = new URL('/series/' + encodeURIComponent(user) + '/' + encodeURIComponent(pass) + '/' + ep.id + '.' + ep.container_extension, base).href;
    const started = performance.now(), before = requests, beforeBytes = bytes;
    console.log(JSON.stringify({ episode: number, phase: 'inspect' }));
    const timer = setTimeout(() => Tx3gSubtitles.cancel(), 8 * 60 * 1000);
    try {
      const info = await Tx3gSubtitles.inspect(media);
      console.log(JSON.stringify({ episode: number, kind: info.kind, tracks: info.tracks.map(t => ({
        index: t.sourceIndex, lang: t.lang, timescale: t.timescale, samples: t.samples.length,
        batches: Tx3gSubtitles._buildBatches(t.samples.filter(s => s.size > 2), media).length
      })) }));
      if (process.argv.includes('--inspect-only')) {
        const t = info.tracks.find(t => t.lang === 'tur') || info.tracks[0];
        if (t) {
          const samples = t.samples.filter(s => s.size > 2);
          const original = [Tx3gSubtitles.maxBatchBytes, Tx3gSubtitles.maxBatchGap];
          const plans = [[64, 64], [256, 64], [512, 256], [1024, 512]].map(([size, gap]) => {
            Tx3gSubtitles.maxBatchBytes = size * 1024; Tx3gSubtitles.maxBatchGap = gap * 1024;
            const batches = Tx3gSubtitles._buildBatches(samples);
            return { sizeKiB: size, gapKiB: gap, requests: batches.length,
              bytes: batches.reduce((sum, b) => sum + b.end - b.start + 1, 0) };
          });
          [Tx3gSubtitles.maxBatchBytes, Tx3gSubtitles.maxBatchGap] = original;
          console.log(JSON.stringify({ episode: number, plans }));
        }
      }
      if (process.argv.includes('--inspect-only')) continue;
      const track = info.tracks.find(t => t.lang === 'tur') || info.tracks[0];
      if (!track) continue;
      let last = -1;
      const cues = await Tx3gSubtitles.loadTrack(info, track.sourceIndex, (done, total, status) => {
        const pct = Math.floor(done * 100 / total);
        if (Math.floor(pct / 10) !== last || status.message) {
          last = Math.floor(pct / 10);
          console.log(JSON.stringify({ episode: number, progress: pct, seconds: Math.round((performance.now() - started) / 1000),
            batch: status.batch, batches: status.batches, recoveries: status.recoveries, message: status.message }));
        }
      });
      console.log(JSON.stringify({ episode: number, result: 'complete', cues: cues.length,
        validTiming: cues.every(c => Number.isFinite(c.start) && c.end > c.start && c.text.length > 0),
        seconds: Math.round((performance.now() - started) / 1000), requests: requests - before, bytes: bytes - beforeBytes, peak }));
    } catch (error) {
      console.log(JSON.stringify({ episode: number, result: 'failed', status: error.status || 0,
        progress: error.progress, seconds: Math.round((performance.now() - started) / 1000), diagnostics: Tx3gSubtitles.diagnostics.slice(-5) }));
      // A possible provider refusal ends all further media tests.
      break;
    } finally { clearTimeout(timer); Tx3gSubtitles.cancel(); }
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
})().catch(error => { console.error(/aktif yayin|gerekli|bulunamadi|Panel/.test(error.message) ? error.message : 'Teshis tamamlanamadi'); process.exitCode = 1; });
