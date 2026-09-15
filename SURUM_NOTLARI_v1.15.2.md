# H&M Player v1.15.2 — AVPlay ön izleme ve gerçek görüntü geometrisi testi

## AVPlay kanal ön izlemesi

- AVPlay nesnesi DOM üzerinde daima 1920×1080 tutulur.
- Küçük ön izleme, aynı AVPlay oturumunda önce `PLAYER_DISPLAY_MODE_FULL_SCREEN`, ardından sağ paneldeki gerçek 16:9 alan için `setDisplayRect` uygulanarak oluşturulur.
- İlk OK küçük ön izlemeyi, aynı kanalda ikinci OK tam ekranı açar.
- Ön izleme ile tam ekran arasında geçerken akış kapatılıp yeniden açılmaz. Bu nedenle ikinci bağlantı kurulmaz ve `max_connections=1` kuralı korunur.
- Tamponlama tamamlandığında Tizen'in değiştirebildiği görüntü alanı tekrar uygulanır.

## AVPlay görüntü biçimi

- `Oranı koru`, kaynak videonun gerçek çözünürlüğünü okuyup 1920×1080 içine ortalanmış bir görüntü alanı hesaplar.
- `16:9 doldur`, videoyu 1920×1080 alanına ölçekler.
- `Otomatik`, AVPlay'in doğal otomatik en-boy oranı yöntemini kullanır.
- AVPlay'in yalnızca kabul edip görsel olarak uygulamadığı mod komutuna bağımlı kalınmaz; yöntem ve görüntü alanı birlikte ve doğrulanmış sırayla uygulanır.
- HTML5'in mevcut `contain` / `fill` davranışı değiştirilmemiştir.

## TV üzerinde doğrulama

1. Ayarlar → Canlı TV oynatıcısı → AVPlay seçin.
2. Kanal listesinde bir kanala OK basın. Sağ panelde ses ve görüntü birlikte gelmelidir.
3. Aynı kanalda tekrar OK ile tam ekrana geçin; yeniden bağlantı veya ikinci tamponlama olmamalıdır.
4. Geri ile aynı yayını kesmeden küçük ön izlemeye dönün.
5. Geniş sinema oranlı bir filmi AVPlay ile açın ve `Oranı koru` ile `16:9 doldur` arasında geçiş yapın.
6. Sorun olursa Info tuşundaki teşhis ekranında `AVPlay yerleşim`, `AVPlay oran komutu` ve `AVPlay alan komutu` satırlarını fotoğraflayın.

Bu paket imzasızdır; Apps2Samsung ile hedef TV için imzalanarak kurulmalıdır.
