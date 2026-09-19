#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const video = { currentTime: 5, textTracks: [], audioTracks: [] };
const silentCalls = [];
const selectedCalls = [];
global.window = { addEventListener: function () {} };
vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'util.js'), 'utf8'), { filename: 'util.js' });
global.Settings = { get: function () { return null; }, set: function () {} };
global.Diag = { set: function () {}, add: function () {} };
global.UI = { spin: function () {} };
global.window = {};
global.document = {
  getElementById: function (id) {
    if (id === 'html5player') return video;
    return { style: {}, className: '' };
  }
};
global.webapis = { avplay: {
  setSelectTrack: function (type, index) { selectedCalls.push([type, index]); },
  setSilentSubtitle: function (value) { silentCalls.push(value); }
} };

vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'tx3g.js'), 'utf8'), { filename: 'tx3g.js' });
vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'player.js'), 'utf8'), { filename: 'player.js' });
vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'api.js'), 'utf8'), { filename: 'api.js' });

assert.strictEqual(Api.normalize('panel.test:8080/'), 'http://panel.test:8080');
assert.strictEqual(Api.normalize('http://panel.test:8080/get.php?username=u&password=p&type=m3u_plus'),
  'http://panel.test:8080', 'Tam M3U adresi panel kokune indirgenmeli');
assert.strictEqual(Api.normalize('http://panel.test/iptv/player_api.php?username=u&password=p'),
  'http://panel.test/iptv', 'Panel alt dizini korunmali');
assert.strictEqual(Api.normalize('http://panel.test:8080/live/u/p/42.ts'),
  'http://panel.test:8080', 'Canli medya adresi panel kokune indirgenmeli');
assert.deepStrictEqual(Api.parseJsonResponse('\uFEFF  {"ok":true}'), { ok: true },
  'BOM ile baslayan gecerli JSON kabul edilmeli');
assert.throws(function () { Api.parseJsonResponse('<html>engel</html>'); }, /web sayfasi/);

const epgWithUnix = { start: '2000-01-01 00:00:00', end: '2000-01-01 01:00:00',
  start_timestamp: '1770000000', stop_timestamp: '1770003600' };
assert.strictEqual(epgStart(epgWithUnix).getTime(), 1770000000000, 'EPG Unix baslangici saat diliminden bagimsiz olmali');
assert.strictEqual(epgEnd(epgWithUnix).getTime(), 1770003600000, 'EPG Unix bitisi saat diliminden bagimsiz olmali');

const tur = ((116 - 96) << 10) | ((117 - 96) << 5) | (114 - 96);
assert.strictEqual(Tx3gSubtitles._language(tur), 'tur', 'MP4 dil kodu okunmali');
const subtitleBytes = Buffer.from('Günaydın', 'utf8');
const tx3gSample = new Uint8Array(subtitleBytes.length + 2);
tx3gSample[0] = (subtitleBytes.length >> 8) & 255;
tx3gSample[1] = subtitleBytes.length & 255;
tx3gSample.set(subtitleBytes, 2);
assert.strictEqual(Tx3gSubtitles._decodeSample(tx3gSample.buffer), 'Günaydın', 'TX3G UTF-8 metni okunmali');

const ftypHeader = new ArrayBuffer(16);
const ftypView = new DataView(ftypHeader);
ftypView.setUint32(0, 32, false);
['f', 't', 'y', 'p'].forEach(function (char, i) { ftypView.setUint8(4 + i, char.charCodeAt(0)); });
assert.deepStrictEqual(Tx3gSubtitles._header(ftypHeader), { type: 'ftyp', size: 32 },
  'Kismi Range icindeki MP4 kutu basligi okunmali');

const offsetSamples = [{}, {}, {}];
assert.strictEqual(Tx3gSubtitles._assignOffsets(
  offsetSamples, [4, 5, 6], [100, 200], [{ first: 1, perChunk: 2 }, { first: 2, perChunk: 1 }]
), true);
assert.deepStrictEqual(offsetSamples.map(function (item) { return [item.offset, item.size]; }),
  [[100, 4], [104, 5], [200, 6]], 'MP4 sample konumlari hesaplanmali');

