#!/usr/bin/env node
'use strict';

/* Servis 7: bayat CDN adresi tazeleme ve video yanitlarinda CORS.
   Ag kullanilmaz: sahte panel (302) + sahte CDN (gecici anahtarli adres)
   127.0.0.1 uzerinde kurulur, gercek servis dosyasi ayri surecte calisir. */
const assert = require('assert');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');

function box(type, body) {
  const out = Buffer.alloc(8 + body.length);
  out.writeUInt32BE(out.length, 0);
  out.write(type, 4, 4, 'ascii');
  body.copy(out, 8);
  return out;
}
function track(id, handler) {
  const tkhdBody = Buffer.alloc(24);
  tkhdBody.writeUInt32BE(id, 12);
  const hdlrBody = Buffer.alloc(20);
  hdlrBody.write(handler, 8, 4, 'ascii');
  return box('trak', Buffer.concat([box('tkhd', tkhdBody), box('mdia', box('hdlr', hdlrBody))]));
}
const tracks = [track(1, 'vide'), track(2, 'soun')];
for (let i = 3; i <= 35; i++) tracks.push(track(i, 'sbtl'));
const moov = box('moov', Buffer.concat([box('mvhd', Buffer.alloc(104))].concat(tracks)));
const ftyp = box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2avc1mp41', 'latin1'));
const DOSYA = Buffer.concat([ftyp, moov, box('mdat', Buffer.alloc(200000, 7))]);

/* Sahte saglayici: panel adresi gecerli anahtarli CDN adresine yonlendirir.
   Anahtar degisince eski adres "bayat" olur: 404 ya da baglanti kopmasi. */
let anahtar = 'a1', bayatDavranis = '404';
const sayac = { panel: 0, cdn: 0, bayat: 0 };
const kaynak = http.createServer((req, res) => {
  if (req.url === '/series/u/p/1.mp4') {
    sayac.panel++;
    res.writeHead(302, { Location: '/cdn/' + anahtar + '/1.mp4' });
    return res.end();
  }
  const m = /^\/cdn\/([^/]+)\/1\.mp4$/.exec(req.url);
  if (!m) { res.writeHead(404); return res.end(); }
  if (m[1] !== anahtar) {
    sayac.bayat++;
    if (bayatDavranis === 'kopma') return req.socket.destroy();
    res.writeHead(404); return res.end('token expired');
  }
  sayac.cdn++;
  const r = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  const a = r ? +r[1] : 0, b = r && r[2] ? Math.min(+r[2], DOSYA.length - 1) : DOSYA.length - 1;
  res.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': b - a + 1,
    'Content-Range': 'bytes ' + a + '-' + b + '/' + DOSYA.length });
  res.end(DOSYA.slice(a, b + 1));
});

