#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const element = {
  className: '', style: {}, pause: function () {}, load: function () {},
  removeAttribute: function () {}, textTracks: [], audioTracks: []
};
global.window = {};
global.document = { body: { className: '' }, getElementById: function () { return element; } };
const settingValues = { engine: 'auto', liveEngine: 'html5', vodEngine: 'avplay' };
global.Settings = { get: function (key) { return settingValues[key]; }, set: function () {} };
global.Diag = { set: function () {}, add: function () {} };
global.UI = { spin: function () {} };
global.SubtitleCache = { get: function () { return null; }, set: function () { return true; } };
const nativeSelections = [];
global.webapis = { avplay: {
  stop: function () {}, close: function () {}, setSilentSubtitle: function () {},
  setSelectTrack: function (type, index) { nativeSelections.push([type, index]); }
} };

let loads = 0;
let inspections = 0;
global.Tx3gSubtitles = {
  inspect: function () {
    inspections++;
    return Promise.resolve({ kind: 'mp4', sourceUrl: 'test', tracks: [{
      sourceIndex: 0, lang: 'tur', signature: '1:2:3', samples: [{}], cues: null
    }] });
  },
  loadTrack: function (info, index, progress) {
    loads++;
    progress(1, 1);
    info.tracks[index].cues = [{ start: 1, end: 2, text: 'Test' }];
    return Promise.resolve(info.tracks[index].cues);
  }
};

vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'player.js'), 'utf8'), { filename: 'player.js' });
Player.show = function () {};
Player._startTick = function () {};
let starts = 0;
Player._avStart = function () { starts++; };

async function flush() {
  await Promise.resolve();
  await new Promise(function (resolve) { setTimeout(resolve, 5); });
}

(async function () {
  assert.strictEqual(Player.pick(true), 'html5', 'Canli TV motor tercihi ayri okunmali');
  assert.strictEqual(Player.pick(false), 'avplay', 'VOD motor tercihi ayri okunmali');

  let scheduled = 0;
  Player._scheduleEngineStart = function () { scheduled++; };
  Player.play('test.mp4', {
    live: false, subtitlePreference: 'lang:tr', subtitleCacheKey: 'ep:1',
    onPreparation: function () {}
  });
  assert.strictEqual(starts, 1, 'VOD oynaticisi kaynak incelemesi beklemeden acilmali');
  assert.strictEqual(inspections, 0, 'Film acilisinda kaynak incelemesi yapilmamali');
  assert.strictEqual(loads, 0, 'Film acilisinda TX3G kendiliginden indirilmemeli');
  assert.strictEqual(Player.requestedSubtitlePreference(), 'lang:tr', 'Acik genel veya icerik tercihi oynaticiya aktarilmali');

  Player.tracks = Player.emptyTracks();
  Player.tracks.text = [{ index: 4, sourceIndex: 0, lang: 'tr', label: 'Türkçe', preferenceKey: 'lang:tr' }];
  Player._readyAt = Date.now();
  assert.strictEqual(Player.selectSubtitle(4), true, 'Ilk secimde yerlesik altyazi denenebilmelidir');
  assert.deepStrictEqual(nativeSelections.pop(), ['TEXT', 4], 'Bilinmeyen sunucuda ilk secim beklemeden yerlesik oynaticiya gitmeli');
  assert.strictEqual(inspections, 0, 'Ilk secimde kaynak incelenmemeli ve ikinci baglanti acilmamali');

  assert.strictEqual(Player.selectSubtitle(4), true, 'Ayni altyaziyi tekrar secmek yalnizca yerlesik yolu yeniden uygulamali');
  assert.strictEqual(inspections, 0, 'Ikinci OK gizli bir uyumluluk islemi baslatmamali');
  await new Promise(function (resolve) { setTimeout(resolve, 700); });
  await flush();
  assert.strictEqual(inspections, 0, 'Ikinci OK gecikmeli olarak da kaynak incelemesi baslatmamali');
  assert.strictEqual(Player.canStartSubtitleCompatibility(), true, 'Gorunmeyen yerlesik altyazi icin acik eylem sunulmali');
  assert.strictEqual(Player.startSubtitleCompatibility(), true, 'Acik uyumluluk eylemi TX3G yolunu baslatmali');
  assert.strictEqual(inspections, 0, 'Aktif medya baglantisi kapanmadan inceleme baslamamali');
  await new Promise(function (resolve) { setTimeout(resolve, 700); });
  await flush();
  assert.strictEqual(inspections, 1, 'Kaynak yalnizca ikinci kullanici seciminden sonra incelenmeli');
  assert.strictEqual(loads, 1, 'Secilen TX3G parcasi kullanici talebiyle hazirlanmali');
  assert.strictEqual(scheduled, 1, 'Altyazi tamamlandiktan sonra oynatici yeniden acilmali');
  assert.strictEqual(Player.requestedSubtitlePreference(), 'lang:tr', 'Secim yeniden acilis boyunca korunmali');

  Player._preparing = false;
  Player._engineStarted = true;
  Player._readyAt = Date.now();
  Player.engine = 'html5';
  Player.live = false;
  Player._pos = 0;
  Player._dur = 1000;
  element.currentTime = 0;
  assert.strictEqual(Player.seek(30), true);
  assert.strictEqual(Player.seek(30), true);
  assert.strictEqual(Player._pos, 60, 'Hizli tuslar ekrandaki hedefi aninda guncellemeli');
  await new Promise(function (resolve) { setTimeout(resolve, 450); });
  assert.strictEqual(element.currentTime, 60, '400 ms icindeki basuslar tek sarmada birlesmeli');

  Player._readyAt = 0;
  let seekWarning = '';
  Player.cb.onSeekStatus = function (message) { seekWarning = message; };
  assert.strictEqual(Player.seek(30), false, 'Oynatici hazir degilken sarma gonderilmemeli');
  assert.ok(seekWarning.indexOf('hazirlaniyor') !== -1, 'Kullaniciya hazirlaniyor bilgisi verilmeli');
  let errorState;
  Player._preparationSkip = false;
  Player.cb.onPreparation = function (state) { errorState = state; };
  Player._preparationProgress = 57;
  Player._preparationFailed(new Error('HTTP Range 404'), Player._sessionId);
  assert.strictEqual(errorState.stage, 'error');
  assert.strictEqual(errorState.progress, 57, 'Hata ekraninda son yuzde korunur');
  assert.strictEqual(Player._preparationError, true);
  let lateReady = 0;
  Player._engineStarted = false; Player._readyAt = 0;
  Player.cb.onReady = function () { lateReady++; };
  Player._notifyReady();
  assert.strictEqual(lateReady, 0, 'Kapanan oynaticinin gec gelen ready olayi hazirlik ekranini bozmaz');
  const originalGet = SubtitleCache.get;
  SubtitleCache.get = function () { throw new Error('Eski imzali onbellek okunmamali'); };
  assert.strictEqual(Player._restoreSubtitleCache({ signature: '123:456:789' }), false);
  SubtitleCache.get = originalGet;
  console.log('Preflight testleri basarili.');
})()['catch'](function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
