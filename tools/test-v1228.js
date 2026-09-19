#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

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
  return box('trak', Buffer.concat([
    box('tkhd', tkhdBody),
    box('mdia', box('hdlr', hdlrBody))
  ]));
}

function syntheticMoov() {
  const mvhd = Buffer.alloc(104);
  const tracks = [track(1, 'vide'), track(2, 'soun')];
  for (let i = 3; i <= 45; i++) tracks.push(track(i, 'sbtl'));
  return box('moov', Buffer.concat([box('mvhd', mvhd)].concat(tracks)));
}

process.env.HM_SERVIS_PORT = '0';
process.env.HM_SERVIS_TEST = '1';
const service = require(path.join(root, 'service', 'servis.js'));

try {
  const source = syntheticMoov();
  const filtered = service.izAyikla(source);
  assert.strictEqual(filtered.izOnce, 45, 'Sentetik kaynakta 45 iz olmali');
  assert.strictEqual(filtered.izSonra, 2, 'Yalniz video ve ses izleri kalmali');
  assert(filtered.bolge, 'Ayiklanmis moov bolgesi uretilmeli');
  assert.strictEqual(filtered.bolge.length, source.length, 'Dosya ofsetleri icin moov bolgesi ayni boyda kalmali');
  const newMoovSize = filtered.bolge.readUInt32BE(0);
  assert.strictEqual(filtered.bolge.toString('ascii', 4, 8), 'moov');
  assert.strictEqual(filtered.bolge.toString('ascii', newMoovSize + 4, newMoovSize + 8), 'free');

  const config = read('config.xml');
  const index = read('index.html');
  const app = read('js/app.js');
  const player = read('js/player.js');
  const client = read('js/servis.js');
  const server = read('service/servis.js');
  const build = read('tools/build.js');
  const pkg = JSON.parse(read('package.json'));

  assert(/^2\.0\.0$/.test(pkg.version));
  assert(config.includes('version="' + pkg.version + '"'));
  assert(config.includes('<tizen:service id="HV9K26T901.HMServis"'));
  assert(config.includes('http://tizen.org/privilege/application.launch'));
  assert(index.includes('js/servis.js'));
  assert(!index.includes('wasm-compat'));
  assert(!build.includes('hm-wasm-player'), 'WASM dosyalari yeni pakete girmemeli');
  assert(!build.includes('Family ZIP hazir'), 'Family derlemesi yeni ZIP uretmemeli');

  assert(/GEREKEN_SURUM: (?:6|7),/.test(client));
  assert(client.includes("requestJson('/incele', 'POST'"));
  assert(client.includes("'/v/' + encodeURIComponent(kimlik) + '/video.mp4?s='"));
  assert(client.includes("'/o/' + encodeURIComponent(kimlik) + '/source.mp4?s='"));
  assert(!client.includes('/incele?u='), 'Kaynak adresi URL sorgusuna yazilmamali');
  assert(server.includes("var ADRES = '127.0.0.1'"));
  assert(server.includes('maxSockets: 2'));
  assert(server.includes("/^\\/v\\/([a-z0-9]+)\\/video\\.mp4$/"));
  assert(server.includes("/^\\/o\\/([a-z0-9]+)\\/source\\.mp4$/"));

  assert(app.includes('startLocalMp4Fallback'));
  assert(app.includes("return typeof Servis !== 'undefined' && !!Servis"),
    'OK secenegi yanlis uzanti/capability bildirimi yuzunden gizlenmemeli');
  assert(!app.includes("return ext === 'mp4' || ext === 'm4v'"));
  assert(app.includes("self.startVod(meta, 'avplay')"));
  assert(app.includes('subtitleSourceUrl: subtitleSourceUrl'));
  assert(app.includes('meta._localSubtitleManifest'));
  assert(player.includes("index: 'software:' + s"), 'Ayiklanan yerlesik izler yazilimsal listede yeniden olusmali');
  assert(player.includes('this._subtitleUrl = opts.subtitleSourceUrl || url'));
  assert(!app.includes('startWasmCompat'));
  assert(!player.includes("engine === 'wasm'"));

  const sandbox = { window: {}, document: {}, setTimeout, clearTimeout, setInterval, clearInterval };
  vm.createContext(sandbox);
  vm.runInContext(player, sandbox);
  const p = sandbox.Player;
  p.tracks = p.emptyTracks();
  p._softwareSubInfo = { tracks: [
    { sourceIndex: 0, lang: 'tur' },
    { sourceIndex: 1, lang: 'eng' }
  ] };
  p._decorateSoftwareTracks();
  assert.strictEqual(p.tracks.text.length, 2, 'Sade AVPlay kaynaginda yazilimsal altyazilar yeniden listelenmeli');
  assert.strictEqual(p.tracks.text[0].label, 'Türkçe');
  assert.strictEqual(p.tracks.text[1].label, 'İngilizce');
  assert.strictEqual(p.tracks.text[0].softwareIndex, 0);

  console.log('v1.22.10 yerel MP4 video, sarma ve altyazi listesi testleri PASS');
} finally {
  service.onExit();
}
