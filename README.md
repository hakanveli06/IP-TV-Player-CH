# H&M IPTV Player — Public v2

Samsung Tizen televizyonlar için kumanda odaklı IPTV oynatıcısı.

Bu Public depo v2 ile birlikte sıfırdan başlatılmıştır. Tamamlanmış özel
Family v1.32.2 sürümünün Git geçmişi ve gizli yapılandırmaları bu depoya
taşınmamıştır. v2, çalışan v1.32.2 özelliklerini koruyan yeni Public geliştirme
hattıdır.

## v2'nin amacı

- Canlı TV, film ve dizi deneyimini Tizen 6 / Chromium 76 uyumluluğuyla korumak
- TMDb ayrıntılarını kullanıcıdan anahtar istemeden sunabilmek
- TMDb anahtarını WGT paketinden ve Git geçmişinden tamamen çıkarmak
- Ücretsiz Cloudflare Worker katmanıyla dar kapsamlı ve önbellekli bir TMDb geçidi kullanmak
- İsteyen ileri seviye kullanıcının kendi kişisel TMDb anahtarını girebilmesini sürdürmek

## Mimari

```text
Samsung TV uygulaması
        │
        ├── IPTV sağlayıcısı (canlı yayın / VOD)
        │
        └── Public TMDb proxy
                 │
                 └── TMDb API
                     Anahtar yalnızca Cloudflare secret içinde
```

Uygulama proxy üzerinden yalnızca kullandığı TMDb yollarına erişebilir. Worker;
bilinmeyen yolları, bilinmeyen sorgu parametrelerini ve istemciden gönderilen
`api_key` parametresini reddeder. TMDb yanıtları anahtar içermeden akış halinde
TV'ye iletilir ve uygun yanıtlar Cloudflare önbelleğine alınır.

## Mevcut durum

- Uygulama sürüm hattı: `2.0.0`
- v1.32.2 kaynak tabanı Public v2'ye aktarıldı
- Family anahtar yerleştirme kodu kaldırıldı
- Public TMDb proxy istemcisi eklendi
- Cloudflare Worker ve testleri eklendi
- Anahtarsız Public WGT üretimi ve hassas bilgi denetimi çalışıyor
- Gerçek Worker dağıtımı ve Public proxy adresinin uygulamaya yazılması bekliyor

## Doğrulama ve paketleme

Node.js kurulu bir ortamda:

```text
npm install --prefix worker
npm run verify
```

Doğrulama; eski oynatıcı regresyon testlerini, v2 proxy testlerini, Worker
dry-run paketlemesini, Public kaynak taramasını ve WGT hassas bilgi denetimini
birlikte çalıştırır.

Public WGT:

```text
npm run build
```

Çıktı `dist/HM_Player_v2.0.0_Public.wgt` olarak üretilir. Derleme çıktıları
Git'e eklenmez; yayın sırasında GitHub Release dosyası olarak sunulacaktır.

## Cloudflare Worker

Kurulum ve dağıtım ayrıntıları için [TMDb proxy rehberine](docs/tmdb-proxy.tr.md)
bakın. Gerçek TMDb anahtarı yalnızca Wrangler ile `TMDB_READ_TOKEN` secret'ı
olarak kaydedilir.

## Güvenlik ve gizlilik

- Kaynak kodda, WGT içinde ve Git geçmişinde ortak TMDb anahtarı bulunmaz.
- IPTV kullanıcı adı ve şifresi uygulamaya kullanıcı tarafından girilir.
- Public kaynak ve WGT denetimleri olası sabit anahtarları ve hesap bilgilerini reddeder.
- Kişisel TMDb anahtarı kullanılırsa yalnızca televizyonun yerel ayarlarında saklanır.

This product uses the TMDB API but is not endorsed or certified by TMDB.
Streaming availability data shown by TMDb is provided by JustWatch.
