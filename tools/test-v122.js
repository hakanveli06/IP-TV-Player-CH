#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function sample(offset, second, text) {
  const body = Buffer.from(text, 'utf8');
  return { offset, size: body.length + 2, dts: second * 1000, cto: 0, duration: 2000, body };
}
function batchBuffer(start, end, samples) {
  const out = Buffer.alloc(end - start + 1);
  samples.forEach(row => {
    if (row.offset < start || row.offset + row.size - 1 > end) return;
    const at = row.offset - start;
    out.writeUInt16BE(row.body.length, at);
    row.body.copy(out, at + 2);
  });
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

(async function () {
  const sandbox = { Promise, Uint8Array, DataView, ArrayBuffer, URL, setTimeout, clearTimeout, Date };
  vm.createContext(sandbox);
  vm.runInContext(read('js/tx3g.js'), sandbox);
  const tx = sandbox.Tx3gSubtitles;
  tx.minRequestInterval = 0;
  const samples = [sample(1000, 10, 'Bir'), sample(1040, 70, 'Iki'), sample(1080, 180, 'Uc')];
  const calls = [];
  tx._readSafe = function (url, start, end) {
    calls.push({ start, end });
    return Promise.resolve(batchBuffer(start, end, samples));
  };
  const track = { sourceIndex: 0, lang: 'tur', timescale: 1000, samples, cues: null, signature: 'v3:test:0' };
  const info = { kind: 'mp4', sourceUrl: 'http://test.invalid/a.mp4', tracks: [track] };
  let firstChunk = 0;
  const result = await tx.loadWindow(info, 0, 0, 120, { onChunk: cues => { if (!firstChunk) firstChunk = cues.length; } });
  assert.strictEqual(firstChunk > 0, true, 'Ilk batch gelir gelmez cue yayinlanmali');
  assert.deepStrictEqual(Array.from(result.cues, c => c.text), ['Bir', 'Iki']);
  assert.strictEqual(result.cues.some(c => c.text === 'Uc'), false, 'Uzak gelecek altyazisi indirilmemeli');
  const count = calls.length;
  await tx.loadWindow(info, 0, 0, 120, {});
  assert.strictEqual(calls.length, count, 'Hazir pencere ikinci kez indirilmemeli');

  const player = read('js/player.js'), app = read('js/app.js'), util = read('js/util.js');
  const tmdb = read('js/tmdb.js'), css = read('css/app.css'), i18n = read('js/i18n.js');
  assert(player.includes('Tx3gSubtitles.loadWindow'), 'Player ilerlemeli TX3G penceresini kullanmali');
  assert(player.includes('shouldPause: function () { return self._buffering; }'));
  assert(player.includes('Altyazi: Uyumluluk yontemiyle hazir'));
  assert(app.includes("var requestedSubtitle = meta._sessionSubtitlePreference || 'off'"));
  assert(util.includes('max: 20'));
  assert(tmdb.includes("character: people[i].character || ''"));
  assert(tmdb.includes('/t/p/w92'));
  assert(css.includes('.tmdb-person-character'));
  assert(i18n.includes("'{region}\\'de nerede izlenir?'"));
  console.log('v1.22.0 ilerlemeli altyazi ve TMDb okunabilirlik testleri PASS');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
