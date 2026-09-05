/* Read-only MP4/header diagnosis. Never starts a TV player or changes app code.
   --metadata-only uses only panel APIs. Full mode requires an idle account. */
'use strict';
const { api, subtitles: mp4, counters } = require('./diagnose-subtitles');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function summarizeMoov(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const root = mp4._boxAt(bytes, view, 0, bytes.length);
  const child = (box, name) => box && mp4._child(bytes, view, box, name);
  const children = box => box ? mp4._children(bytes, view, box) : [];
  const tracks = children(root).filter(box => box.type === 'trak').map((trak, index) => {
    const mdia = child(trak, 'mdia'), mdhd = child(mdia, 'mdhd'), hdlr = child(mdia, 'hdlr');
    const v1 = mdhd && bytes[mdhd.data] === 1;
    const scale = mdhd ? view.getUint32(mdhd.data + (v1 ? 20 : 12)) : null;
    const lang = mdhd ? mp4._language(view.getUint16(mdhd.data + (v1 ? 32 : 20))) : null;
    const handler = hdlr ? mp4._ascii(bytes, hdlr.data + 8, 4) : '';
    const stbl = child(child(mdia, 'minf'), 'stbl'), stsd = child(stbl, 'stsd');
    const entry = stsd && mp4._boxAt(bytes, view, stsd.data + 8, stsd.end);
    const result = { index, handler, codec: entry && entry.type, timescale: scale, language: lang };
    if (entry && handler === 'vide' && entry.data + 78 <= entry.end) {
      result.width = view.getUint16(entry.data + 24);
      result.height = view.getUint16(entry.data + 26);
      const extras = children({ data: entry.data + 78, end: entry.end });
      result.extensions = extras.map(b => b.type);
      const avcc = extras.find(b => b.type === 'avcC');
      if (avcc) {
        result.avcProfile = bytes[avcc.data + 1]; result.avcLevel = bytes[avcc.data + 3];
        result.avcConfigBytes = avcc.end - avcc.data;
        result.avcConfigHex = Buffer.from(bytes.slice(avcc.data, Math.min(avcc.end, avcc.data + 128))).toString('hex');
      }
      const hvcc = extras.find(b => b.type === 'hvcC');
      if (hvcc) { result.hevcProfile = bytes[hvcc.data + 1] & 31; result.hevcLevel = bytes[hvcc.data + 12]; }
    }
    if (entry && handler === 'soun' && entry.data + 28 <= entry.end) {
      result.channels = view.getUint16(entry.data + 16);
      result.sampleRate = view.getUint32(entry.data + 24) / 65536;
    }
    return result;
  });
  return { moovBytes: buffer.byteLength, tracks };
}
function probeHeader(buffer) {
  const ffprobe = path.join(__dirname, '..', '.codex-diagnostics', 'ffmpeg-9.0.1',
    'ffmpeg-9.0.1-essentials_build', 'bin', 'ffprobe.exe');
  if (!fs.existsSync(ffprobe)) return { available: false };
  // Synthetic local header-only input. No original URL is passed to FFprobe.
  const ftyp = Buffer.from('000000186674797069736f6d0000020069736f6d6d703431', 'hex');
  const mdat = Buffer.from('000000086d646174', 'hex');
  const result = spawnSync(ffprobe, ['-v', 'error', '-protocol_whitelist', 'pipe', '-f', 'mov',
    '-probesize', '32768', '-analyzeduration', '0', '-show_entries',
    'stream=index,codec_name,codec_type,profile,width,height,pix_fmt,level,channels,sample_rate,r_frame_rate,time_base',
    '-of', 'json', '-i', 'pipe:0'], {
    input: Buffer.concat([ftyp, Buffer.from(buffer), mdat]), timeout: 15000,
    maxBuffer: 2 * 1024 * 1024, windowsHide: true
  });
  try { return { exitCode: result.status, headerOnly: true, streams: JSON.parse(String(result.stdout)).streams }; }
  catch (_) { return { exitCode: result.status, headerOnly: true, parsed: false }; }
}
async function videoSample(url, buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  const root = mp4._boxAt(bytes, view, 0, bytes.length);
  for (const trak of mp4._children(bytes, view, root).filter(b => b.type === 'trak')) {
    const mdia = mp4._child(bytes, view, trak, 'mdia');
    const hdlr = mp4._child(bytes, view, mdia, 'hdlr');
    if (mp4._ascii(bytes, hdlr.data + 8, 4) !== 'vide') continue;
    const stbl = mp4._path(bytes, view, mdia, ['minf', 'stbl']);
    const stsz = mp4._child(bytes, view, stbl, 'stsz');
    const offsets = mp4._child(bytes, view, stbl, 'stco') || mp4._child(bytes, view, stbl, 'co64');
    const firstOffset = offsets.type === 'co64' ? mp4._u64(view, offsets.data + 8) : mp4._u32(view, offsets.data + 8);
    const firstSize = mp4._u32(view, stsz.data + 4) || mp4._u32(view, stsz.data + 12);
    if (!firstSize || firstSize > 1024 * 1024) return { firstOffset, firstSize, skipped: true };
    const data = Buffer.from(await mp4._range(url, firstOffset, firstOffset + firstSize - 1));
    const stsd = mp4._child(bytes, view, stbl, 'stsd');
    const entry = mp4._boxAt(bytes, view, stsd.data + 8, stsd.end);
    const avcc = mp4._children(bytes, view, { data: entry.data + 78, end: entry.end }).find(b => b.type === 'avcC');
    const nals = [], annex = []; let pos = 0;
    if (avcc) {
      let at = avcc.data + 6;
      for (const kind of ['sps', 'pps']) {
        const count = kind === 'sps' ? bytes[avcc.data + 5] & 31 : bytes[at++];
        for (let n = 0; n < count; n++) {
          const length = view.getUint16(at); at += 2;
          annex.push(Buffer.from([0, 0, 0, 1]), Buffer.from(bytes.slice(at, at + length))); at += length;
        }
      }
    }
    while (pos + 4 <= data.length) {
      const length = data.readUInt32BE(pos); pos += 4;
      if (!length || pos + length > data.length) break;
      nals.push({ type: data[pos] & 31, length });
      annex.push(Buffer.from([0, 0, 0, 1]), data.subarray(pos, pos + length)); pos += length;
    }
    const probe = path.join(__dirname, '..', '.codex-diagnostics', 'ffmpeg-9.0.1',
      'ffmpeg-9.0.1-essentials_build', 'bin', 'ffprobe.exe');
    const out = spawnSync(probe, ['-v', 'error', '-protocol_whitelist', 'pipe', '-f', 'h264',
      '-show_entries', 'stream=codec_name,profile,width,height,pix_fmt,level,color_space,color_transfer,color_primaries',
      '-of', 'json', '-i', 'pipe:0'], { input: Buffer.concat(annex), timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true });
    let parsed;
    try { parsed = JSON.parse(String(out.stdout)); } catch (_) { parsed = null; }
    return { firstOffset, firstSize, nals, elementaryProbe: parsed };
  }
}
(async () => {
  const account = await api();
  console.log(JSON.stringify({ accountActive: Number(account.user_info.active_cons) }));
  const metadataOnly = process.argv.includes('--metadata-only');
  if (!metadataOnly && Number(account.user_info.active_cons) !== 0) throw new Error('Account is not idle');
  const candidates = [];
  const series = Object.values(await api('get_series')).filter(s => /^(pachinko|sugar)\b/i.test(s.name || ''));
  for (const s of series) {
    const info = await api('get_series_info', { series_id: s.series_id });
    const eps = Object.values(info.episodes || {}).flat();
    const firsts = eps.filter(e => Number(e.season) === 1 && Number(e.episode_num) === 1).slice(0, 2);
    firsts.forEach(e => candidates.push({ name: s.name + ' S01E01', id: e.id, kind: 'series', ext: e.container_extension }));
    console.log(JSON.stringify({ series: s.name, episodeCount: eps.length, firstEpisodeCopies: firsts.length }));
  }
  const categories = Object.values(await api('get_vod_categories')).filter(c => /apple/i.test(c.category_name || ''));
  for (const c of categories) {
    const movies = Object.values(await api('get_vod_streams', { category_id: c.category_id }));
    movies.filter(m => /\bcoda\b/i.test(m.name || '')).slice(0, 2).forEach(m => {
      candidates.push({ name: m.name, id: m.stream_id, kind: 'movie', ext: m.container_extension });
    });
  }
  console.log(JSON.stringify({ candidates }));
  if (metadataOnly) return;
  const idsArg = process.argv.find(arg => arg.startsWith('--ids='));
  const ids = idsArg ? idsArg.slice(6).split(',') : null;
  for (const item of candidates.filter(c => !ids || ids.includes(String(c.id))).slice(0, 5)) {
    const url = new URL('/' + item.kind + '/' + encodeURIComponent(process.env.IPTV_TEST_USER) + '/' +
      encodeURIComponent(process.env.IPTV_TEST_PASS) + '/' + item.id + '.' + (item.ext || 'mp4'), process.env.IPTV_TEST_SERVER).href;
    const before = counters(), started = Date.now();
    console.log(JSON.stringify({ name: item.name, id: item.id, phase: 'reading-header' }));
    try {
      const buffer = await mp4._locateMoov(url, { generation: mp4._generation, recoveries: 0 });
      if (buffer.container) { console.log(JSON.stringify({ name: item.name, actualContainer: buffer.container })); continue; }
      console.log(JSON.stringify({ name: item.name, id: item.id, ...summarizeMoov(buffer), ffprobe: probeHeader(buffer),
        bytesRead: counters().bytes - before.bytes, seconds: Math.round((Date.now() - started) / 1000) }));
      if (process.argv.includes('--video-sample')) console.log(JSON.stringify({ name: item.name, sample: await videoSample(url, buffer) }));
      if (process.argv.includes('--capture-prefix')) {
        const file = path.join(__dirname, '..', '.codex-diagnostics', 'vod-' + item.id + '-prefix.mp4');
        if (fs.existsSync(file)) throw new Error('Capture already exists; will not overwrite');
        const prefix = await mp4._range(url, 0, 16 * 1024 * 1024 - 1);
        fs.writeFileSync(file, Buffer.from(prefix), { flag: 'wx' });
        console.log(JSON.stringify({ capture: path.basename(file), bytes: prefix.byteLength }));
      }
    } catch (error) {
      console.log(JSON.stringify({ name: item.name, status: error.status || 0, phase: 'header-failed' }));
      if (error.status !== 404) break;
    } finally { mp4.cancel(); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log(JSON.stringify({ counters: counters(), accountActiveAfter: Number((await api()).user_info.active_cons) }));
})().catch(() => { console.log('Diagnosis stopped; no application files changed.'); process.exitCode = 1; });
