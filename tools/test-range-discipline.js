#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'tx3g.js'), 'utf8'), { filename: 'tx3g.js' });

function sample(offset, text, dts) {
  const bytes = Buffer.from(text, 'utf8');
  return { offset: offset, size: bytes.length + 2, duration: 1000, dts: dts, cto: 0, text: text };
}

function infoFor(samples) {
  return { sourceUrl: 'http://media.test/movie.mp4', tracks: [{
    sourceIndex: 0, codec: 'tx3g', lang: 'tur', timescale: 1000,
    samples: samples, cues: null
  }] };
}

function bufferForBatch(start, end, samples) {
  const out = Buffer.alloc(end - start + 1);
  samples.forEach(function (s) {
    if (s.offset < start || s.offset + s.size - 1 > end) return;
    const text = Buffer.from(s.text, 'utf8');
    const at = s.offset - start;
    out[at] = (text.length >> 8) & 255;
    out[at + 1] = text.length & 255;
    text.copy(out, at + 2);
  });
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

(async function () {
  let xhrCreated = 0;
  global.XMLHttpRequest = function () {
    xhrCreated++;
    this.status = 429; this.response = new ArrayBuffer(0); this.responseURL = '';
    this.open = function () {};
    this.setRequestHeader = function () {};
    this.getResponseHeader = function () { return '60'; };
    this.send = function () { this.onload(); };
  };
  Tx3gSubtitles.minRequestInterval = 0;
  await assert.rejects(Tx3gSubtitles._range('http://limited.test/a.mp4', 0, 7), function (error) {
    return error.status === 429 && error.terminal === true;
  }, 'Gercek Range katmani 429 durumunu terminal olarak isaretlemeli');
  await assert.rejects(Tx3gSubtitles._range('http://limited.test/a.mp4', 0, 7), /gecici olarak durdurdu/);
  assert.strictEqual(xhrCreated, 1, 'Bekleme suresinde ayni kaynaga yeni XHR acilmamali');

  const close = [sample(1000, 'Bir', 0), sample(1010, 'Iki', 1000), sample(1020, 'Uc', 2000)];
  const groups = Tx3gSubtitles._buildBatches(close);
  assert.strictEqual(groups.length, 1, 'Komsu TX3G ornekleri tek Range isteginde birlesmeli');
  assert.strictEqual(groups[0].samples.length, 3);

  let requests = 0, active = 0, maxActive = 0;
  Tx3gSubtitles._range = function (url, start, end) {
    requests++; active++; maxActive = Math.max(maxActive, active);
    return new Promise(function (resolve) {
      setTimeout(function () { active--; resolve(bufferForBatch(start, end, close)); }, 2);
    });
  };
  const cues = await Tx3gSubtitles.loadTrack(infoFor(close), 0);
  assert.strictEqual(requests, 1, 'Uc komsu ornek icin tek istek yeterli olmali');
  assert.strictEqual(maxActive, 1, 'Ayni anda yalnizca bir Range istegi calismali');
  assert.strictEqual(cues.length, 3, 'Birlesik bloktaki her altyazi cozulmeli');

  let limitedCalls = 0;
  Tx3gSubtitles._range = function () {
    limitedCalls++;
    const error = new Error('HTTP Range 429'); error.status = 429; error.terminal = true;
    return Promise.reject(error);
  };
  await assert.rejects(Tx3gSubtitles.loadTrack(infoFor([sample(2000, 'Dur', 0)]), 0), /durduruldu/);
  assert.strictEqual(limitedCalls, 1, '429 cevabi tekrar denenmemeli');
  Tx3gSubtitles._cooldowns = {};

  let transientCalls = 0;
  const transientSample = sample(3000, 'Tekrar', 0);
  Tx3gSubtitles._range = function (url, start, end) {
    transientCalls++;
    if (transientCalls === 1) return Promise.reject(new Error('Gecici ag hatasi'));
    return Promise.resolve(bufferForBatch(start, end, [transientSample]));
  };
  const recovered = await Tx3gSubtitles.loadTrack(infoFor([transientSample]), 0);
  assert.strictEqual(transientCalls, 2, 'Gecici hata yalnizca bir kez tekrar edilmeli');
  assert.strictEqual(recovered.length, 1);

  const oldLimit = Tx3gSubtitles.maxTrackRequests;
  Tx3gSubtitles.maxTrackRequests = 1;
  let budgetCalls = 0;
  Tx3gSubtitles._range = function () { budgetCalls++; return Promise.resolve(new ArrayBuffer(8)); };
  await assert.rejects(Tx3gSubtitles.loadTrack(infoFor([
    sample(0, 'A', 0), sample(1000000, 'B', 1000)
  ]), 0), /istek siniri/);
  assert.strictEqual(budgetCalls, 0, 'Istek butcesi asilacaksa tur baslatilmamali');
  Tx3gSubtitles.maxTrackRequests = oldLimit;

  console.log('Range istek disiplini testleri basarili.');
})()['catch'](function (error) {
  console.error(error.stack || error);
  process.exitCode = 1;
});
