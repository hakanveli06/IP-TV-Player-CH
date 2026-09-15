# H&M Player v1.18.0

Bu sürüm, doğrulanan eski Samsung AVPlay uyumluluğunu üretim biçimine getirir ve film/dizi ayrıntılarına isteğe bağlı TMDb bilgileri ekler.

## TMDb puanları ve ayrıntıları

- Film ve dizi ayrıntı sayfasına **Puanlar ve ayrıntılar** düğmesi eklendi.
- Bilgiler yalnızca bu düğmeye basıldığında alınır; içerik sayfasını ve sezon/bölüm yerleşimini sıkıştırmayan büyük bir pencere kullanılır.
- TMDb puanı, oy sayısı, orijinal ad, yıl, tür, süre veya sezon sayısı, yaş derecesi, yönetmen/yaratıcı, oyuncular ve kısa özet gösterilir.
- Türkçe özet sırası: TMDb Türkçe özet, sağlayıcının Türkçe özeti, etiketli TMDb İngilizce özeti.
- Sağlayıcı puanı varsa TMDb puanından ayrı ve açık kaynak adıyla gösterilir.
- Filmlerde geçerli sağlayıcı TMDb kimliği önceliklidir. Dizilerde kimlik yoksa temizlenmiş ad, yıl ve içerik türüyle güven puanlı arama yapılır.
- Belirsiz eşleşmede en fazla üç aday kumandayla seçilebilir; sistem emin değilse yanlış bilgiyi otomatik göstermez.
- Başarılı sonuçlar 30 gün, sonuçsuz aramalar 24 saat tutulur. Önbellek 180 kayıtla sınırlı ve en az kullanılan kayıtları temizleyen yapıdadır.
- IPTV medya bağlantısına dokunulmaz; TMDb HTTPS isteği `max_connections=1` sınırından bağımsızdır.
- Hakkında sayfasına resmî TMDb logosu ve gerekli kaynak bildirimi eklendi.

## Samsung AVPlay uyumluluğu

- Ara testteki beş seçenek üç anlaşılır üretim seçeneğine indirildi: **Otomatik**, **Eski TV modu: Açık**, **Eski TV modu: Kapalı**.
- Otomatik mod Tizen 5.0 ve daha eski cihazlarda Q60R üzerinde doğrulanan eşzamanlı AVPlay/DOM alan değişimini kullanır.
- Yeni veya Tizen sürümü algılanamayan cihazlarda standart ve daha önce doğrulanmış davranış korunur.
- Ara sürümdeki duraklatma ve yeniden bağlantı deneyleri üretim oynatıcısından kaldırıldı; mevcut yayın kesintisiz ön izlemeden tam ekrana taşınır.
- Eski deneysel ayarlardan biri kayıtlıysa güncellemede güvenli biçimde **Eski TV modu: Açık** değerine taşınır.

## Güvenlik ve paketleme

- TMDb jetonu Git tarafından yok sayılan `.private/tmdb-token.txt` dosyasından yalnızca `--share` aile paketi hazırlanırken okunur.
- Takip edilen `js/private-config.js` dosyası boş bir geliştirme yer tutucusudur; gerçek jeton kaynak kodda, URL'de veya teşhis çıktısında bulunmaz.
- `dist/` altındaki arşiv WGT'si jetonsuz ve Git için güvenlidir. Kök dizinde, Git tarafından yok sayılan aile WGT/ZIP'i jetonu kendi içinde taşır.
- Geniş çaplı dağıtımdan önce anahtar yönetimi bir ara sunucuya alınmalıdır.
