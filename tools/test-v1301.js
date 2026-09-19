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
const player = read('js/player.js');
const api = read('js/api.js');

assert.strictEqual(pkg.version, '2.0.0');
assert(config.includes('version="2.0.0"'));
assert(app.includes("versionLabel: 'H&M.v2.0.0'"));

assert(app.includes("var active = this.mode === 'live'"));
assert(app.includes('var current = active && this.channels && this.channels[this.index]'));
assert(app.includes('for (var i = 0; active && this.channels'));

assert(player.includes('if (percent > self._bufferProgress)'));
assert(!player.includes('percent > self._bufferProgress || percent < 5'));
assert(player.includes('errorText: function (error, prefix)'));
assert(player.includes("parts.push('code=' + String(error.code))"));
assert(player.includes("Diag.add('AVPlay prepare hatasi: ' + detail)"));
assert(app.includes('Player.isCompatibilityError(msg)'));

assert(app.includes('liveRecoveryNoticeOn: false'));
assert(app.includes("Diag.set('Yeniden baglanma', 'Yayin kendi kendine toparlandi"));
assert(app.includes('if (this.osdTimer) { clearTimeout(this.osdTimer); this.osdTimer = null; }'));

assert(api.includes('if (keys.length > 200)'));
assert(api.includes('currentEnd > now'));
assert(player.includes('_playbackStaticStats: null'));
assert(player.includes('this._playbackStaticStats = fixed'));

console.log('v1.30.1 canli TV kararlilik ve hafif performans duzeltmeleri PASS');
