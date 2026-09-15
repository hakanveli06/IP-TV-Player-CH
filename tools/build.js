#!/usr/bin/env node
/* H&M Player WGT paketleyicisi. Harici bagimlilik gerektirmez. */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
/* Uretim paketi icin acik izin listesi. Gelistirme/teshis dosyalari veya ileride
   klasore birakilan gecici kutuphaneler yanlislikla TV'ye tasinmaz. */
const files = [
  'config.xml', 'index.html', 'icon.png', 'assets/tmdb-logo.svg', 'css/app.css',
  'js/private-config.js', 'js/i18n.js', 'js/util.js', 'js/nav.js', 'js/api.js', 'js/tmdb.js', 'js/tx3g.js',
  'js/player.js', 'js/views.js', 'js/app.js'
];
const dirs = [];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(data) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosTime(date) {
  return ((date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)) & 0xFFFF;
}

function dosDate(date) {
  return (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
}

function privateToken() {
  const privateFile = path.join(root, '.private', 'tmdb-token.txt');
  return String(process.env.HM_TMDB_TOKEN ||
    (fs.existsSync(privateFile) ? fs.readFileSync(privateFile, 'utf8') : '')).trim();
}

function collect(includePrivate) {
  const entries = [];
  for (const name of files) {
    const full = path.join(root, name);
    if (!fs.existsSync(full)) throw new Error('Eksik paket dosyasi: ' + name);
    let data = fs.readFileSync(full);
    if (name === 'js/private-config.js') {
      const token = includePrivate ? privateToken() : '';
      data = Buffer.from('window.HM_PRIVATE={tmdbToken:' + JSON.stringify(token) +
        ',buildChannel:' + JSON.stringify(includePrivate ? 'family' : 'public') + '};\n', 'utf8');
    }
    entries.push({ name, data });
  }
  for (const dir of dirs) {
    const fullDir = path.join(root, dir);
    for (const name of fs.readdirSync(fullDir).sort()) {
      const full = path.join(fullDir, name);
      if (fs.statSync(full).isFile()) {
        entries.push({ name: dir + '/' + name, data: fs.readFileSync(full) });
      }
    }
  }
  return entries;
}

function zip(entries) {
  const chunks = [];
  const central = [];
  const now = new Date();
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = zlib.deflateRawSync(entry.data, { level: 9 });
    const deflated = compressed.length < entry.data.length;
    const body = deflated ? compressed : entry.data;
    const method = deflated ? 8 : 0;
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034B50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime(now), 10);
    local.writeUInt16LE(dosDate(now), 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, body);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014B50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(method, 10);
    header.writeUInt16LE(dosTime(now), 12);
    header.writeUInt16LE(dosDate(now), 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(body.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054B50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat(chunks.concat([directory, end]));
}

const config = fs.readFileSync(path.join(root, 'config.xml'), 'utf8');
const match = config.match(/\bversion="(\d+\.\d+\.\d+)"/);
if (!match) throw new Error('config.xml icinde surum bulunamadi.');

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const output = path.join(outDir, 'HM_Player_v' + match[1] + '_Public.wgt');
/* Public paket daima sir icermeyen, kullanicinin kendi TMDb anahtarini
   uygulama icinden girebildigi dagitimdir. */
const entries = collect(false);
const publicData = zip(entries);
const localToken = privateToken();
if (localToken && entries.some(function (entry) { return entry.data.includes(Buffer.from(localToken, 'utf8')); })) {
  throw new Error('GUVENLIK: Yerel TMDb jetonu Public pakete sizdi. Paket yazilmadi.');
}
fs.writeFileSync(output, publicData);
console.log(output);
console.log(entries.map(function (entry) { return entry.name; }).join('\n'));
if (process.argv.indexOf('--family') !== -1 || process.argv.indexOf('--share') !== -1) {
  const name = 'HM_Player_v' + match[1] + '_Family.wgt';
  const token = privateToken();
  if (!token) throw new Error('Family paketi icin HM_TMDB_TOKEN veya .private/tmdb-token.txt gerekli.');
  const familyEntries = collect(true);
  if (!familyEntries.some(function (entry) { return entry.data.includes(Buffer.from(token, 'utf8')); })) {
    throw new Error('Family paketine TMDb jetonu eklenemedi.');
  }
  const data = zip(familyEntries);
  fs.writeFileSync(path.join(root, name), data);
  fs.writeFileSync(path.join(root, 'HM_Player_v' + match[1] + '_Family.zip'), zip([{ name, data }]));
  console.log('Public ve Family paketleri hazir: v' + match[1]);
}
