/* service/servis.js - H&M Player yerel servisi
   (Tizen web servis uygulamasi, TV'nin Node.js calisma ortaminda kosar)

   Neden var: Samsung'un oynaticisi 32'den fazla izi olan MP4'leri acmiyor.
   Cihazda kesinlesti: Sugar 45 izle acilmadi, iz sayisi 30'a dusurulunce
   sorunsuz acildi. Tarayici tarafindaki uygulama degistirilmis bir dosyayi
   AVPlay'e veremez - AVPlay blob: adresi kabul etmiyor, 500 MB'lik bir dosya
   da bellege sigmiyor. Bu servis 127.0.0.1 uzerinden HTTP sunabiliyor ve
   AVPlay oraya herhangi bir HTTP kaynagi gibi baglanabiliyor (1.1.4'te TV'de
   dogrulandi: servis 1583 ms'de kalkti, node v12.4.0).

   YONTEM - moov'dan altyazi izlerini silip bosalan yeri 'free' ile doldurmak:
   Dosyanin basindaki moov kutusundan altyazi izleri cikarilir ve kutunun
   bosalan kismi ayni boyda bir 'free' kutusuyla doldurulur. Boylece dosyanin
   toplam boyu ve mdat icindeki BUTUN bayt ofsetleri aynen kalir; ornek
   tablolarina (stco/co64) hic dokunmak gerekmez. Silinen altyazilarin verisi
   mdat icinde durmaya devam eder ama artik hicbir iz ona isaret etmez - bu
   ISO BMFF'te gecerli.

   PC'de gercek Sugar dosyasi uzerinde dogrulandi (ffmpeg): 45 akis -> 2,
   2871 video+ses paketinin (akis, pts, boy, dosya konumu) tablosu orijinalle
   BIREBIR ayni, ornek kareler ve ses MD5 olarak ayni.

   Servis bir istegi uc parcaya bolerek karsilar: moov oncesi kaynaktan,
   moov bolgesi bellekten (yeni moov + free), moov sonrasi kaynaktan.
   Altyazilar etkilenmez: uygulama onlari dogrudan kaynak dosyadan okuyor.

   Kurallar:
     - YALNIZCA 127.0.0.1 dinlenir. Butun aga acilirsa evdeki baska bir cihaz
       bunu, hesap bilgileriyle saglayiciya giden acik bir proxy olarak
       kullanabilir.
     - Gunluge tam adres YAZILMAZ: yol kismi kullanici adi ve sifre tasiyor.
       Yalnizca sunucu adi.
     - Saf ES5, sifir bagimlilik. Tizen 6.0'da node v12.4.0 var ama 2019
       TV'lerde cok daha eskisi olabilir (Buffer.alloc bile yok).
       tools/check-compat.js bu klasoru ES5 olarak denetliyor.

   Servis kalibi (tizen:service + localhost HTTP + uygulamadan launch),
   ayni yoldan - Apps2Samsung ile - kurulan vlc-tizen-tv'den (MIT) alindi. */
'use strict';

var http = require('http');
var https = require('https');
var url = require('url');
var crypto = require('crypto');

/* Uygulama tarafi (js/servis.js) bu numarayi kontrol eder: TV'de eski bir
   servis ornegi ayakta kalmissa yeni uc noktalari beklemesin.
     1 - iskelet (/durum, /kayit, /dis-test)
     2 - iz ayiklayan proxy (/v, /incele, /kapat)
     3 - kaynak adresi sorgu dizisinden kaldirildi; opak kimlik kullaniliyor
     4 - video yaninda sinirli TX3G okuma kanali ve altyazi manifesti
     5 - uygulamaya ozgu port ve paket kimligi
     6 - oturum anahtari, kisitli CORS; kullanilmayan dis-test kaldirildi
     7 - bayat kaynak adresi kendiliginden tazelenir; video/altyazi
         yanitlari da istemcinin Origin bilgisini dondurur */
var SURUM = 7;
var PAKET = 'HV9K26T901';
var OTURUM = crypto.randomBytes(24).toString('hex');
/* HM_SERVIS_PORT testler icin: 0 verilirse isletim sistemi bos bir port secer.
   (Eskiden "parseInt(...) || 8631" idi; 0 yanlis sayilip 8631'e dusuyordu.) */
var PORT = (process.env.HM_SERVIS_PORT !== undefined && process.env.HM_SERVIS_PORT !== '')
  ? parseInt(process.env.HM_SERVIS_PORT, 10) : 18631;
var ADRES = '127.0.0.1';
var baslangic = Date.now();

