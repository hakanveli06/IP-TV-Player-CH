# H&M Player v1.17.0

## Yeni kurumsal logo

- Uygulama ikonu ve Hakkında ekranı, gümüş-grafit zeminli ve altın `H&M IP TV` yazılı yeni kurumsal logoya geçirildi.
- Kaynak görsel, Tizen uygulama ikonu için 512×512 boyutuna yüksek kaliteli olarak uyarlandı.

## Canlı TV kumanda düzeni

- Kanal `+/−`: sonraki/önceki kanal.
- Sol: son iki kanal arasında hızlı geçiş.
- Sağ: son izlenen sekiz kanal.
- Yukarı: mevcut kanal, EPG, çözünürlük, motor, biçim ve oturum içinden ölçülebilen akış bilgilerinin bulunduğu kısa bilgi kartı.
- Aşağı: mevcut kanalın bugünkü yayın akışı.
- OK veya Geri: doğrudan oynayan kanalın bulunduğu ön izlemeli kanal ekranı.
- INFO: ayrıntılı teknik bilgi; aynı oturumdan ölçülür ve ikinci medya bağlantısı açmaz.
- Eski ara tam ekran kanal seçici ve ona ait üretim kodu kaldırıldı.

## Görüntü biçimi

- Sıra: Otomatik, 16:9, 21:9, 4:3, 4:3→16:9 Yakınlaştır, 21:9→16:9 Doldur.
- AU8000 AVPlay katmanının uygulayamadığı iki kırpma modu artık uygulanmış gibi kaydedilmez; kullanıcıya HTML5 motorunu kullanması açıkça bildirilir.
- AVPlay’de güvenli otomatik görüntü korunur. Motor değişimi kendiliğinden yapılmaz ve yayın kesilmez.
- Görüntü biçimi paneli açıkken Samsung Oynat/Duraklat tuşu çalışır; paneldeki seçim korunur.

## Altyazı uyumluluğu

- İçerikte altyazı parçası varsa “Altyazı görünmüyor?” uyumluluk işlemi seçim panelinin altında daima görünür.
- İşlem sürerken satır durum bilgisine dönüşür; yerleşik veya yazılımsal altyazı çalışsa da kullanıcı isterse yeniden inceleme/hazırlama yapabilir.
- Uyumluluk işlemi yalnızca açık kullanıcı seçimiyle başlar. Normal, uyumlu sunucularda kaynak indirme veya ek medya bağlantısı açılmaz.

## Üretim temizliği

- Eski Kırmızı/Mavi teşhis kısayolları kaldırıldı. Yerleşik teşhise INFO ve Ayarlar üzerinden erişilir.
- Geçici test dosyaları üretim WGT izin listesine dahil değildir.
