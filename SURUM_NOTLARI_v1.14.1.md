# H&M Player v1.14.1

Bu sürüm, Samsung Tizen 6.0 cihazında AVPlay canlı TV ön izlemesinde ses gelirken görüntünün görünmemesi için hazırlanmış odaklı bir düzeltmedir.

## Teşhis

- Fiziksel TV raporunda AVPlay durumu `PLAYING`, oynatıcı durumu `Oynuyor` ve video penceresi `1347 / 189 / 506 / 180` olarak doğrulandı.
- Aynı yayın ikinci OK ile tam ekrana geçtiğinde görüntülü oynadı; ön izlemeye dönüldüğünde ses sürerken görüntü yeniden kayboldu.
- Bu sonuç kaynak, codec, bağlantı ve tampondan ziyade küçük AVPlay penceresinin web arayüzü altında kalmasına işaret etti.

## Değişiklikler

- AVPlay nesnesi ön izleme sırasında yalnızca `506×180` pencere sınırları içinde arayüzün üst katmanına alındı.
- Tizen 6.0 kompozitöründe geniş ve opak bir yüzey oluşturma ihtimali bulunan `3000px` yayılımlı gölge kaldırıldı.
- Sağ bilgi paneli normal koyu arka planına döndürüldü. Video nesnesi yalnızca ön izleme alanını kapladığı için EPG ve kanal bilgileri görünür kalır.
- HTML5 ön izlemesi de aynı sınırlı üst katman düzenini kullanır.
- Bağlantı açma, kanal değiştirme, tampon ve oynatıcı yaşam döngüsü değiştirilmedi. Ön izlemeden tam ekrana geçerken ikinci medya bağlantısı açılmaz.
- Sürüm `H&M.v1.14.1` olarak güncellendi; uygulama ve paket kimliği korunmuştur.

## Doğrulama

- Tüm kaynak sözdizimi, Chromium 76 uyumluluk, sürüm eşleşmesi ve mevcut işlev testleri geçti.
- Ön izleme testi, AVPlay katmanının `z-index: 11` olmasını, büyük gölge bulunmamasını ve sağ panelin gereksiz biçimde şeffaflaştırılmamasını kontrol edecek şekilde genişletildi.
- Gerçek AVPlay donanım yüzeyi yalnızca Samsung TV üzerinde görülebildiği için düzeltmenin nihai sonucu cihazda kontrol edilmelidir.

## TV kontrolü

1. Canlı TV motorunu AVPlay seçin.
2. Bir kanalda ilk OK ile sağ üst ön izleme penceresinde görüntü ve sesi kontrol edin.
3. Aynı kanalda ikinci OK ile tam ekrana geçin.
4. Geri ile listeye dönün ve küçük görüntünün sürüp sürmediğini kontrol edin.
5. Başka bir kanala geçip aynı işlemi tekrarlayın.

Paket Apps2Samsung ile hedef TV'nin sertifikası kullanılarak imzalanmalıdır.