if (typeof Buffer.alloc !== 'function') {
  Buffer.alloc = function (boy, dolgu) {
    var b = new Buffer(boy);
    b.fill(dolgu === undefined ? 0 : dolgu);
    return b;
  };
}
if (typeof Buffer.from !== 'function') {
  Buffer.from = function (veri, kodlama) { return new Buffer(veri, kodlama); };
}

/* ================================ gunluk ================================
   Servis ayri bir surec; konsolu uygulamanin konsolu degil. Uygulama
   /kayit ile bu halka tamponu okuyup Tanilama ekraninda gosterebiliyor. */
var KAYIT = [];
var KAYIT_MAX = 200;

function kayit(mesaj) {
  KAYIT.push(new Date().toISOString() + ' ' + mesaj);
  if (KAYIT.length > KAYIT_MAX) KAYIT.shift();
}

/* Gunluge yalnizca sunucu adi: yol kismi kimlik bilgisi tasiyor. */
function sunucuAdi(adres) {
  try { return url.parse(String(adres)).hostname || '?'; } catch (e) { return '?'; }
}

/* ============================ HTTP yardimcilari ========================= */

function temelBasliklar(tur, res) {
  return {
    'Content-Type': tur,
    'Access-Control-Allow-Origin': (res && res._hmOrigin) || 'null',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
    /* Chromium'un ozel ag erisimi on kontrolu icin */
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store'
  };
}

function basliklar(res, kod, tur) {
  res.writeHead(kod, temelBasliklar(tur, res));
}

