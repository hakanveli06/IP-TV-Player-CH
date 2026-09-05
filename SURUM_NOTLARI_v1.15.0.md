# H&M Player v1.15.0 — Nihai TV kullanımı ve üretim temizliği

Bu sürüm Samsung AU8000 / Tizen 6.0 / Chromium 76 hedefi için hazırlanmıştır. Uygulama ve paket kimliği korunmuştur; mevcut hesaplar ve hesaba bağlı yerel veriler yükseltmede yerinde kalır.

## Canlı TV ve kumanda

- HTML5 motorunda ilk OK sağ panelde gerçek küçük ön izlemeyi açar; aynı kanalda ikinci OK kesintisiz tam ekrana geçirir.
- AVPlay donanım yüzeyi bu televizyonda gerçek küçük ölçekli görüntü vermediği için sahte/kırpılmış ön izleme kaldırıldı. Sağ panelde açıklama gösterilir ve OK kanalı doğrudan tam ekran açar.
- Tam ekran canlı yayında Sol, son iki kanal arasında geçiş yapar.
- Tam ekran canlı yayında Sağ, son sekiz benzersiz kanalı açar. Yukarı/Aşağı ile seçim, OK ile geçiş, Geri ile kapatma yapılır.
- Son kanallar listesine yalnızca başarıyla tam ekran açılan yayınlar girer; HTML5 ön izlemeleri ve açılamayan kanallar eklenmez.
- Aynı kanal seçildiğinde yayın yeniden yüklenmez. Kanal değişiminde önceki medya bağlantısı kapatılır; tek bağlantı disiplini korunur.
- Son canlı TV kategorisi ve kanal odağı aktif hesaba özel hatırlanır.
- Ayrı STOP tuşuna bağlı kullanıcı yönlendirmeleri kaldırıldı. Eski kumandalardaki MediaStop kod desteği yalnızca ikincil uyumluluk olarak kaldı.

## EPG

- Normal kanal listesinde bir kanal üzerindeyken Sağ tuş o kanalın bugünkü yayın akışını açar.
- Günlük görünüm saat ve program adını gösterir; uzun özetler arayüzü doldurmaz.
- Kanal tuşlarıyla sayfa atlanabilir, Geri ile aynı kanal listesine dönülür.
- Catch-up veya geçmiş yayın oynatma eklenmemiştir.

## Dil ve altyazı

- Ayarlara Öncelikli ses: Otomatik / Türkçe / İngilizce / Kaynak varsayılanı eklendi.
- Ayarlara Öncelikli altyazı: Kapalı / Türkçe / İngilizce / Otomatik eklendi.
- Altyazı varsayılanı Kapalı'dır; bu nedenle yeni kullanıcı içerik açarken hazırlama ekranı görmez.
- Kullanıcının dizi için daha önce seçtiği parça genel tercihten önce uygulanır. Eşleşme yoksa kaynak varsayılanı korunur.
- TX3G yazılımsal altyazı kurtarma, tek istek ve önbellek disiplini korunmuştur.

## Kategori görünürlüğü

- Canlı TV, film ve dizi kategorileri ayrı ekranlarda gösterilebilir veya gizlenebilir.
- Gizlenen kategoriler normal kategori sütunundan çıkar; içerikleri genel aramada bulunmaya devam eder.
- Tümünü göster komutu bulunur. Tüm/Favoriler gibi uygulama kategorileri gizlenmez.
- Yeni sağlayıcı kategorileri ilk gelişlerinde görünürdür. Tercihler hesap bazında tutulur.

## Favoriler

- Canlı favori kanalları Ayarlar içinden kumandayla sıralanabilir.
- OK kanalı tutar/bırakır; Yukarı/Aşağı taşır; sıra anında ve hesaba özel kaydedilir.
- Favoriler kategorisi ve Favoriler ana ekranı kaydedilmiş sırayı kullanır.

## Yardım ve teşhis

- Ayarlarda odaklanan her seçenek için sağ tarafta ne işe yaradığını ve gerektiğinde önerilen değeri açıklayan sabit yardım paneli bulunur.
- Canlı TV, VOD, ses/altyazı ve genel kullanım için Kumanda kullanım rehberi eklendi.
- INFO ile kullanılan yerleşik teşhis korunmuştur. Çözünürlük, motor, akış ve tampon bilgileri mevcut oynatıcı oturumundan okunur; ikinci medya bağlantısı açılmaz.

## Üretim temizliği

- Başarısız deneysel Sugar/MSE oynatma yolu, MP4Box yükü ve geçici AVPlay maske denemeleri üretimden kaldırıldı.
- Paketleyici açık dosya izin listesine geçirildi. Test araçları, örnek videolar, FFmpeg ve çalışma dosyaları WGT'ye eklenmez.
- WGT yalnızca config, ana HTML, logo, tek CSS ve gerekli yedi JavaScript dosyasını içerir.

Temel WGT, Apps2Samsung ile hedef televizyonun DUID'sini kapsayan sertifikayla imzalanmalıdır.
