'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const sandbox = {
  window: { addEventListener() {} },
  document: { readyState: 'loading', addEventListener() {} },
  setTimeout, clearTimeout, setInterval, clearInterval
};
vm.createContext(sandbox);
for (const file of ['util.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), sandbox);
}
const p = sandbox.Playback;
const overlay = { className: '', innerHTML: '' };
p.mode = 'vod'; p.overlay = () => overlay; p.renderSubtitle = () => {};
p.renderVodPreparation({ stage: 'error', progress: 57, container: 'mp4', subtitleType: 'TX3G', message: 'HTTP Range 404' });
assert.ok(overlay.innerHTML.includes('width:57%'));
assert.ok(overlay.innerHTML.includes('%57'));
assert.ok(overlay.innerHTML.includes('Yukari Yeniden dene'));
p.renderVodPreparation({ stage: 'retry', progress: 57, message: 'Adres yenileniyor', done: 57, total: 100 });
assert.ok(overlay.innerHTML.includes('Adres yenileniyor'));
assert.ok(overlay.innerHTML.includes('width:57%'));
let retried = 0, skipped = 0;
sandbox.Player = { retrySubtitlePreparation: () => retried++, skipSubtitlePreparation: () => skipped++ };
p.keyVod({ keyCode: sandbox.KEY.UP, preventDefault() {} });
p.keyVod({ keyCode: sandbox.KEY.ENTER, preventDefault() {} });
assert.strictEqual(retried, 1); assert.strictEqual(skipped, 1);
console.log('Altyazi ilerleme ekrani ve kumanda testleri basarili.');
