#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const pkg = JSON.parse(read('package.json'));
const config = read('config.xml');
const app = read('js/app.js');
const util = read('js/util.js');
const client = read('js/servis.js');
const service = read('service/servis.js');

assert.strictEqual(pkg.version, '2.0.0');
assert(config.includes('version="2.0.0"'));
assert(app.includes("versionLabel: 'H&M.v2.0.0'"));

assert(app.includes("if (card.kind === 'live') Playback.switchStoredChannel(card.raw)"));
assert(!app.includes("Playback.startLive([card.raw]"));
assert(!app.includes('ch.__epg = list'));
assert(app.includes('updateLiveOsdDynamic: function'));
assert(app.includes('Date.now() - this.liveStatsAt < 3000'));
assert(app.includes("document.getElementById('live-epg-progress')"));

assert(util.includes('setCritical: function (key, val)'));
assert(util.includes("AccountData.setCritical('resume'"));
assert(util.includes("AccountData.setCritical('watchState'"));
assert(util.includes("AccountData.setCritical('recent'"));
assert(util.includes("Store.setCritical('settings'"));

assert(/GEREKEN_SURUM: (?:6|7),/.test(client));
assert(client.includes("Servis.OTURUM = d.oturum || ''"));
assert(client.includes("'/video.mp4?s='"));
assert(/var SURUM = (?:6|7);/.test(service));
assert(service.includes('crypto.randomBytes(24)'));
assert(service.includes("hata: 'yetkisiz oturum'"));
assert(!service.includes("u.pathname === '/dis-test'"));
assert(!service.includes("'Access-Control-Allow-Origin': '*'"));

assert(!config.includes("'unsafe-eval'"));
assert(!/script-src\s+\*/.test(config));
assert(!config.includes('privilege/filesystem.read'));
assert(!config.includes('privilege/filesystem.write'));
assert(config.includes('privilege/application.launch'));

console.log('v1.30.0 performans, depolama ve yerel servis korumasi PASS');
