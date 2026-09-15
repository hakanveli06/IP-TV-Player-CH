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
  return Object.keys(map).sort().map(function (name) { return '\n--' + name + '--\n' + map[name].toString('utf8'); }).join('');
}

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

const publicFile = path.join(root, 'dist', 'HM_Player_v' + version + '_Public.wgt');
const familyFile = path.join(root, 'HM_Player_v' + version + '_Family.wgt');
const familyZip = path.join(root, 'HM_Player_v' + version + '_Family.zip');
if (!fs.existsSync(publicFile) || !fs.existsSync(familyFile) || !fs.existsSync(familyZip)) {
  throw new Error('Public WGT, Family WGT veya Family ZIP bulunamadi.');
}

const publicEntries = entries(publicFile), familyEntries = entries(familyFile);
const publicConfig = String(publicEntries['js/private-config.js'] || '');
const familyConfig = String(familyEntries['js/private-config.js'] || '');
const publicText = joined(publicEntries);
const privateFile = path.join(root, '.private', 'tmdb-token.txt');
const token = String(process.env.HM_TMDB_TOKEN || (fs.existsSync(privateFile) ? fs.readFileSync(privateFile, 'utf8') : '')).trim();

if (!/tmdbToken:\s*""/.test(publicConfig) || !/buildChannel:\s*"public"/.test(publicConfig)) {
  throw new Error('Public yapilandirma bos veya public olarak isaretli degil.');
}
if (/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(publicText)) {
  throw new Error('Public pakette JWT benzeri bir deger bulundu.');
}
if (/["'](?:tmdbToken|tmdbCredential)["']?\s*[:=]\s*["'][^"']{8,}["']/.test(publicText)) {
  throw new Error('Public pakette dolu TMDb kimlik bilgisi bulundu.');
}
Object.keys(publicEntries).forEach(function (name) {
  const match = publicEntries[name].toString('utf8').match(/\b(password|username)\s*[:=]\s*["']([A-Za-z0-9._@-]{3,})["']/i);
  if (match) throw new Error('Public pakette sabit IPTV hesap bilgisi benzeri bir deger bulundu: ' +
    name + ' alan=' + match[1] + ' uzunluk=' + match[2].length);
});
if (token && publicText.indexOf(token) !== -1) throw new Error('Family jetonu Public pakette bulundu.');
if (!token || familyConfig.indexOf(token) === -1 || !/buildChannel:\s*"family"/.test(familyConfig)) {
  throw new Error('Family paketi hazir TMDb jetonunu icermiyor.');
}
const wrappedFamily = entries(familyZip)['HM_Player_v' + version + '_Family.wgt'];
if (!wrappedFamily || !wrappedFamily.equals(fs.readFileSync(familyFile))) {
  throw new Error('Family ZIP icindeki WGT, dogrulanan Family WGT ile ayni degil.');
}

console.log('PUBLIC_OK size=' + fs.statSync(publicFile).size + ' sha256=' + digest(publicFile));
console.log('FAMILY_OK size=' + fs.statSync(familyFile).size + ' sha256=' + digest(familyFile));
console.log('Paket sir denetimi basarili; hassas degerler yazdirilmadi.');
