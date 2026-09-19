#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const config = fs.readFileSync(path.join(root, 'config.xml'), 'utf8');
const version = (config.match(/\bversion="(\d+\.\d+\.\d+)"/) || [])[1];
if (!version) throw new Error('Surum bulunamadi.');

function entries(file) {
  const data = fs.readFileSync(file), result = {};
  let offset = 0;
  while (offset + 30 <= data.length && data.readUInt32LE(offset) === 0x04034B50) {
    const method = data.readUInt16LE(offset + 8);
    const size = data.readUInt32LE(offset + 18);
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    const name = data.slice(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    const body = data.slice(start, start + size);
    result[name] = method === 8 ? zlib.inflateRawSync(body) : body;
    offset = start + size;
  }
  return result;
}

function joined(map) {
  return Object.keys(map).sort().map(function (name) {
    return '\n--' + name + '--\n' + map[name].toString('utf8');
  }).join('');
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const publicFile = path.join(root, 'dist', 'HM_Player_v' + version + '_Public.wgt');
if (!fs.existsSync(publicFile)) throw new Error('Public WGT bulunamadi.');

const packaged = entries(publicFile);
const runtime = String(packaged['js/runtime-config.js'] || '');
const text = joined(packaged);

if (!runtime || !/buildChannel:\s*'public-v2'/.test(runtime)) {
  throw new Error('Public runtime yapilandirmasi eksik veya yanlis.');
}
if (packaged['js/private-config.js']) throw new Error('Eski private-config.js Public pakette bulunuyor.');
if (/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(text)) {
  throw new Error('Public pakette JWT benzeri bir deger bulundu.');
}
if (/\b[a-fA-F0-9]{32}\b/.test(text)) throw new Error('Public pakette API anahtari benzeri bir deger bulundu.');
if (/["'](?:tmdbToken|tmdbCredential)["']?\s*[:=]\s*["'][^"']{8,}["']/.test(text)) {
  throw new Error('Public pakette dolu TMDb kimlik bilgisi bulundu.');
}
Object.keys(packaged).forEach(function (name) {
  const match = packaged[name].toString('utf8').match(/\b(password|username)\s*[:=]\s*["']([A-Za-z0-9._@-]{3,})["']/i);
  if (match) throw new Error('Public pakette sabit IPTV hesap bilgisi benzeri bir deger bulundu: ' +
    name + ' alan=' + match[1] + ' uzunluk=' + match[2].length);
});

console.log('PUBLIC_OK size=' + fs.statSync(publicFile).size + ' sha256=' + digest(publicFile));
console.log('Public WGT hassas bilgi denetimi basarili.');
