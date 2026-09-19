#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(name => /\.js$/i.test(name));

const forbiddenCss = [
  { re: /(^|[;{]\s*)inset\s*:/im, name: 'inset' },
  { re: /aspect-ratio\s*:/i, name: 'aspect-ratio' },
  { re: /:is\s*\(/i, name: ':is()' },
  { re: /:where\s*\(/i, name: ':where()' },
  { re: /(?:-webkit-)?backdrop-filter\s*:/i, name: 'backdrop-filter' }
];
forbiddenCss.forEach(rule => assert(!rule.re.test(css), 'Chromium 76 CSS uyumsuzlugu: ' + rule.name));

/* Grid gap eski motorda desteklenir; yalnizca flex bloklarindaki gap yasak. */
const blocks = css.match(/[^{}]+\{[^{}]*\}/g) || [];
blocks.forEach(block => {
  if (/display\s*:\s*(?:inline-)?flex\b/i.test(block)) {
    assert(!/(?:^|;)\s*(?:gap|row-gap|column-gap)\s*:/im.test(block),
      'Chromium 76 flex gap uyumsuzlugu: ' + block.slice(0, 90).replace(/\s+/g, ' '));
  }
});

const forbiddenJs = [
  { re: /\?\./, name: 'optional chaining' },
  { re: /\?\?/, name: 'nullish coalescing' },
  { re: /\bstructuredClone\s*\(/, name: 'structuredClone' },
  { re: /\bObject\.hasOwn\s*\(/, name: 'Object.hasOwn' },
  { re: /\.at\s*\(/, name: 'Array.at' }
];
jsFiles.forEach(name => {
  const source = fs.readFileSync(path.join(root, 'js', name), 'utf8');
  forbiddenJs.forEach(rule => assert(!rule.re.test(source), name + ': Chromium 76 JS uyumsuzlugu: ' + rule.name));
});

assert(css.includes('.detail-content { position:absolute; left:0; top:0; right:0; bottom:0;'),
  'Detay icerigi Tizen 6 icin dort kenardan sabitlenmemis');
assert(/\.detail-backdrop\s*\{[^}]*position\s*:\s*absolute;[^}]*left\s*:\s*0;[^}]*top\s*:\s*0;[^}]*right\s*:\s*0;[^}]*bottom\s*:\s*0;/i.test(css),
  'Detay arka plani Tizen 6 icin boyutlandirilmamis');

console.log('Tizen 6 / Chromium 76 CSS ve JavaScript uyumluluk testi PASS');
