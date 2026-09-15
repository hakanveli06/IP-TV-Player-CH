# H&M Player v1.17.1 ara test

Bu sürüm, 2019 Samsung Q60R gibi eski Tizen cihazlarda AVPlay ön izlemesinden tam ekrana geçerken görüntünün küçük kalmasını teşhis etmek ve gidermek için hazırlanmıştır.

- Ayarlar bölümüne **Eski Samsung AVPlay uyumluluğu** eklendi.
- Otomatik mod Tizen 5.0 ve daha eski sürümlerde kesintisiz eski-TV yerleşimini seçer.
- Standart, Eski TV - Kesintisiz, Eski TV - Güvenli ve Eski TV - Yeniden hazırla yöntemleri aynı pakette denenebilir.
- Yeni televizyonlarda v1.17.0 yerleşim davranışı korunur.
- INFO teşhisine algılanan Tizen sürümü, seçilen/çözülen yöntem, DOM alanı, istenen AVPlay alanı ve geçiş aşaması eklendi.
- Yeniden hazırlama yöntemi önce mevcut oturumu kapatır, ardından kısa güvenlik aralığıyla aynı yayını açar; eşzamanlı ikinci bağlantı oluşturmaz.