Player.engine = 'avplay';
Player.tracks = Player.emptyTracks();
Player.tracks.text = [{ index: 7, sourceIndex: 0, label: 'Turkce' }];
Player.subtitleMuted = null;
assert.strictEqual(Player.selectSubtitle(7), true);
assert.deepStrictEqual(selectedCalls.pop(), ['TEXT', 7]);
assert.strictEqual(silentCalls.pop(), false, 'Yeni secimde AVPlay yerlesik altyaziyi gostermeli');

assert.strictEqual(Player.selectSubtitle('off'), true);
assert.strictEqual(silentCalls.pop(), true);
assert.strictEqual(Player.selectSubtitle(7), true);
assert.strictEqual(silentCalls.pop(), false, 'Kapali durumdan donerken altyazi acilmali');

let rendered = '';
Player.engine = 'html5';
Player.subtitleMuted = false;
Player.cb = { onSubtitle: function (value) { rendered = value; } };
Player._renderHtmlSubtitle({
  activeCues: [],
  cues: [{ startTime: 4, endTime: 8, text: 'Merhaba' }]
});
assert.strictEqual(rendered, 'Merhaba', 'Chromium 76 cue zaman cizelgesi yedegi calismali');

assert.strictEqual(Player.cleanSubtitleText('<i>Gunun</i><br>haberi'), 'Gunun\nhaberi');

let streamInfoCalls = 0;
webapis.avplay.getCurrentStreamInfo = function () {
  streamInfoCalls++;
  return [
    { type: 'VIDEO', extra_info: JSON.stringify({ width: 1920, height: 1080, fourCC: 'H264', Bit_rate: 4200000 }) },
    { type: 'AUDIO', extra_info: JSON.stringify({ fourCC: 'AAC', Bit_rate: 128000 }) }
  ];
};
webapis.avplay.getStreamingProperty = function (name) {
  assert.strictEqual(name, 'CURRENT_BANDWIDTH');
  return '6500000';
};
Player.engine = 'avplay';
Player.cb = { format: 'ts' };
const stats = Player.playbackStats();
assert.strictEqual(stats.width, 1920);
assert.strictEqual(stats.height, 1080);
assert.strictEqual(stats.bitrate, 4200000, 'Video bitrate ses bitrate ile karistirilmamali');
assert.strictEqual(stats.audioBitrate, 128000);
assert.strictEqual(stats.bandwidth, 6500000, 'Mevcut AVPlay oturumunun bant genisligi okunmali');
const cachedStats = Player.playbackStats();
assert.strictEqual(cachedStats.videoCodec, 'H264');
assert.strictEqual(streamInfoCalls, 1, 'Codec ve cozunurluk ayni oturumda yeniden sorgulanmamali');

Player.engine = 'html5';
Player.cb = { onSubtitle: function (value) { rendered = value; } };
Player.subtitleMuted = false;
Player._softwareSubtitleCues = [
  { start: 2, end: 4, text: 'Ilk' },
  { start: 5, end: 8, text: 'Ikinci' }
];
Player._softwareLastText = '';
Player._pos = 6;
Player._renderSoftwareSubtitle();
assert.strictEqual(rendered, 'Ikinci', 'Yazilimsal altyazi oynatma zamanina uymali');
for (const engine of ['html5', 'avplay']) {
  Player.engine = engine;
  Player._softwareSubtitleCues = [
    { start: 1, end: 20, text: 'Uzun' }, { start: 2, end: 3, text: 'Kisa' },
    { start: 5, end: 8, text: 'Ikinci' }
  ];
  Player._softwareLastText = '';
  Player._pos = 6; Player._renderSoftwareSubtitle();
  assert.strictEqual(rendered, 'Uzun\nIkinci', engine + ': cakisan metinler kaybolmaz');
  Player._pos = 21; Player._renderSoftwareSubtitle();
  assert.strictEqual(rendered, '', engine + ': ileri sarmada eski metin temizlenir');
  Player._pos = 2.5; Player._renderSoftwareSubtitle();
  assert.strictEqual(rendered, 'Uzun\nKisa', engine + ': geri sarmada metin geri gelir');
  Player.subtitleMuted = true;
  Player._pos = 7; Player._renderSoftwareSubtitle();
  assert.strictEqual(rendered, 'Uzun\nKisa', 'Kapali altyazi yeni metin uretmez');
  Player.subtitleMuted = false;
}
console.log('Tum testler basarili.');
