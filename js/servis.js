/* servis.js - TV icindeki yerel servisle konusur (uygulama tarafi)

   Servisin kendisi service/servis.js; TV'nin Node calisma ortaminda,
   127.0.0.1 uzerinde kosuyor. Ayni .wgt paketinin parcasi: ayrica kurulmaz,
   uygulama listesinde ayri simgesi yok, uygulama silinince o da gider.

   Uygulama servisi ihtiyac duyunca kendisi baslatir. Servis zaten ayaktaysa
   (onceki bir acilistan kalmis olabilir) baslatma denemesi yapilmaz. */
'use strict';

var Servis = {
  PORT: 18631,
  PAKET: 'HV9K26T901',
  AD: 'HMServis',              /* config.xml -> tizen:service id = <paket>.HMServis */
  YOKLAMA_MS: 300,
  YOKLAMA_SAYI: 20,            /* ~6 sn: soguk baslangicta Node'un kalkmasi icin */
  OTURUM: '',

  taban: function () { return 'http://127.0.0.1:' + this.PORT; },

  destekli: function () {
    try {
      if (tizen.systeminfo && typeof tizen.systeminfo.getCapability === 'function') {
        return tizen.systeminfo.getCapability('http://tizen.org/feature/web.service') !== false;
      }
    } catch (e) { }
    /* Eski cihazlarda capability sorgusu bulunmayabilir; launch denemesi
       kesin sonucu verecegi icin burada yanlis negatif uretmeyelim. */
    return true;
  },

  /* Servis kimligi calisma aninda kuruluyor: paket kimligi config.xml'de
     tek yerde dursun, burada tekrar yazilmasin. TV disinda (jsdom, masaustu)
     tizen nesnesi yok; o zaman null. */
  kimlik: function () {
    try {
      var id = tizen.application.getCurrentApplication().appInfo.id;
      return id.split('.')[0] + '.' + this.AD;
    } catch (e) {
      return null;
    }
  },

  requestJson: function (yol, method, veri, zamanAsimi) {
    var self = this;
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      var bitti = false;
      var zaman = setTimeout(function () {
        if (bitti) return;
        bitti = true;
        try { x.abort(); } catch (e) { }
        reject(new Error('zaman asimi'));
      }, zamanAsimi || 2000);

      if (yol !== '/durum' && self.OTURUM) {
        yol += (yol.indexOf('?') === -1 ? '?' : '&') + 's=' + encodeURIComponent(self.OTURUM);
      }
      x.open(method || 'GET', self.taban() + yol, true);
      if (veri !== undefined && veri !== null) {
        x.setRequestHeader('Content-Type', 'application/json');
      }
      x.onreadystatechange = function () {
        if (x.readyState !== 4 || bitti) return;
        bitti = true;
        clearTimeout(zaman);
        if (x.status === 0) { reject(new Error('servis yanit vermiyor')); return; }
        var d = null;
        try { d = JSON.parse(x.responseText); } catch (e) { }
        if (!d) { reject(new Error('gecersiz yanit (HTTP ' + x.status + ')')); return; }
        resolve(d);
      };
      try { x.send(veri === undefined || veri === null ? null : JSON.stringify(veri)); } catch (e) {
        bitti = true;
        clearTimeout(zaman);
        reject(e);
      }
    });
  },

  getJson: function (yol, zamanAsimi) {
    return this.requestJson(yol, 'GET', null, zamanAsimi);
  },

  /* Portta yanit veren sey gercekten bizim servis mi? Ayni portu baska bir
     uygulama kullaniyorsa onu servis sanip ona video yonlendirmeyelim. */
  durum: function () {
    return this.getJson('/durum', 1500).then(function (d) {
      if (!d || d.servis !== 'hm-servis' || d.paket !== Servis.PAKET) throw new Error('portta baska bir servis var');
      Servis.OTURUM = d.oturum || '';
      return d;
    });
  },

  /* Servisi ayaga kaldir. Doner: { durum, baslatildi, sureMs }
     Zaten calisiyorsa launch cagrilmaz. */
  baslat: function () {
    var self = this;
    /* Bazi Samsung TV'ler servis calistirabildigi halde web.service
       capability anahtarina false donuyor. Bu deger yalnizca tanilamadir;
       kesin karar localhost yoklamasi + application.launch sonucudur. */
    Diag.set('Yerel servis yetenegi', this.destekli() ? 'Bildiriliyor' : 'Bildirilmiyor · yine de deneniyor');
    return this.durum().then(function (d) {
      return { durum: d, baslatildi: false, sureMs: 0 };
    }, function () {
      var kimlik = self.kimlik();
      if (!kimlik) return Promise.reject(new Error('TV disi ortam: tizen.application yok'));

      var bas = Date.now();
      var launchHata = null;
      try {
        tizen.application.launch(kimlik, function () { }, function (e) {
          launchHata = e;
        });
      } catch (e) {
        launchHata = e;
      }
      Diag.add('Servis baslatiliyor: ' + kimlik);

      return new Promise(function (resolve, reject) {
        var deneme = 0;
        (function yokla() {
          self.durum().then(function (d) {
            var ms = Date.now() - bas;
            Diag.add('Servis ayakta: ' + ms + ' ms, node ' + d.node);
            resolve({ durum: d, baslatildi: true, sureMs: ms });
          }, function () {
            if (++deneme >= self.YOKLAMA_SAYI) {
              var m = launchHata
                ? ('baslatilamadi: ' + (launchHata.message || launchHata.name || launchHata))
                : 'servis ' + Math.round((Date.now() - bas) / 1000) + ' sn icinde yanit vermedi';
              Diag.add('Servis: ' + m);
              reject(new Error(m));
              return;
            }
            setTimeout(yokla, self.YOKLAMA_MS);
          });
        })();
      });
    });
  },

  kayitlar: function () { return this.getJson('/kayit', 2000); },

  /* ----------------------- cok izli dosyalar -----------------------

     Samsung'un oynaticisi 32'den fazla izi olan MP4'leri acmiyor. Servis bu
     dosyalarin altyazi izlerini moov'dan ayiklayip ayni boyda bir 'free'
     kutusuyla dolduruyor; butun bayt ofsetleri korundugu icin geri kalan her
     bayt kaynaktan oldugu gibi akiyor. Altyazilar etkilenmez: uygulama onlari
     dogrudan kaynak dosyadan okuyor. Ayrintilar: service/servis.js */

  /* Surum 7: bayat kaynak adresi tazeleme ve video yanitlarinda dogru CORS.
     TV'de ayakta kalan eski servis (6) otomatik kapatilip yenisi baslatilir. */
  GEREKEN_SURUM: 7,

  /* AVPlay'e verilecek adres. Yolun .mp4 ile bitmesi ayristiriciya ipucu;
     kaynak adresi yerine servis icindeki gecici opak kimlik kullanilir. */
  adres: function (kimlik) {
    return this.taban() + '/v/' + encodeURIComponent(kimlik) + '/video.mp4?s=' + encodeURIComponent(this.OTURUM || '');
  },

  /* Yazilimsal TX3G altyazi okuyucusu altyazi izleri ayiklanmamis ham
     dosyayi ayni tek-baglantili servis uzerinden okur. */
  kaynakAdresi: function (kimlik) {
    return this.taban() + '/o/' + encodeURIComponent(kimlik) + '/source.mp4?s=' + encodeURIComponent(this.OTURUM || '');
  },

  /* Servisi baslat ve surumunun yeterli oldugundan emin ol. TV'de onceki
     surumden kalma bir servis ornegi ayakta olabilir; eskiyse kapatilip
     yenisi baslatilir (bir kez). */
  hazirla: function () {
    var self = this;
    return this.baslat().then(function (r) {
      if ((r.durum.surum || 0) >= self.GEREKEN_SURUM) return r;
      Diag.add('Servis eski surum (' + r.durum.surum + '), yeniden baslatiliyor');
      return self.requestJson('/kapat', 'POST', null, 2000)['catch'](function () { }).then(function () {
        return new Promise(function (res) { setTimeout(res, 600); });
      }).then(function () {
        return self.baslat();
      }).then(function (r2) {
        if ((r2.durum.surum || 0) < self.GEREKEN_SURUM) {
          throw new Error('servis guncellenemedi (surum ' + r2.durum.surum + ')');
        }
        return r2;
      });
    });
  },

  /* Dosyayi servise onceden hazirlat: iz sayisini ogren, moov indirilsin.
     AVPlay'e gitmeden once basarisizlik anlasilir bir hatayla yakalanir.
     Doner: { ok, izOnce, izSonra, ayiklandi, toplam, moovBoy, hazirlikMs } */
  incele: function (kaynak) {
    return this.requestJson('/incele', 'POST', { kaynak: kaynak }, 30000);
  }
};
