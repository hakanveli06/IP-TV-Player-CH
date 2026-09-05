# H&M Player v1.14.2 — AVPlay ön izleme teşhisi

Bu paket, Tizen 6.0 cihazında AVPlay yayınında ses ve tam ekran görüntüsü çalışırken küçük ön izleme görüntüsünün görünmemesini iki kontrollü modla ayırmak için hazırlanmıştır.

## Mod 1: Şeffaf pencere (varsayılan)

- AVPlay yerel donanım katmanında, arayüzün altında tutulur.
- Ön izleme alanının bütün ilgili HTML zeminleri şeffaflaştırılarak `506×180` boyutunda bir görüntü penceresi açılır.
- Önceki sürümde şüpheli olan geniş `box-shadow` kullanılmaz.
- HTML5 ön izleme davranışı değiştirilmez ve normal DOM üst katmanında kalır.

## Mod 2: Arayüz gizli

- Ayarlar içindeki `AVPlay on izleme testi` satırından seçilir.
- Kanalda ilk OK sonrasında web arayüzünün tamamı gizlenir; AVPlay aynı küçük `506×180` dikdörtgende çalışmaya devam eder.
- Bu modda küçük görüntü görünürse `setDisplayRect` çalışıyor ve sorun kesin olarak HTML kompozit katmanındadır.
- Arayüz gizliyken STOP tuşu oynatmayı kapatıp kanal listesine döndürür. INFO teşhis ekranını açabilir.
- Arayüz gizliyken küçük görüntü de görünmez, fakat ses sürerse sonraki inceleme AVPlay'in oynatma sırasında küçük dikdörtgene geçiş zamanlamasına odaklanacaktır.

## Değişmeyenler

- Her iki mod aynı mevcut medya bağlantısını kullanır; ikinci bağlantı veya paralel istek açılmaz.
- Kanal açma, tampon, otomatik yenileme, EPG, tam ekran ve HTML5 oynatma mantığı değiştirilmedi.
- Uygulama kimliği korunmuştur. Sürüm `H&M.v1.14.2` olmuştur.

## Test sırası

1. Ayarlar → Canlı TV oynatıcısı: AVPlay.
2. `AVPlay on izleme testi: Seffaf pencere` durumunda bir kanala ilk OK ile girin.
3. Görüntü yoksa STOP ile çıkın.
4. Ayarlar → `AVPlay on izleme testi` satırını `Arayuz gizli` yapın.
5. Aynı kanala dönüp ilk OK'ye basın. Arayüz kaybolduğunda sağ üstte küçük görüntünün bulunup bulunmadığını kaydedin.
6. INFO teşhis ekranının fotoğrafını ve iki modun sonucunu bildirin.

## Doğrulama

- Kaynak sözdizimi, Chromium 76 uyumluluk, sürüm eşleşmesi ve tüm mevcut otomatik testler geçti.
- Ön izleme testi; iki gövde sınıfını, şeffaf pencereyi, izole modda arayüzün gizlenmesini, AVPlay dikdörtgenini ve eski oturum korumasını denetliyor.
- Fiziksel AVPlay görüntü yüzeyi masaüstü testinde taklit edilemediğinden nihai teşhis Samsung TV sonucuna bağlıdır.

Temel WGT, Apps2Samsung ile hedef televizyonun sertifikası kullanılarak imzalanmalıdır.