function izinliOrigin(origin) {
  origin = String(origin || '');
  if (!origin || origin === 'null') return 'null';
  if (/^(?:file|widget|app|tizen):\/\//i.test(origin)) return origin;
  if (/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(origin)) return origin;
  if (/^https?:\/\/(?:www\.)?hakanveli\.com(?::\d+)?$/i.test(origin)) return origin;
  return '';
}

function json(res, kod, nesne) {
  basliklar(res, kod, 'application/json');
  res.end(JSON.stringify(nesne));
}

function httpAdresMi(adres) {
  var p = null;
  try { p = url.parse(String(adres || '')); } catch (e) { return null; }
  if (!p || (p.protocol !== 'http:' && p.protocol !== 'https:') || !p.hostname) return null;
  return p;
}

/* Kaynak adresi kullanici adi/sifre tasiyabilir. Bu nedenle URL sorgusuna,
   AVPlay gecmisine ya da tanilama metnine yazilmaz; yalnizca yerel POST
   govdesinden alinir. Govde bilerek kucuk tutulur. */
function jsonGovde(req, cb) {
  var parcalar = [];
  var boy = 0;
  var bitti = false;
  function bitir(e, d) {
    if (bitti) return;
    bitti = true;
    cb(e, d);
  }
  req.on('data', function (c) {
    boy += c.length;
    if (boy > 16384) {
      bitir(new Error('istek govdesi cok buyuk'));
      try { req.destroy(); } catch (e) { }
      return;
    }
    parcalar.push(c);
  });
  req.on('end', function () {
    if (bitti) return;
    try {
      bitir(null, JSON.parse(Buffer.concat(parcalar, boy).toString('utf8') || '{}'));
    } catch (e) {
      bitir(new Error('gecersiz JSON'));
    }
  });
  req.on('error', function (e) { bitir(e); });
}

/* Kaynaga baglantilar tekrar kullanilsin: sarma her seferinde yeni bir
   Range istegi demek, her birine TCP el sikismasi eklemeyelim. */
/* Bir uzun AVPlay Range istegi devam ederken secilen altyazinin kisa ve
   sinirli Range isteginin de ilerleyebilmesi gerekir. Alti baglanti kullanan
   referans yontemi ikiye dusuruldu: en fazla bir video + bir altyazi okuma.
   Bu ikinci istek yeni bir oynatici/oturum degil, yalnizca MP4 metin baytidir. */
var AJAN_HTTP = new http.Agent({ keepAlive: true, maxSockets: 2 });
var AJAN_HTTPS = new https.Agent({ keepAlive: true, maxSockets: 2 });
var UA = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';

/* Range istegi at, yonlendirmeleri izle. Yanit govdesi TUKETILMEZ, cagirana
   verilir. tut.istek her an ucustaki istegi gosterir: istemci baglantiyi
   keserse cagiran onu iptal edebilsin.
   cb(hata, yanit, sonAdres) - en fazla bir kez cagrilir. */
function rangeIstek(adres, bas, son, cb, tut, sayac) {
  sayac = sayac || 0;
  tut = tut || {};
  var bitti = false;
  function bir(e, y, a) {
    if (bitti) { if (y) y.resume(); return; }
    bitti = true;
    cb(e, y, a);
  }

  var p = httpAdresMi(adres);
  if (!p) return bir(new Error('gecersiz kaynak adresi'));
  var guvenli = p.protocol === 'https:';

  var istek;
  try {
    istek = (guvenli ? https : http).request({
      hostname: p.hostname,
      port: p.port || (guvenli ? 443 : 80),
      path: p.path || '/',
      method: 'GET',
      agent: guvenli ? AJAN_HTTPS : AJAN_HTTP,
      headers: {
        'Range': 'bytes=' + bas + '-' + (son === null ? '' : son),
        'User-Agent': UA
      }
    }, function (y) {
      var k = y.statusCode;
      if (k >= 300 && k < 400 && y.headers.location) {
        y.resume();
        if (sayac >= 6) return bir(new Error('cok fazla yonlendirme'));
        var yeni = url.resolve(adres, y.headers.location);
        return rangeIstek(yeni, bas, son, bir, tut, sayac + 1);
      }
      bir(null, y, adres);
    });
  } catch (e) {
    return bir(e);
  }
  tut.istek = istek;
  istek.setTimeout(20000, function () {
    try { istek.abort(); } catch (e) { }
    bir(new Error('kaynak zaman asimi'));
  });
  istek.on('error', function (e) { bir(e); });
  istek.end();
}

var AZAMI_OKUMA = 64 * 1024 * 1024;

/* Bir araligi tamamen bellege oku. Yalnizca 206 kabul edilir: 200 donmesi
   sunucunun Range'i yok saydigi ve butun dosyayi gonderecegi demek. */
function rangeOku(adres, bas, son, cb) {
  rangeIstek(adres, bas, son, function (e, y, sonAdres) {
    if (e) return cb(e);
    if (y.statusCode !== 206) {
      y.resume();
      var h = new Error('kaynak HTTP ' + y.statusCode);
      h.kod = y.statusCode;
      return cb(h);
    }
    var parcalar = [];
    var boy = 0;
    var bitti = false;
    y.on('data', function (c) {
      boy += c.length;
      if (boy > AZAMI_OKUMA) {
        if (!bitti) { bitti = true; cb(new Error('okuma siniri asildi')); }
        try { y.destroy(); } catch (x) { }
        return;
      }
      parcalar.push(c);
    });
    y.on('end', function () {
      if (bitti) return;
      bitti = true;
      cb(null, Buffer.concat(parcalar, boy), y, sonAdres);
    });
    y.on('error', function (x) {
      if (bitti) return;
      bitti = true;
      cb(x);
    });
  });
}

/* ============================== MP4 kutulari ============================= */

function kutuOku(b, o, son) {
  if (o + 8 > son) return null;
  var boy = b.readUInt32BE(o);
  var tip = b.toString('ascii', o + 4, o + 8);
  var hb = 8;
  if (boy === 1) {
    if (o + 16 > son) return null;
    boy = b.readUInt32BE(o + 8) * 4294967296 + b.readUInt32BE(o + 12);
    hb = 16;
  } else if (boy === 0) {
    boy = son - o;
  }
  if (boy < hb || o + boy > son) return null;
  return { ofs: o, boy: boy, tip: tip, hb: hb };
}

function kutular(b, bas, son) {
  var out = [];
  var o = bas;
  while (o + 8 <= son) {
    var k = kutuOku(b, o, son);
    if (!k) break;
    out.push(k);
    o += k.boy;
  }
  return out;
}

function bul(b, kutu, tip) {
  var c = kutular(b, kutu.ofs + kutu.hb, kutu.ofs + kutu.boy);
  for (var i = 0; i < c.length; i++) if (c[i].tip === tip) return c[i];
  return null;
}

function kutuBaslik(boy, tip) {
  var h = Buffer.alloc(8);
  h.writeUInt32BE(boy, 0);
  h.write(tip, 4, 4, 'ascii');
  return h;
}

/* Altyazi ve metin izleri. Samsung'un sinirini asan hep bunlar:
   Sugar'da 45 izin 43'u tx3g. */
var ALTYAZI_ISLEYICI = { sbtl: 1, text: 1, subt: 1, clcp: 1 };
var IZ_SINIRI = 30;

function trakBilgi(b, trak) {
  var tkhd = bul(b, trak, 'tkhd');
  var mdia = bul(b, trak, 'mdia');
  var hdlr = mdia ? bul(b, mdia, 'hdlr') : null;
  var id = 0;
  if (tkhd) {
    var g = tkhd.ofs + tkhd.hb;
    id = b.readUInt32BE(g + (b[g] === 1 ? 20 : 12));
  }
  var isleyici = hdlr ? b.toString('ascii', hdlr.ofs + hdlr.hb + 8, hdlr.ofs + hdlr.hb + 12) : '';
  return { id: id, isleyici: isleyici, tref: !!bul(b, trak, 'tref') };
}

/* Bir trak'tan 'tref' kutusunu cikar. Kalan bir izin referansi (bolum
   listesi, zorunlu altyazi baglantisi) silinmis bir izi gosterebilir;
   oynatma icin gereksiz, sarkan referans ise bazi ayristiricilari bozabilir. */
function trefsiz(b, trak) {
  var parcalar = [];
  var c = kutular(b, trak.ofs + trak.hb, trak.ofs + trak.boy);
  for (var i = 0; i < c.length; i++) {
    if (c[i].tip === 'tref') continue;
    parcalar.push(b.slice(c[i].ofs, c[i].ofs + c[i].boy));
  }
  var govde = Buffer.concat(parcalar);
  return Buffer.concat([kutuBaslik(8 + govde.length, 'trak'), govde]);
}

/* moov: kutunun tamami (baslik dahil). Doner:
     { bolge: Buffer (yeni moov + free, orijinal moov boyunda) | null,
       izOnce, izSonra }
   bolge null ise ayiklanacak bir sey yok - dosya oldugu gibi sunulur. */
function izAyikla(moov) {
  var ust = kutuOku(moov, 0, moov.length);
  if (!ust || ust.tip !== 'moov' || ust.boy !== moov.length) throw new Error('moov gecersiz');

  var cocuklar = kutular(moov, ust.hb, moov.length);
  var traklar = [];
  var i;
  for (i = 0; i < cocuklar.length; i++) {
    if (cocuklar[i].tip !== 'trak') continue;
    var bilgi = trakBilgi(moov, cocuklar[i]);
    bilgi.kutu = cocuklar[i];
    traklar.push(bilgi);
  }

  var tut = [];
  for (i = 0; i < traklar.length; i++) {
    if (!ALTYAZI_ISLEYICI[traklar[i].isleyici]) tut.push(traklar[i]);
  }
  /* Altyazilar gittikten sonra bile sinir asiliyorsa yalnizca goruntu ve ses */
  if (tut.length > IZ_SINIRI) {
    tut = [];
    for (i = 0; i < traklar.length; i++) {
      if (traklar[i].isleyici === 'vide' || traklar[i].isleyici === 'soun') tut.push(traklar[i]);
    }
  }
  if (tut.length === traklar.length) {
    return { bolge: null, izOnce: traklar.length, izSonra: traklar.length };
  }

  var tutulan = {};
  var enBuyukId = 0;
  for (i = 0; i < tut.length; i++) {
    tutulan[tut[i].kutu.ofs] = tut[i];
    if (tut[i].id > enBuyukId) enBuyukId = tut[i].id;
  }

  var parcalar = [];
  for (i = 0; i < cocuklar.length; i++) {
    var c = cocuklar[i];
    if (c.tip === 'trak') {
      var t = tutulan[c.ofs];
      if (!t) continue;
      parcalar.push(t.tref ? trefsiz(moov, c) : moov.slice(c.ofs, c.ofs + c.boy));
    } else if (c.tip === 'mvhd') {
      /* next_track_ID: surum 0'da govde basindan 96, surum 1'de 108 bayt */
      var kopya = Buffer.alloc(c.boy);
      moov.copy(kopya, 0, c.ofs, c.ofs + c.boy);
      var g = c.hb;
      var yer = g + (kopya[g] === 1 ? 108 : 96);
      if (yer + 4 <= kopya.length) kopya.writeUInt32BE(enBuyukId + 1, yer);
      parcalar.push(kopya);
    } else {
      parcalar.push(moov.slice(c.ofs, c.ofs + c.boy));
    }
  }

  var govde = Buffer.concat(parcalar);
  var yeniMoov = Buffer.concat([kutuBaslik(8 + govde.length, 'moov'), govde]);
  var bosluk = moov.length - yeniMoov.length;
  if (bosluk < 8) throw new Error('free dolgusu icin yer yok');
  var free = Buffer.alloc(bosluk);
  kutuBaslik(bosluk, 'free').copy(free, 0);

  return {
    bolge: Buffer.concat([yeniMoov, free]),
    izOnce: traklar.length,
    izSonra: tut.length
  };
}

/* ============================ kaynak hazirligi =========================== */

var BASLIK_PENCERE = 65536;
var MAX_KAYNAK = 3;          /* ayni anda hazir tutulan dosya (her biri ~2-3 MB) */
/* Servis uygulama kapansa da ayakta kalir. Hazirlanmis dosyanin CDN adresi
   (icindeki gecici anahtarla) bu sureden uzun kullanilmadiysa yeniden
   acilista once panelden tazelenir. Testler HM_SERVIS_TAZE_MS ile kisaltir. */
var TAZE_MS = (process.env.HM_SERVIS_TAZE_MS !== undefined && process.env.HM_SERVIS_TAZE_MS !== '')
  ? parseInt(process.env.HM_SERVIS_TAZE_MS, 10) : 20 * 60 * 1000;
var kaynaklar = {};          /* anahtar: kaynak (panel) adresi */
var kimlikler = {};          /* anahtar: AVPlay'e verilen opak yerel kimlik */
var kimlikSayaci = 0;

function kimlikUret() {
  kimlikSayaci++;
  try {
    return crypto.randomBytes(12).toString('hex');
  } catch (e) {
    return Date.now().toString(36) + kimlikSayaci.toString(36) +
      Math.random().toString(36).slice(2, 12);
  }
}

function eskileriAt() {
  var anahtarlar = [];
  for (var a in kaynaklar) {
    if (kaynaklar.hasOwnProperty(a) && kaynaklar[a].hazir) anahtarlar.push(a);
  }
  if (anahtarlar.length <= MAX_KAYNAK) return;
  anahtarlar.sort(function (x, y) { return kaynaklar[x].son - kaynaklar[y].son; });
  for (var i = 0; i < anahtarlar.length - MAX_KAYNAK; i++) {
    kayit('bellekten atildi: ' + kaynaklar[anahtarlar[i]].sunucu);
    delete kimlikler[kaynaklar[anahtarlar[i]].kimlik];
    delete kaynaklar[anahtarlar[i]];
  }
}

/* Ust duzey kutulari dolasip moov'u bul. moov basta olabilir (Sugar) ya da
   mdat'tan sonra, dosyanin sonunda. Sonda ise her kutu basligi icin tek bir
   16 baytlik istek yeter: mdat boyu bir sonraki kutunun yerini soyler. */
function moovBul(k, ilk, cb) {
  var ofs = 0;
  var adim = 0;

  function dene(tampon, tamponBas) {
    while (true) {
      var yer = ofs - tamponBas;
      if (yer < 0 || yer + 8 > tampon.length) break;
      var boy = tampon.readUInt32BE(yer);
      var tip = tampon.toString('ascii', yer + 4, yer + 8);
      if (boy === 1) {
        if (yer + 16 > tampon.length) break;
        boy = tampon.readUInt32BE(yer + 8) * 4294967296 + tampon.readUInt32BE(yer + 12);
      } else if (boy === 0) {
        boy = k.toplam - ofs;
      }
      if (boy < 8) return cb(new Error('bozuk kutu: ' + tip));
      if (tip === 'moov') return cb(null, ofs, boy);
      ofs += boy;
      if (ofs + 8 > k.toplam) return cb(new Error('moov bulunamadi'));
    }
    if (++adim > 32) return cb(new Error('moov bulunamadi (cok kutu)'));
    rangeOku(k.gercekUrl, ofs, Math.min(ofs + 15, k.toplam - 1), function (e, b) {
      if (e) return cb(e);
      dene(b, ofs);
    });
  }
  dene(ilk, 0);
}

/* Dosyayi hazirla: boyu, gercek (yonlendirme sonrasi) adresi ve temizlenmis
   moov bolgesini bul. Ayni dosya icin es zamanli istekler tek hazirligi
   paylasir. cb(hata, kaynak) */
function hazirla(panelUrl, cb) {
  var k = kaynaklar[panelUrl];
  if (k && k.hazir) {
    if (Date.now() - k.son <= TAZE_MS) { k.son = Date.now(); return cb(null, k); }
    /* Uzun suredir kullanilmamis: iz bilgisi gecerli, yalnizca CDN adresi
       bayatlamis olabilir. Tazelenemezse kaydi atip sifirdan hazirla. */
    k.son = Date.now();
    return adresTazele(k, function (eT) {
      if (!eT) return cb(null, k);
      delete kimlikler[k.kimlik];
      delete kaynaklar[panelUrl];
      hazirla(panelUrl, cb);
    });
  }
  if (k && k.bekleyenler) { k.bekleyenler.push(cb); return; }

  k = {
    panelUrl: panelUrl, sunucu: sunucuAdi(panelUrl),
    kimlik: kimlikUret(),
    bekleyenler: [cb], son: Date.now(), hazir: false,
    istek: 0, aktarilan: 0, tazeleme: 0
  };
  kaynaklar[panelUrl] = k;
  var bas = Date.now();

  function bitir(e) {
    var b = k.bekleyenler;
    k.bekleyenler = null;
    if (e) {
      delete kimlikler[k.kimlik];
      delete kaynaklar[panelUrl];
      kayit('hazirlanamadi ' + k.sunucu + ': ' + e.message);
      sonHata = e.message;
    } else {
      k.hazir = true;
      kimlikler[k.kimlik] = k;
      k.hazirlikMs = Date.now() - bas;
      eskileriAt();
    }
    for (var i = 0; i < b.length; i++) b[i](e || null, e ? null : k);
  }

  rangeOku(panelUrl, 0, BASLIK_PENCERE - 1, function (e, ilk, y, sonAdres) {
    if (e) return bitir(e);
    var m = /\/(\d+)\s*$/.exec(String(y.headers['content-range'] || ''));
    if (!m) return bitir(new Error('dosya boyu okunamadi'));
    k.toplam = parseInt(m[1], 10);
    k.gercekUrl = sonAdres;

    moovBul(k, ilk, function (e2, moovBas, moovBoy) {
      if (e2) return bitir(e2);
      if (moovBoy > AZAMI_OKUMA) return bitir(new Error('moov cok buyuk: ' + moovBoy));

      function moovHazir(e3, moov) {
        if (e3) return bitir(e3);
        if (moov.length !== moovBoy) return bitir(new Error('moov eksik indi'));
        var s;
        try { s = izAyikla(moov); } catch (x) { return bitir(x); }
        k.moovBas = moovBas;
        k.moovBoy = moovBoy;
        k.bolge = s.bolge;
        k.izOnce = s.izOnce;
        k.izSonra = s.izSonra;
        kayit('hazir ' + k.sunucu + ': iz ' + s.izOnce + ' -> ' + s.izSonra +
          ', moov ' + moovBoy + ' B, ' + (Date.now() - bas) + ' ms');
        bitir(null);
      }

      if (moovBas + moovBoy <= ilk.length) {
        moovHazir(null, ilk.slice(moovBas, moovBas + moovBoy));
      } else {
        rangeOku(k.gercekUrl, moovBas, moovBas + moovBoy - 1, function (e3, moov) {
          moovHazir(e3, moov);
        });
      }
    });
  });
}

/* Token bayatladi: gercek adresi panelden yeniden coz. Istekler bir saate
   yayilinca CDN adresindeki token oturum ortasinda suresi dolabiliyor
   (altyazi cekmede ogrendigimiz ders). */
function adresTazele(k, cb) {
  k.tazeleme++;
  rangeOku(k.panelUrl, 0, 0, function (e, b, y, sonAdres) {
    if (e) {
      kayit('adres tazelenemedi ' + k.sunucu + ': ' + e.message);
      return cb(e);
    }
    k.gercekUrl = sonAdres;
    kayit('adres tazelendi ' + k.sunucu);
    cb(null);
  });
}

/* ============================== video sunumu ============================= */

function aralikCoz(baslik, toplam) {
  if (!baslik) return { a: 0, b: toplam - 1, tam: true };
  var m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/.exec(String(baslik));
  if (!m || (m[1] === '' && m[2] === '')) return null;       /* coklu aralik da buraya */
  var a, b;
  if (m[1] === '') {
    var n = parseInt(m[2], 10);
    if (!(n > 0)) return null;
    a = Math.max(0, toplam - n);
    b = toplam - 1;
  } else {
    a = parseInt(m[1], 10);
    b = (m[2] === '') ? toplam - 1 : Math.min(parseInt(m[2], 10), toplam - 1);
  }
  if (a >= toplam || a > b) return null;
  return { a: a, b: b, tam: false };
}

/* [a, b] araligini kaynak ve bellek parcalarina bol */
function bolgeler(k, a, b) {
  if (!k.bolge) return [{ tur: 'kaynak', bas: a, son: b }];
  var mb = k.moovBas;
  var ms = k.moovBas + k.moovBoy - 1;
  var out = [];
  if (a < mb) out.push({ tur: 'kaynak', bas: a, son: Math.min(b, mb - 1) });
  if (b >= mb && a <= ms) out.push({ tur: 'bellek', bas: Math.max(a, mb), son: Math.min(b, ms) });
  if (b > ms) out.push({ tur: 'kaynak', bas: Math.max(a, ms + 1), son: b });
  return out;
}

var sonHata = '';
var toplamIstek = 0;

function videoIstegi(req, res, kimlik, ham) {
  var k = kimlikler[String(kimlik || '')];
  if (!k || !k.hazir) return json(res, 404, { ok: false, hata: 'kaynak hazir degil' });
  toplamIstek++;
    k.son = Date.now();
    k.istek++;

    var r = aralikCoz(req.headers.range, k.toplam);
    if (!r) {
      var h416 = temelBasliklar('video/mp4', res);
      h416['Content-Range'] = 'bytes */' + k.toplam;
      res.writeHead(416, h416);
      return res.end();
    }

    var h = temelBasliklar('video/mp4', res);
    h['Accept-Ranges'] = 'bytes';
    h['Content-Length'] = String(r.b - r.a + 1);
    if (!r.tam) h['Content-Range'] = 'bytes ' + r.a + '-' + r.b + '/' + k.toplam;
    res.writeHead(r.tam ? 200 : 206, h);
    if (req.method === 'HEAD') return res.end();

    var parcalar = ham
      ? [{ tur: 'kaynak', bas: r.a, son: r.b }]
      : bolgeler(k, r.a, r.b);
    var kesildi = false;
    var tut = {};
    var akan = null;

    function kes() {
      if (kesildi) return;
      kesildi = true;
      if (akan) { try { akan.unpipe(res); akan.destroy(); } catch (x) { } }
      if (tut.istek) { try { tut.istek.abort(); } catch (x) { } }
    }
    req.on('close', kes);
    res.on('close', kes);

    function hataylaBitir(mesaj) {
      kayit('aktarim kesildi ' + k.sunucu + ': ' + mesaj);
      sonHata = mesaj;
      kes();
      try { res.destroy(); } catch (x) { }
    }

    function sonraki(i, tazelendi) {
      if (kesildi) return;
      if (i >= parcalar.length) return res.end();
      var p = parcalar[i];

      if (p.tur === 'bellek') {
        var dilim = k.bolge.slice(p.bas - k.moovBas, p.son - k.moovBas + 1);
        k.aktarilan += dilim.length;
        if (res.write(dilim)) return sonraki(i + 1, false);
        res.once('drain', function () { sonraki(i + 1, false); });
        return;
      }

      /* Kayitli CDN adresi bayatlamis olabilir: 206 disindaki her yanitta
         ya da baglanti hatasinda once adresi panelden bir kez tazele. */
      function tazeleVeTekrar(sebep) {
        kayit('kaynak adresi yenileniyor (' + sebep + ') ' + k.sunucu);
        adresTazele(k, function (e3) {
          if (kesildi) return;
          if (e3) return hataylaBitir('adres tazelenemedi: ' + e3.message);
          sonraki(i, true);
        });
      }

      rangeIstek(k.gercekUrl, p.bas, p.son, function (e2, y, sonAdres) {
        if (kesildi) { if (y) y.resume(); return; }
        if (e2 && !tazelendi) return tazeleVeTekrar(e2.message);
        if (e2) return hataylaBitir(e2.message);
        var kod = y.statusCode;
        if (kod !== 206 && !tazelendi) {
          y.resume();
          return tazeleVeTekrar('HTTP ' + kod);
        }
        if (kod !== 206) {
          y.resume();
          return hataylaBitir('kaynak HTTP ' + kod);
        }
        k.gercekUrl = sonAdres;
        akan = y;
        y.on('data', function (c) { k.aktarilan += c.length; });
        y.on('error', function (x) { hataylaBitir(x.message); });
        y.on('end', function () {
          akan = null;
          sonraki(i + 1, false);
        });
        y.pipe(res, { end: false });
      }, tut);
    }

    sonraki(0, false);
}

/* Uygulama oynatmaya baslamadan once dosyayi hazirlatir: hem iz sayisini
   ogrenir hem de moov onceden indirilmis olur, AVPlay'in ilk istegi bekletmez.
   Hazirlik basarisizsa AVPlay'e hic gidilmeden anlasilir bir hata verilir. */
function incele(res, kaynak) {
  if (!httpAdresMi(kaynak)) return json(res, 400, { ok: false, hata: 'gecersiz adres' });
  hazirla(kaynak, function (e, k) {
    if (e) return json(res, 200, { ok: false, hata: e.message });
    json(res, 200, {
      ok: true,
      kimlik: k.kimlik,
      izOnce: k.izOnce,
      izSonra: k.izSonra,
      ayiklandi: !!k.bolge,
      toplam: k.toplam,
      moovBoy: k.moovBoy,
      hazirlikMs: k.hazirlikMs
    });
  });
}

/* ================================ durum ================================= */

function durum(res) {
  var bellek = null;
  try { bellek = process.memoryUsage(); } catch (e) { }
  var ozet = [];
  for (var a in kaynaklar) {
    if (!kaynaklar.hasOwnProperty(a) || !kaynaklar[a].hazir) continue;
    var k = kaynaklar[a];
    /* Tam adres yok: kimlik bilgisi tasiyor */
    ozet.push({
      sunucu: k.sunucu, izOnce: k.izOnce, izSonra: k.izSonra,
      istek: k.istek, aktarilanMB: Math.round(k.aktarilan / 104857.6) / 10,
      tazeleme: k.tazeleme
    });
  }
  json(res, 200, {
    ok: true,
    servis: 'hm-servis',
    paket: PAKET,
    oturum: OTURUM,
    surum: SURUM,
    node: process.version,
    platform: process.platform + '/' + process.arch,
    pid: process.pid,
    calismaSn: Math.round((Date.now() - baslangic) / 1000),
    bellekMB: bellek && bellek.rss ? Math.round(bellek.rss / 1048576) : null,
    videoIstegi: toplamIstek,
    kaynaklar: ozet,
    sonHata: sonHata
  });
}

/* ================================ sunucu ================================ */

var sunucu = http.createServer(function (req, res) {
  var u = url.parse(req.url, true);
  var origin = izinliOrigin(req.headers && req.headers.origin);
  if (req.headers && req.headers.origin && !origin) {
    res.writeHead(403, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('yasak origin');
    return;
  }
  res._hmOrigin = origin || 'null';
  if (req.method === 'OPTIONS') { basliklar(res, 204, 'text/plain'); return res.end(); }
  if (u.pathname === '/durum') return durum(res);
  if (!u.query || u.query.s !== OTURUM) return json(res, 403, { ok: false, hata: 'yetkisiz oturum' });
  /* AVPlay yalnizca opak kimligi gorur. Gercek kaynak adresi sorgu
     dizesine hic yazilmaz. /o yazilim altyazisi icin degistirilmemis MP4. */
  var video = /^\/v\/([a-z0-9]+)\/video\.mp4$/.exec(u.pathname);
  if (video) return videoIstegi(req, res, video[1], false);
  var kaynak = /^\/o\/([a-z0-9]+)\/source\.mp4$/.exec(u.pathname);
  if (kaynak) return videoIstegi(req, res, kaynak[1], true);
  if (u.pathname === '/incele') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, hata: 'POST gerekli' });
    return jsonGovde(req, function (e, d) {
      if (e) return json(res, 400, { ok: false, hata: e.message });
      incele(res, d && d.kaynak);
    });
  }
  if (u.pathname === '/kayit') return json(res, 200, { ok: true, kayit: KAYIT });
  if (u.pathname === '/kapat') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, hata: 'POST gerekli' });
    /* Eski bir servis ornegi guncellemeden sonra ayakta kalirsa uygulama
       onu kapatip yenisini baslatabilsin. */
    json(res, 200, { ok: true });
    kayit('kapatiliyor (istek uzerine)');
    setTimeout(function () { process.exit(0); }, 100);
    return;
  }
  basliklar(res, 404, 'text/plain');
  res.end('yok');
});

