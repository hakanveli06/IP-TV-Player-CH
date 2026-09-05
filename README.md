# H&M Player

Samsung Tizen televizyonlar için kumanda odaklı IPTV oynatıcı. Ana hedef cihaz Samsung AU8000 serisi (2021), Tizen 6.0 ve Chromium 76'dır. Uygulama 1920×1080 çözünürlük ve ES2017/ES2018 uyumluluğu gözetilerek geliştirilmiştir.

## Başlıca özellikler

- Canlı TV, film, dizi, favoriler ve son izlenenler
- Kategori içi ve genel Türkçe karakter duyarsız arama
- Canlı yayın kanal listesi, kanal geçmişi ve küçük ön izleme
- Canlı TV ile VOD için ayrı AVPlay/HTML5 motor tercihleri
- Ses parçası ve altyazı seçimi; sorunlu TX3G altyazılar için uyumluluk yolu
- Kategori bazında öğrenen canlı yayın tamponu ve otomatik yeniden bağlanma
- Çoklu IPTV hesabı desteği
- Günlük EPG görünümü, kategori göster/gizle ve favori sıralama
- Kumanda ile tam kullanım ve yerleşik teşhis ekranı

## Gereksinimler

- Node.js (harici npm paketi gerekmez)
- Samsung TV'ye kurulum için hedef TV'nin DUID bilgisini kapsayan Samsung/Tizen sertifikası
- Kurulum aracı olarak Apps2Samsung veya Tizen Studio

## Test ve paketleme

```powershell
npm test
npm run build
npm run verify
```

`npm run build` çıktıyı `dist/` altında oluşturur. Paylaşım için temel WGT ve ZIP de üretmek isterseniz:

```powershell
node tools/build.js --share
```

Oluşan temel WGT, hedef televizyonun DUID'sini kapsayan sertifikayla imzalanmadan TV'ye kurulamaz. Apps2Samsung kullanılıyorsa temel WGT seçilir ve araç hedef TV için imzalı kurulum paketini hazırlar.

## Güvenlik

IPTV sunucu adresi, kullanıcı adı ve parola kaynak kodda tutulmaz; kullanıcı tarafından TV üzerinde girilir ve yerel depolamada saklanır. Gerçek hesap bilgilerini, teşhis indirmelerini veya imzalama sertifikalarını Git deposuna eklemeyin.

## Sürüm

Güncel kaynak sürümü: **1.15.0**. Ayrıntılar için [sürüm notlarına](SURUM_NOTLARI_v1.15.0.md) bakın.