function bosPort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
function istek(port, yol, o) {
  o = o || {};
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: yol, method: o.method || 'GET', headers: o.headers || {} }, (y) => {
      const p = [];
      y.on('data', (c) => p.push(c));
      y.on('end', () => resolve({ kod: y.statusCode, h: y.headers, govde: Buffer.concat(p) }));
      y.on('error', reject);
    });
    r.on('error', reject);
    r.setTimeout(10000, () => { r.destroy(); reject(new Error('zaman asimi ' + yol)); });
    if (o.body) r.write(o.body);
    r.end();
  });
}
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => kaynak.listen(0, '127.0.0.1', r));
  const kp = kaynak.address().port;
  const SP = await bosPort();
  const servis = spawn(process.execPath, [path.join(root, 'service', 'servis.js')], {
    env: Object.assign({}, process.env, { HM_SERVIS_PORT: String(SP), HM_SERVIS_TEST: '1', HM_SERVIS_TAZE_MS: '1500' }),
    stdio: 'ignore'
  });
  try {
    let d = null;
    for (let i = 0; i < 40 && !d; i++) { try { d = await istek(SP, '/durum'); } catch (e) { await bekle(100); } }
    assert(d, 'Servis ayaga kalkmali');
    const durum = JSON.parse(d.govde.toString());
    assert.strictEqual(durum.surum, 7, 'Servis surumu 7 olmali');
    const s = durum.oturum;
    const ORIGIN = 'file://';
    const panel = 'http://127.0.0.1:' + kp + '/series/u/p/1.mp4';

    const inc = JSON.parse((await istek(SP, '/incele?s=' + s, { method: 'POST', body: JSON.stringify({ kaynak: panel }),
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN } })).govde.toString());
    assert(inc.ok && inc.ayiklandi, 'Dosya hazirlanmali');
    assert.strictEqual(inc.izOnce, 35);
    const id = inc.kimlik;

    /* 1) CORS: altyazi okuyucusunun ham kaynak yaniti istemcinin Origin'ini dondurmeli. */
    const o = await istek(SP, '/o/' + id + '/source.mp4?s=' + s, { headers: { Origin: ORIGIN, Range: 'bytes=0-1023' } });
    assert.strictEqual(o.kod, 206);
    assert.strictEqual(o.h['access-control-allow-origin'], ORIGIN, '/o/ yaniti Origin\'i dondurmeli (null degil)');
    const v0 = await istek(SP, '/v/' + id + '/video.mp4?s=' + s, { headers: { Origin: ORIGIN, Range: 'bytes=0-15' } });
    assert.strictEqual(v0.h['access-control-allow-origin'], ORIGIN, '/v/ yaniti Origin\'i dondurmeli');

    /* 2) Oynatma sirasinda anahtar bayatlar (404): servis tazeleyip ayni istegi tamamlar. */
    anahtar = 'b2'; bayatDavranis = '404';
    const bayat404 = sayac.bayat;
    const v1 = await istek(SP, '/v/' + id + '/video.mp4?s=' + s, { headers: { Range: 'bytes=100000-100999' } });
    assert.strictEqual(v1.kod, 206);
    assert.strictEqual(v1.govde.length, 1000, '404 donen bayat adresten sonra veri eksiksiz gelmeli');
    assert(v1.govde.equals(DOSYA.slice(100000, 101000)), 'Tazeleme sonrasi baytlar kaynakla ayni olmali');
    assert.strictEqual(sayac.bayat, bayat404 + 1, 'Bayat adres yalnizca bir kez denenmeli');

    /* 3) Baglanti kopmasi da tazelemeyi tetikler. */
    anahtar = 'c3'; bayatDavranis = 'kopma';
    const v2 = await istek(SP, '/v/' + id + '/video.mp4?s=' + s, { headers: { Range: 'bytes=150000-150499' } });
    assert.strictEqual(v2.govde.length, 500, 'Kopan bayat baglantidan sonra veri gelmeli');

    /* 4) Uzun sure kullanilmayan kayit, yeniden acilista (/incele) once tazelenir. */
    anahtar = 'd4'; bayatDavranis = '404';
    await bekle(1700);
    const panelOnce = sayac.panel, bayatOnce = sayac.bayat;
    const inc2 = JSON.parse((await istek(SP, '/incele?s=' + s, { method: 'POST', body: JSON.stringify({ kaynak: panel }),
      headers: { 'Content-Type': 'application/json' } })).govde.toString());
    assert(inc2.ok, 'Yeniden acilis basarili olmali');
    assert.strictEqual(inc2.kimlik, id, 'Iz bilgisi ayni kayitla korunmali (yeniden indirilmez)');
    assert.strictEqual(sayac.panel, panelOnce + 1, 'Bayat kayit icin panelden tek tazeleme yapilmali');
    const v3 = await istek(SP, '/v/' + id + '/video.mp4?s=' + s, { headers: { Range: 'bytes=0-2047' } });
    assert.strictEqual(v3.govde.length, 2048);
    assert.strictEqual(sayac.bayat, bayatOnce, 'Onceden tazelenen kayitta bayat adres hic denenmemeli');

    /* 5) Taze kayit tekrar tazelenmez (gereksiz panel istegi yok). */
    const panelSimdi = sayac.panel;
    await istek(SP, '/incele?s=' + s, { method: 'POST', body: JSON.stringify({ kaynak: panel }), headers: { 'Content-Type': 'application/json' } });
    assert.strictEqual(sayac.panel, panelSimdi, 'Taze kayit icin panele istek gitmemeli');

    const kayit = JSON.parse((await istek(SP, '/kayit?s=' + s)).govde.toString()).kayit.join('\n');
    assert(/kaynak adresi yenileniyor/.test(kayit), 'Tazeleme gunluge yazilmali');
    assert(!/\/u\/p\//.test(kayit), 'Gunlukte kaynak yolu (kimlik bilgisi) olmamali');
    console.log('Servis 7 bayat adres tazeleme ve CORS testleri PASS');
  } finally {
    servis.kill();
    kaynak.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