sunucu.on('error', function (e) {
  /* Servis ikinci kez baslatilirsa port dolu olur; ilk ornek zaten
     hizmette, bu ornegin yapacak isi yok. */
  kayit('sunucu hatasi: ' + (e && e.code ? e.code : '') + ' ' + (e && e.message));
});

sunucu.listen(PORT, ADRES, function () {
  kayit('dinliyor ' + ADRES + ':' + PORT + ' (node ' + process.version + ', surum ' + SURUM + ')');
});

/* TV'de bir hata servisi oldurmesin: yakala, gunluge yaz, hizmete devam et.
   Testlerde ise ayni yakalayici hatayi yutup sureci asili birakiyordu
   (yasandi); HM_SERVIS_TEST=1 ile kapatilir. */
if (process.env.HM_SERVIS_TEST !== '1') {
  process.on('uncaughtException', function (e) {
    var yer = (e && e.stack) ? String(e.stack).split('\n').slice(0, 3).join(' <- ') : '';
    kayit('YAKALANMAYAN: ' + (e && e.message) + (yer ? ' | ' + yer : ''));
  });
}

/* Testler MP4 islemlerini dogrudan sinayabilsin (sunucu yine de kalkar) */
module.exports.izAyikla = izAyikla;
module.exports.aralikCoz = aralikCoz;
module.exports.bolgeler = bolgeler;

/* Tizen web servis sozlesmesi. Calisma ortami bunlari cagirabilir; sunucu
   yukarida zaten kalkti. vlc-tizen-tv bunlar olmadan da calisiyor, ama
   belgelenmis sozlesmeye uymak zararsiz. */
module.exports.onStart = function () { kayit('onStart'); };
module.exports.onRequest = function () { kayit('onRequest'); };
module.exports.onExit = function () {
  kayit('onExit');
  try { sunucu.close(); } catch (e) { }
};
