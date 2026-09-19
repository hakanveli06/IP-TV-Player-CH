#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const memory = {};
global.localStorage = {
  get length() { return Object.keys(memory).length; },
  key: function (index) { return Object.keys(memory)[index] || null; },
  getItem: function (key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
  setItem: function (key, value) { memory[key] = String(value); },
  removeItem: function (key) { delete memory[key]; }
};
global.window = { atob: function () { return ''; }, addEventListener: function () {} };
global.document = {};

vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'util.js'), 'utf8'), { filename: 'util.js' });

Store.set('settings', {
  engine: 'auto', liveEngine: 'avplay', vodEngine: 'html5', liveFormat: 'ts',
  liveBufferMode: '20', railLabels: true, epg: true, aspect: 'auto',
  subtitleSize: 'normal', settingsVersion: 3
});
Store.set('creds', { server: 'panel.test:8080/', username: 'one', password: 'secret' });
Settings.load();
Accounts.load();

assert.strictEqual(Accounts.list().length, 1, 'Eski tek hesap ilk profile tasinmali');
assert.strictEqual(Store.get('creds', null), null, 'Basarili goc sonrasinda eski kimlik kaydi silinmeli');
const first = Accounts.active();
assert.strictEqual(first.server, 'http://panel.test:8080', 'Sunucu adresi normalize edilmeli');
assert.strictEqual(first.username, 'one');
assert.strictEqual(Accounts.normalizeServer('http://panel.test:8080/get.php?username=one&password=secret&type=m3u_plus'),
  'http://panel.test:8080', 'Tam M3U adresi hesap profiline kok adres olarak kaydedilmeli');

AccountData.use(first.server, first.username);
Settings.bindAccount(first.migrateSettings);
assert.strictEqual(Settings.get('liveEngine'), 'avplay', 'Eski canli motor ilk profile tasinmali');
assert.strictEqual(Settings.get('vodEngine'), 'html5', 'Eski VOD motor ilk profile tasinmali');
assert.strictEqual(Settings.get('liveBufferMode'), '20', 'Eski tampon tercihi ilk profile tasinmali');
Accounts.markSettingsMigrated(first.id);

Favs.load();
Favs.toggle('movie', 501);
Favs.toggle('live', 11); Favs.toggle('live', 22); Favs.toggle('live', 33);
Favs.setLiveOrder([33, 11, 22]);
assert.deepStrictEqual(Favs.list('live'), ['33', '11', '22'], 'Favori kanal sirasi saklanmali');
CategoryVisibility.load();
assert.strictEqual(CategoryVisibility.toggle('live', 7), false, 'Gorunen kategori gizlenebilmeli');
assert.strictEqual(CategoryVisibility.hidden('live', 7), true);
assert.deepStrictEqual(CategoryVisibility.visibleList('live', [{ category_id: 7 }, { category_id: 8 }]), [{ category_id: 8 }]);
LiveHistory.load();
for (let i = 1; i <= 10; i++) LiveHistory.add({ stream_id: i, name: 'Kanal ' + i }, { categoryId: 5 });
assert.strictEqual(LiveHistory.list().length, 8, 'Canli gecmisi en fazla sekiz kanal tutmali');
assert.strictEqual(LiveHistory.list()[0].stream_id, 10);
assert.strictEqual(LiveHistory.previous(10).stream_id, 9, 'Sol tus icin onceki kanal bulunmali');
Settings.set('liveEngine', 'avplay');

const second = Accounts.add({
  name: 'Ikinci', server: 'http://other.test', username: 'two', password: 'secret2'
}, { user_info: { status: 'Active', max_connections: '1' } });
assert.strictEqual(Accounts.list().length, 2);
assert.throws(function () {
  Accounts.add({ server: 'HTTP://OTHER.TEST/', username: 'TWO', password: 'x' }, null);
}, /zaten kayitli/, 'Ayni sunucu ve kullanici ikinci kez eklenmemeli');

AccountData.use(second.server, second.username);
Settings.bindAccount(false);
Favs.load();
assert.strictEqual(Favs.has('movie', 501), false, 'Favoriler hesaplar arasinda karismamali');
CategoryVisibility.load();
assert.strictEqual(CategoryVisibility.hidden('live', 7), false, 'Kategori gorunurlugu hesaplar arasinda karismamali');
LiveHistory.load();
assert.strictEqual(LiveHistory.list().length, 0, 'Canli kanal gecmisi hesaplar arasinda karismamali');
assert.strictEqual(Settings.get('liveEngine'), 'auto', 'Yeni hesap saglayici varsayilaniyla baslamali');
Settings.set('liveEngine', 'html5');

AccountData.use(first.server, first.username);
Settings.bindAccount(false);
Favs.load();
assert.strictEqual(Favs.has('movie', 501), true, 'Ilk hesabin favorisi korunmali');
assert.strictEqual(Settings.get('liveEngine'), 'avplay', 'Motor tercihi hesap bazinda kalmali');

assert.strictEqual(AccountData.makeScope('', ''), '', 'Bos kimlik hayalet kapsam uretmemeli');
AccountData.clear();
assert.strictEqual(AccountData.set('fav', {}), false, 'Kapsam yokken hesap verisi yazilmamali');
assert.strictEqual(Object.keys(memory).some(function (key) { return key.indexOf('account.none') !== -1; }), false);

const secondScope = AccountData.makeScope(second.server, second.username);
Accounts.remove(second.id);
assert.strictEqual(Accounts.byId(second.id), null, 'Silinen profil sicilden kalkmali');
assert.strictEqual(Object.keys(memory).some(function (key) {
  return key.indexOf('iptv.account.' + secondScope + '.') === 0;
}), false, 'Silinen profilin kapsam verileri temizlenmeli');

console.log('Coklu hesap testleri basarili.');
