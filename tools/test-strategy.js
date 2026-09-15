#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const memory = {};
global.localStorage = {
  getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
  setItem: function (key, value) { memory[key] = String(value); },
  removeItem: function (key) { delete memory[key]; }
};
global.window = { atob: function () { return ''; }, addEventListener: function () {} };
global.document = {};

vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'util.js'), 'utf8'), { filename: 'util.js' });

Store.set('settings', { engine: 'html5', liveFormat: 'ts', settingsVersion: 2 });
Settings.data = null;
Settings.load();
assert.strictEqual(Settings.get('liveEngine'), 'html5', 'Eski motor ayari canli TV tercihine tasinmali');
assert.strictEqual(Settings.get('vodEngine'), 'html5', 'Eski motor ayari VOD tercihine tasinmali');
assert.strictEqual(Settings.get('settingsVersion'), 9);
assert.strictEqual(Settings.get('tmdbCredential'), '');
assert.strictEqual(Settings.get('uiLanguage'), 'auto');
assert.strictEqual(Settings.get('contentRegion'), 'auto');
assert.strictEqual(Settings.get('avplayCompatibility'), 'auto');
assert.strictEqual(Settings.get('liveAspect'), 'auto');
assert.strictEqual(Settings.get('preferredAudio'), 'auto');
assert.strictEqual(Settings.get('preferredSubtitle'), 'off');

AccountData.use('http://panel-a.test:8080', 'user-a');
TrackLabels.set('ep:labels', ['tr'], ['tr', 'en']);
assert.deepStrictEqual(TrackLabels.get('ep:labels').text, ['tr', 'en'], 'Ogrenilen altyazi dilleri saklanmali');
const one = { engine: 'html5', extension: 'mp4', contentKey: 'ep:1' };
const two = { engine: 'html5', extension: 'mp4', contentKey: 'ep:2' };
const three = { engine: 'html5', extension: 'mp4', contentKey: 'ep:3' };
assert.strictEqual(SubtitleStrategy.resolve(one).mode, 'unknown');
SubtitleStrategy.noteNative(one);
assert.strictEqual(SubtitleStrategy.resolve(one).mode, 'native', 'Dogrulanan icerik kendi kararini hatirlamali');
assert.strictEqual(SubtitleStrategy.resolve(three).mode, 'unknown', 'Tek icerik sunucu geneli icin yeterli olmamali');
SubtitleStrategy.noteNative(two);
assert.strictEqual(SubtitleStrategy.resolve(three).mode, 'native', 'Iki farkli icerik uyumlu sunucu profilini olusturmali');

const broken = { engine: 'avplay', extension: '.mp4', contentKey: 'movie:9' };
SubtitleStrategy.noteSoftware(broken, { kind: 'mp4', tracks: [{
  sourceIndex: 1, lang: 'tur', signature: '8:12:4', samples: [{ offset: 123 }], cues: [{ text: 'gizli' }]
}] });
const manifest = SubtitleStrategy.getManifest(broken);
assert.strictEqual(manifest.tracks[0].sourceIndex, 1);
assert.strictEqual(manifest.tracks[0].manifestOnly, true);
assert.strictEqual(manifest.tracks[0].samples, undefined, 'Manifest buyuk ornek tablosunu saklamamali');
assert.strictEqual(manifest.tracks[0].cues, undefined, 'Altyazi metni strateji profiline yazilmamali');
SubtitleStrategy.noteNative(broken);
assert.strictEqual(SubtitleStrategy.resolve(broken).mode, 'native', 'Son dogrulama eski icerik kararinin yerini almali');
assert.strictEqual(SubtitleStrategy.getManifest(broken), null, 'Yerlesik yol dogrulaninca eski TX3G manifesti temizlenmeli');
assert.strictEqual(SubtitleStrategy.data.votes['avplay|mp4'].software['movie:9'], undefined,
  'Ayni icerigin karsit profil oyu tutulmamali');

AccountData.use('http://panel-b.test:8080', 'user-b');
assert.strictEqual(SubtitleStrategy.resolve(three).mode, 'unknown', 'Sunucu/hesap profilleri birbirine karismamali');

const serialized = JSON.stringify(memory);
assert.strictEqual(serialized.indexOf('password='), -1);
console.log('Ayar ve altyazi stratejisi testleri basarili.');
