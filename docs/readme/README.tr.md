# H&M Player

[English](../../README.md) · [Türkçe](README.tr.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Русский](README.ru.md) · [Português](README.pt.md)

Samsung Tizen televizyonlar için kumanda odaklı IPTV oynatıcı. H&M Player; canlı TV, film ve dizileri AVPlay donanım desteği, HTML5 alternatifi, kanal ön izlemesi, EPG, çoklu hesap ve isteğe bağlı TMDb ayrıntılarıyla birleştirir.

## Öne çıkanlar

- Canlı TV, film, dizi, favoriler ve Son İzlediklerim
- Canlı TV ve VOD için birbirinden bağımsız AVPlay/HTML5 motor seçimi
- İki aşamalı kanal ön izlemesi ve kesintisiz tam ekran geçişi
- Günlük EPG, son iki kanal arasında geçiş ve son kanal listesi
- Ses/altyazı seçimi ve bozuk TX3G altyazılar için uyumluluk yöntemi
- Öğrenen canlı yayın tamponu ve otomatik yeniden bağlanma
- Hesaba bağlı favori, geçmiş ve kaldığın yer verileriyle altı IPTV profili
- Kategori göster/gizle ve favori kanal sıralama
- İsteğe bağlı TMDb puanı, yerelleştirilmiş başlık/özet, oyuncu fotoğrafları, yapım bilgileri ve ülkeye göre platform bilgisi
- IPTV şifresini göstermeyen yerleşik teşhis
- Otomatik, Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, Rusça ve Portekizce arayüz seçenekleri

Sağlayıcının kanal/kategori adları ve EPG metni değiştirilmeden gösterilir. TMDb metinleri uygulama diline, izlenebilir platformlar ise ayrıca seçilen içerik bölgesine göre gelir.

## Uyumluluk ve kurulum

Ana hedef 1920×1080 Samsung Tizen TV’lerdir. Kod, Tizen 6.0’daki Chromium 76 kuşağıyla uyumludur ve eski Samsung modelleri için otomatik AVPlay uyumluluk modu içerir.

WGT kurulumu için hedef televizyonun DUID bilgisini kapsayan Samsung/Tizen sertifikası gerekir. İmzalama ve kurulum Apps2Samsung veya Tizen Studio ile yapılabilir.

## İlk başlangıç

Başlangıç yardımcısı kullanıcıyı sorularla yormamak için yalnızca şunları ister:

1. Arayüz dili
2. Xtream IPTV hesap bilgileri

Oynatıcı, tampon ve TMDb ayarları daha sonra Ayarlar bölümünden yapılır.

## İsteğe bağlı TMDb

Public pakette ortak/gömülü TMDb anahtarı yoktur. Kullanıcı **Ayarlar → TMDb** bölümünden ücretsiz kişisel 32 karakterli API anahtarını veya API okuma erişim jetonunu girebilir. Aynı ekran TMDb’nin kazanımlarını, anahtarın nasıl alınacağını ve içerik bölgesinin nasıl seçileceğini açıklar.

TMDb isteğe bağlıdır, oynatmayı etkilemez, IPTV sağlayıcısından bağımsızdır ve IPTV bağlantı hakkını tüketmez. Ayrıntılar: [TMDb kurulum rehberi](../tmdb-setup.tr.md).

## Test ve paketleme

```powershell
npm test
npm run build
npm run verify
npm run audit:packages
npm run audit:public
```

`npm run build`, gömülü TMDb anahtarı içermeyen `dist/HM_Player_vX.Y.Z_Public.wgt` dosyasını üretir. Family paketi için yerel anahtar `.private/tmdb-token.txt` dosyasına yazılır veya `HM_TMDB_TOKEN` değişkeninden sağlanır ve `npm run build:family` çalıştırılır.

## Güvenlik

- IPTV bilgileri TV’de girilir; kaynak kodda bulunmaz.
- Gerçek IPTV hesaplarını, sertifikaları ve ham teşhis kayıtlarını depoya eklemeyin.
- Kişisel TMDb anahtarı yalnızca TV’de saklanır ve IPTV sağlayıcısına gönderilmez.
- Public paket ve kaynak denetimleri gömülü TMDb sırrını ve sabit IPTV hesabını reddeder.

Güncel sürüm: **1.21.0** · [Sürüm notları](../../SURUM_NOTLARI_v1.21.0.md)

Bu ürün TMDB API’sini kullanır ancak TMDB tarafından desteklenmez veya onaylanmaz. Platform bilgileri JustWatch tarafından sağlanır.
