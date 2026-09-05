# H&M Player v1.14.0

Bu sürümün önceliği canlı TV ön izlemesidir. Sugar ve deneysel MSE uyumluluk yolu bu sürümde değiştirilmedi.

## Değişiklikler

- AVPlay donanım görüntüsünü örtebilen HTML kök zemini ve AVPlay nesnesinin siyah arka planı şeffaflaştırıldı. Ön izleme penceresinin çevresi, her iki motorda arayüzün altında koyu zeminle dolduruluyor.
- AVPlay açılırken ön izleme koordinatlarından önce uygulanan gereksiz tam ekran dikdörtgeni kaldırıldı. Pencere değişiminden 150 ms sonra koordinatlar oturum kontrollü yeniden uygulanıyor; eski oturumların gecikmiş işlemleri engelleniyor.
- Ön izleme altındaki bilgilerle pencere arasındaki boşluk artırıldı. Oynayan kanal ve listede seçili kanal bölümleri boşluk ve ayırıcı çizgiyle ayrıldı.
- Her iki kanal bölümü yalnızca kanal adı, mevcut ve sıradaki program adı ile saatlerini gösteriyor. Uzun program özetleri kaldırıldı. Program adları en fazla iki satır gösteriliyor.
- Seçili kanal değiştikten sonra eski bir EPG isteğinin hata sonucu yeni kanalın bilgilerini ezemiyor.
- İlk OK ön izleme; oynayan kanal üzerinde tekrar OK tam ekran; tam ekrandan Geri ile ön izlemeye dönüş davranışı korundu. Tam ekrana geçiş için ikinci medya bağlantısı açılmıyor.
- Uygulama, teşhis ekranı ve paket sürümü H&M.v1.14.0 olarak güncellendi. Paket/uygulama kimliği korundu.

## Doğrulama

- `node tools/verify.js`: tüm test grupları, kaynak sözdizimi kontrolleri, mevcut Chromium 76 uyumluluk taraması ve sürüm eşleşmesi geçti.
- Ön izleme testleri genişletildi: özetlerin gösterilmemesi, program başlıklarının HTML güvenliği, iki program sınırı, AVPlay dikdörtgeni ile nesne boyutlarının eşleşmesi, eski zamanlayıcının iptali ve oturum koruması.
- Yerel video ile 1920×1080 tarayıcı kontrolünde küçük pencere ve iki farklı kanalın mevcut/sıradaki programları birlikte görüntülendi. Sağlayıcı hesabına test bağlantısı açılmadı.
- Fiziksel Samsung AVPlay video katmanı masaüstü tarayıcıda doğrulanamaz. TV üzerinde sesle birlikte görüntü, tam ekran/ön izleme dönüşü ve kanal değiştirme kontrol edilmeli. Bu paket donanımda doğrulanmış kesin çözüm olarak sunulmuyor.

## Kurulum

- `HM_Player_v1.14.0_Temel.wgt`: imzasız temel paket.
- `HM_Player_v1.14.0_Paylasim.zip`: aynı temel WGT'nin ZIP kopyası.
- Apps2Samsung ile hedef TV'ye uygun sertifikayla imzalanarak kurulmalıdır. Önceki sürüm paketleri geri dönüş için korunmuştur.

## TV kontrol sırası

1. Canlı TV motorunu AVPlay seçin. Bir kanal üzerinde OK ile küçük pencerede hem görüntü hem sesi kontrol edin.
2. Başka kanala yalnızca yön tuşuyla odaklanın: oynayan kanal değişmeden seçili kanalın yayın akışı değişmeli.
3. Oynayan kanalın üzerinde OK ile tam ekrana geçin; Geri ile ön izlemeye dönün. Yayın yeniden açılmamalı.
4. Başka kanal üzerinde OK ile yeni kanalı ön izleyin. HTML5 motoruyla da aynı akışı kontrol edin.
