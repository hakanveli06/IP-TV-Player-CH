'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
function fresh() {
  const sandbox = { Promise, Uint8Array, DataView, ArrayBuffer, URL, setTimeout, clearTimeout, Date };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/tx3g.js'), 'utf8'), sandbox);
  const t = sandbox.Tx3gSubtitles;
  t.minRequestInterval = 0; t.retryDelay = 1;
  return { sandbox, t };
}
function fixture() {
  const data = Buffer.alloc(2200000);
  const texts = ['Günaydın', 'İkinci satır', 'Son satır'];
  const samples = texts.map((text, i) => {
    const b = Buffer.from(text), offset = 1000 + i * 1000000;
    data.writeUInt16BE(b.length, offset); b.copy(data, offset + 2);
    return { offset, size: b.length + 2, duration: 2000, dts: i * 3000, cto: 0 };
  });
  return { data, info: { sourceUrl: 'http://panel.test/series/private/secret/1.mp4',
    tracks: [{ timescale: 1000, samples, cues: null }] } };
}
function transport(env, f, route) {
  const calls = []; let active = 0, peak = 0;
  env.sandbox.XMLHttpRequest = function () {
    this.open = (method, url) => { this.url = url; };
    this.setRequestHeader = (key, value) => { this.range = value; };
    this.getResponseHeader = key => this.headers[key.toLowerCase()] || null;
    this.abort = () => {
      if (this.timer) clearTimeout(this.timer);
      if (this.running) { active--; this.running = false; }
      if (this.onabort) this.onabort();
    };
    this.send = () => {
      const [, start, end] = this.range.match(/bytes=(\d+)-(\d+)/).map(Number);
      const call = { url: this.url, start, end };
      calls.push(call); active++; this.running = true; peak = Math.max(peak, active);
      const result = route ? route(call, calls) || {} : {};
      this.timer = setTimeout(() => {
        active--; this.running = false;
        if (result.network) { this.onerror(); return; }
        this.status = result.status || 206;
        this.responseURL = result.url || 'http://node.test/temporary-token';
        this.headers = { 'content-range': result.range || 'bytes ' + start + '-' + end + '/' + f.data.length };
        const body = result.body || f.data.subarray(start, end + 1);
        this.response = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
        this.onload();
      }, result.delay || 1);
    };
  };
  return { calls, peak: () => peak };
}
function identity(env, f) {
  const buffer = f.data.buffer.slice(f.data.byteOffset, f.data.byteOffset + 16);
  env.t._identities[f.info.sourceUrl] = { offset: 0, size: 16, total: f.data.length,
    fingerprint: env.t._fingerprint(buffer) };
}
(async () => {
  {
    const env = fresh(), f = fixture(); identity(env, f);
    let failed = false;
    const net = transport(env, f, call => {
      if (call.start === 1001000 && !failed) { failed = true; return { status: 404 }; }
    });
    const progress = [];
    const cues = await env.t.loadTrack(f.info, 0, (done, total, state) => progress.push({ done, message: state.message }));
    assert.strictEqual(cues.length, 3);
    assert.strictEqual(cues[1].text, 'İkinci satır');
    assert.strictEqual(net.calls.filter(c => c.start === 1000).length, 1, 'Tamamlanan parca tekrar indirilmez');
    assert.strictEqual(net.calls[2].url, f.info.sourceUrl, '404 sonrasinda asil adresten moov dogrulamasi');
    assert.strictEqual(net.calls.filter(c => c.start === 1001000).length, 2);
    assert.ok(progress.some(p => p.done === 1 && p.message === 'Adres yenileniyor'));
    assert.strictEqual(net.peak(), 1);
    const count = net.calls.length;
    await env.t.loadTrack(f.info, 0);
    assert.strictEqual(net.calls.length, count, 'Tamamlanmis onbellek sifir ek istek');
    assert.ok(!JSON.stringify(env.t.diagnostics).includes('secret'));
    assert.ok(!JSON.stringify(env.t.diagnostics).includes('temporary-token'));
  }
  {
    const env = fresh(), f = fixture(); identity(env, f);
    transport(env, f, call => call.start === 1001000 ? { status: 404 } :
      call.start === 0 ? { body: Buffer.alloc(16, 7) } : {});
    await assert.rejects(env.t.loadTrack(f.info, 0), e => e.sourceChanged && e.progress === 33);
    assert.strictEqual(f.info.tracks[0].cues, null, 'Degismis dosya yayinlanmaz');
    assert.strictEqual(f.info.tracks[0].partial, null, 'Eski konumlar atilir');
  }
  {
    const env = fresh(), f = fixture(); identity(env, f);
    let fail = true;
    const net = transport(env, f, call => fail && call.start === 1001000 ? { status: 503 } : {});
    await assert.rejects(env.t.loadTrack(f.info, 0), e => e.status === 503 && e.progress === 33);
    assert.strictEqual(f.info.tracks[0].cues, null, 'Eksik altyazi tamamlandi sayilmaz');
    assert.strictEqual(f.info.tracks[0].partial.completed, 1);
    fail = false; env.t._cooldowns = {};
    assert.strictEqual((await env.t.loadTrack(f.info, 0)).length, 3);
    assert.strictEqual(net.calls.filter(c => c.start === 1000).length, 1, 'Manuel tekrar kaldigi yerden surer');
  }
  for (const status of [401, 403, 410, 416, 429]) {
    const env = fresh(), f = fixture();
    const net = transport(env, f, () => ({ status }));
    await assert.rejects(env.t.loadTrack(f.info, 0));
    assert.strictEqual(net.calls.length, 1, status + ' tekrarlanmaz');
  }
  {
    const env = fresh(), f = fixture();
    const net = transport(env, f, () => ({ status: 404 }));
    await assert.rejects(env.t.loadTrack(f.info, 0), e => e.status === 404);
    assert.strictEqual(net.calls.length, 2, 'Kalici 404 icin yalnizca tek tekrar');
  }
  {
    const env = fresh(), f = fixture();
    const net = transport(env, f, () => ({ range: 'bytes 0-5/220000' }));
    await assert.rejects(env.t.loadTrack(f.info, 0), /yanlis byte/);
    assert.strictEqual(net.calls.length, 1);
  }
  {
    const env = fresh(), f = fixture();
    const net = transport(env, f, () => ({ delay: 30 }));
    const jobs = [env.t._range(f.info.sourceUrl, 0, 15), env.t._range(f.info.sourceUrl, 16, 31)];
    const outcomes = Promise.allSettled(jobs);
    await new Promise(resolve => setTimeout(resolve, 5));
    env.t.cancel();
    const results = await outcomes;
    assert.ok(results.every(r => r.status === 'rejected' && r.reason.cancelled));
    assert.strictEqual(net.calls.length, 1, 'Iptal sonrasi kuyruktaki istek acilmaz');
    await env.t._range(f.info.sourceUrl, 0, 15);
    assert.strictEqual(net.peak(), 1, 'Yeni is eski istekle cakismiyor');
  }
  {
    const env = fresh(), f = fixture();
    const net = transport(env, f);
    await Promise.all([env.t._range(f.info.sourceUrl, 0, 15), env.t._range(f.info.sourceUrl, 16, 31)]);
    assert.strictEqual(net.peak(), 1, 'Bagimsiz cagiranlar da sirali');
    const samples = Array.from({ length: 10 }, (_, i) => ({ offset: i * 20000, size: 16 }));
    assert.strictEqual(env.t._buildBatches(samples).length, 1, 'Yakindaki 10 parca tek istekte');
    env.t.maxBatchOverfetch = 100;
    assert.strictEqual(env.t._buildBatches(samples).length, 10, 'Fazla indirme butcesi korunur');
    env.t.maxBatchOverfetch = 8 * 1024 * 1024;
    env.t._network.slow = { latency: 50, bytesPerMs: 20 };
    assert.strictEqual(env.t._buildBatches(samples, 'slow').length, 10, 'Yavas agda buyuk bosluklar indirilmez');
  }
  {
    const env = fresh(), f = fixture();
    env.t.retryDelay = 30;
    const net = transport(env, f, () => ({ status: 503 }));
    const job = env.t.loadTrack(f.info, 0, (done, total, state) => {
      if (state.message) env.t.cancel();
    });
    await assert.rejects(job, e => e.cancelled);
    assert.strictEqual(net.calls.length, 1, 'Tekrar beklerken iptal yeni istek gondermez');
  }
  console.log('Altyazi yenileme, dosya dogrulama, devam, iptal ve tek istek testleri basarili.');
})().catch(e => { console.error(e); process.exitCode = 1; });
