'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const player = fs.readFileSync(path.join(root, 'js/player.js'), 'utf8');
const views = fs.readFileSync(path.join(root, 'js/views.js'), 'utf8');
const nav = fs.readFileSync(path.join(root, 'js/nav.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/app.css'), 'utf8');

assert(player.includes("aspectOrder: ['auto', 'ratio16x9', 'cinema21x9', 'ratio4x3', 'zoom4x3', 'zoom21x9']"));
assert(player.includes('isUnsupportedAvCrop: function (mode)'));
assert(app.includes('Bu kirpma modu AVPlay ile uygulanamiyor. HTML5 oynatma motorunu secip tekrar deneyin.'));
assert(app.includes("if (this.vodPanel === 'aspect')"));
assert(app.includes("Player.toggle(); this.renderAspectPanel(); return;"), 'Play/Pause must work inside aspect panel');

assert(player.includes('showSubtitleCompatibilityAction: function ()'));
assert(app.includes('Altyaziyi yeniden incele / hazirla'));
assert(app.includes('Once bir altyazi dili secin'));

assert(app.includes('adoptPlaybackCategory: function (items, index, categoryId, categoryName)'));
assert(app.includes('openLiveDailyEpg: function ()'));
assert(!app.includes('showChannelList:'), 'Legacy fullscreen channel picker must be removed');
assert(!css.includes('.channel-picker'), 'Legacy channel picker CSS must be removed');
assert(!nav.includes('KEY.BLUE) { e.preventDefault(); Diag.toggle()'), 'Legacy global blue diagnostic shortcut must be removed');
assert(views.includes('Yukarı: Kanal ve temel teknik bilgi kartı'));

const icon = fs.readFileSync(path.join(root, 'icon.png'));
assert.strictEqual(icon.readUInt32BE(16), 512, 'TV icon width must be 512');
assert.strictEqual(icon.readUInt32BE(20), 512, 'TV icon height must be 512');
console.log('v1.17 final logo, live remote flow, aspect guard and subtitle action PASS');
