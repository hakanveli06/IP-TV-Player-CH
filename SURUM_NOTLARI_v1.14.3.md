# H&M Player v1.14.3 — Tam ekran AVPlay yüzeyi, maskeli ön izleme

Bu sürüm, Tizen 6.0 üzerinde küçük `setDisplayRect` ile başlayan AVPlay oturumunun ses üretmesine rağmen görüntüyü hiç oluşturmaması teşhisine göre hazırlanmıştır.

## Yeni ön izleme yöntemi

- AVPlay canlı yayın yüzeyi ön izlemede de tam ekranda `0 / 0 / 1920 / 1080` çalışır.
- Video yüzeyi küçültülmez ve ön izleme ile tam ekran arasında yeniden boyutlandırılmaz.
- Dört bağımsız, opak HTML dikdörtgeni videonun ön izleme açıklığı dışındaki bölümlerini kapatır.
- Sağ üstteki `506×180` ön izleme alanı şeffaf bırakılarak alttaki tam ekran AVPlay görüntüsü gösterilir.
- İkinci OK ile tam ekrana geçildiğinde yalnızca maskeler ve liste arayüzü kaldırılır; yayın bağlantısı ve video yüzeyi aynı kalır.
- Geri ile listeye dönüldüğünde maskeler yeniden gösterilir; yayın yeniden açılmaz.

## Temizlik

- v1.14.2'de kullanılan `Şeffaf pencere / Arayüz gizli` teşhis ayarı kaldırıldı.
- Kullanıcıya görünen normal kanal listesi ve kumanda davranışı geri getirildi.
- HTML5 motorunun çalışan küçük video dikdörtgeni korunmuştur; maskeli yöntem yalnızca canlı AVPlay ön izlemesinde kullanılır.

## Bağlantı güvenliği

- Ön izleme ve tam ekran aynı AVPlay oturumunu kullanır.
- Ek medya isteği, ikinci oynatıcı veya paralel bağlantı oluşturulmaz.
- `max_connections=1` kuralı açısından önceki tek bağlantı disiplini korunur.

## Doğrulama

- Kaynak sözdizimi, Chromium 76 uyumluluk, sürüm eşleşmesi ve tüm mevcut otomatik testler geçti.
- AVPlay geometri testi ön izleme sırasında gerçek video dikdörtgeninin tam ekran kaldığını doğruluyor.
- Dört maskenin koordinatları test edildi: üst, sol, sağ ve alt maskeler `1347 / 189 / 506 / 180` açıklığını boş bırakıyor.
- Ön izleme → tam ekran → Geri geçişinde AVPlay dikdörtgeni `1920×1080` kalıyor ve yeni yayın açılmıyor.
- Donanımsal AVPlay kompozit yüzeyi yalnız fiziksel Samsung TV'de doğrulanabilir.

## TV kontrolü

1. Ayarlar'da canlı TV oynatıcısını AVPlay seçin.
2. Bir kanalda ilk OK'ye basın; sağ üst ön izleme açıklığında görüntü ve ses bulunmalı.
3. Aynı kanalda ikinci OK ile tam ekrana geçin; yayın kesilmeden büyümeli.
4. Geri ile listeye dönün; aynı yayın küçük açıklıkta devam etmeli.
5. Başka kanal üzerinde OK'ye basıp kanal değişimini kontrol edin.
6. Sorun olursa INFO teşhisinde `Video penceresi: 0 / 0 / 1920 / 1080` ve `AVPlay on izleme: Tam ekran yuzey + maskeli pencere` satırlarını fotoğraflayın.

Temel WGT, Apps2Samsung ile hedef televizyonun sertifikası kullanılarak imzalanmalıdır.
