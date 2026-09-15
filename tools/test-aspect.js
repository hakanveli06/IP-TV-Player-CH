'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const path = require('path');
const calls = [], diagnostics = {};
let failRect = false, failMode = false;
const avNode = { style: {} }, video = { style: {} };
const sandbox = {
  setTimeout() { return 1; }, clearTimeout() {},
  webapis: { avplay: {
    setDisplayRect(x,y,w,h) {
      calls.push({ type:'rect', args:[x,y,w,h] });
      if (failRect) throw new Error('rect rejected');
    },
    setDisplayMethod(mode) {
      calls.push({ type:'method', mode:mode });
      if (failMode) throw new Error('mode rejected');
    },
    getVideoSize() { return { width:1728, height:720 }; },
    getCurrentStreamInfo() { return []; }
  } },
  Diag: { set(k,v) { diagnostics[k] = v; }, add() {} },
  Settings: { values:{}, set(k,v) { this.values[k]=v; } },
  document: {
    body:{ className:'' },
    getElementById(id) { return id === 'avplayer' ? avNode : video; }
  }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/player.js'), 'utf8'), sandbox);
const player = sandbox.Player;
player.engine = 'avplay'; player.playing = true;

player.displayRect = { x:1347, y:189, width:506, height:285 };
player.aspect = 'letterbox'; player.applyViewportStyles();
assert.deepStrictEqual(
  [avNode.style.left,avNode.style.top,avNode.style.width,avNode.style.height],
  ['0px','0px','1920px','1080px'],
  'AVPlay DOM object must stay fullscreen during native preview'
);
assert.strictEqual(player.applyAspect(), true);
assert.deepStrictEqual(calls, [
  { type:'method', mode:'PLAYER_DISPLAY_MODE_FULL_SCREEN' },
  { type:'rect', args:[1347,189,506,285] }
], 'Preview must apply FULL_SCREEN scaling before the 16:9 native rectangle');

player.displayRect = null;
const layouts = {
  ratio16x9:[0,0,1920,1080], ratio4x3:[240,0,1440,1080],
  cinema21x9:[0,128,1920,825]
};
for (const [mode, rect] of Object.entries(layouts)) {
  calls.length = 0; player.aspect = mode; assert.strictEqual(player.applyAspect(), true);
  assert.deepStrictEqual(calls, [
    { type:'method', mode:'PLAYER_DISPLAY_MODE_FULL_SCREEN' },
    { type:'rect', args:rect }
  ], mode + ' must use the verified fixed hardware geometry');
}

for (const mode of ['zoom4x3','zoom21x9']) {
  calls.length = 0; player.aspect = mode; assert.strictEqual(player.applyAspect(), false);
  assert.deepStrictEqual(calls, [
    { type:'method', mode:'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO' },
    { type:'rect', args:[0,0,1920,1080] }
  ], mode + ' must keep AVPlay in a safe automatic layout on this device');
}
player.aspect = 'auto';
const before = sandbox.Settings.values.aspect;
assert.strictEqual(player.setAspect('zoom4x3','aspect'), '4:3 → 16:9 yakinlastir');
assert.strictEqual(player.aspect, 'auto', 'Unsupported AVPlay crop must not become the active mode');
assert.strictEqual(sandbox.Settings.values.aspect, before, 'Unsupported AVPlay crop must not be persisted');

/* Forced modes must not depend on provider DAR/SAR metadata. */
calls.length = 0; player.aspect = 'ratio4x3';
player._sourceVideoInfo = { width:1280, height:720, display_aspect_ratio:'2024:855' };
player.applyAspect();
assert.deepStrictEqual(calls[1].args, [240,0,1440,1080]);

calls.length = 0; player.aspect = 'auto'; player.applyAspect();
assert.deepStrictEqual(calls, [
  { type:'method', mode:'PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO' },
  { type:'rect', args:[0,0,1920,1080] }
]);

calls.length = 0; failRect = true;
assert.strictEqual(player.applyAspect(), false);
assert(diagnostics['AVPlay alan komutu'].includes('rect rejected'));
failRect = false; failMode = true; calls.length = 0;
assert.strictEqual(player.applyAspect(), false);
assert.equal(calls[1].type,'rect','Rectangle must still be attempted if display method is rejected');
assert(diagnostics['AVPlay oran komutu'].includes('mode rejected'));

failMode = false; player.engine = 'html5';
player.aspect = 'ratio16x9'; player.applyAspect(); assert.strictEqual(video.style.objectFit, 'fill');
player.aspect = 'auto'; player.applyAspect(); assert.strictEqual(video.style.objectFit, 'contain');
player.aspect = 'ratio4x3'; player.applyAspect();
assert.deepStrictEqual([video.style.left,video.style.top,video.style.width,video.style.height], ['240px','0px','1440px','1080px']);
assert.strictEqual(player.normalizeAspect('fullscreen'), 'ratio16x9');
assert.strictEqual(player.normalizeAspect('letterbox'), 'auto');
console.log('AVPlay/HTML5 forced geometry, preview override and legacy aspect migration PASS');
