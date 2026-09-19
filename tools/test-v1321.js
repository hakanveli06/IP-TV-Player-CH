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
const views = read('js/views.js');
const css = read('css/app.css');

assert.strictEqual(pkg.version, '2.0.0');
assert(config.includes('version="2.0.0"'));
assert(app.includes("versionLabel: 'H&M.v2.0.0'"));

/* Ithaf rozeti 1.32.2'de Tizen 6 surumunden kaldirildi (yalnizca Tizen 3 ozel
   surumunde kalir); bkz. test-v1322.js. */

console.log('v1.32.1 surum kontrolu PASS');
