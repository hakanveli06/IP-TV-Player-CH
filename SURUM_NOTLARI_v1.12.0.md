# H&M Player v1.12.0 — Altyazı kararlılığı

Bu sürüm altyazı hazırlama, hata sonrası devam ve metin gösterimini iyileştirir.
Canlı TV küçük ön izleme özelliği bu pakette yoktur; sonraki sürüm kapsamındadır.

## Değişiklikler

- Range 404 yanıtında kısa bekleme sonrası asıl medya adresi üzerinden bir kontrollü yenileme denenir. Daha önce okunmuş MP4 indeksinin boyutu ve tam indeks parmak izi karşılaştırılır; farklı dosyanın altyazı konumları karıştırılmaz.
- Geçici ağ/5xx hatası için başarısız istek bir kez tekrarlanır. Bir hazırlamada en fazla dört toparlanma girişimi yapılır. 401/403/410/416/429 yanıtları otomatik tekrar edilmez.
- İndirilemeyen parçalar artık sessizce atlanıp eksik altyazı tamamlandı sayılmaz.
- Aynı uygulama oturumunda son dört incelenen içerik için tamamlanan parçalar tutulur. Yarım hazırlık en fazla 10 dakika saklanır; yeniden denemede kaynak doğrulanarak kaldığı parçadan devam edilir. TV/uygulama yeniden başlatılırsa yarım hazırlık korunmaz.
- Başarısızlıkta yüzde sıfırlanmaz. Adres yenileme ve kaynak doğrulama aşamaları görünür. Hata ekranında Yukarı yeniden dener, OK altyazısız başlatır, Geri iptal eder. Kalıcı hatadan sonra bekleme uygulanır: 404 için 60 sn, diğer indirme hataları için en az 30 sn; 403/429 için en az 10 dakika ve varsa daha uzun Retry-After.
- Yakın altyazı parçaları, en az ek veri gerektiren birleşimler öncelikli olacak şekilde gruplanır. Ağ ölçümü yavaş bağlantıda birleşim aralığını daraltır. Grup başına en fazla 512 KiB; altyazı başına birleşim boşluklarından en fazla 8 MiB ek veri indirilir. MP4 indeks okumaları bu bütçeden ayrıdır.
- Tüm Range çağrıları tek kuyruktadır. İptal/oynatmadan çıkış devam eden isteği keser; bekleyen eski işlemler yeni istek başlatamaz. Oynatıcı altyazı hazırlığı boyunca kapalı kalır.
- Eski sürümlerin eksik olabilecek altyazı önbellekleri yeni imza ile geçersiz sayılır. İlk seçişte bir kere yeniden hazırlık gerekebilir; yeni tamamlanmış önbellek tekrar ağ isteği olmadan kullanılabilir.
- Çakışan zaman aralıkları olan altyazılarda metin kaybolması ve sarma sonrasında metnin yeniden seçilmesi düzeltildi. Hazırlık sırasında kapanan oynatıcıdan gelen geç ready/subtitle olayları dikkate alınmaz.
- VOD altyazısız başlar. Uyumlu kaynaklarda mevcut yerleşik altyazı yolu korunur; açılışta kendiliğinden kaynak inceleme/indirme yapılmaz.
- Teşhis kaydı yalnızca sunucu origin'i, HTTP durumu, byte aralığı ve süre içerir; URL yolu, sorgu, kullanıcı ve parola kaydedilmez.

## Gerçek sağlayıcı testleri — 5 Eylül 2026

Kullanıcı diğer cihazlarda hesabı kapattığını bildirdikten sonra Windows üzerinden sıralı HTTP testleri yapıldı. Gerçek Tizen cihazının oynatıcı ekranı bu testlerle doğrulanmış sayılmaz.

| İçerik | İlk toparlanma testi | Son gruplama testi | Tamamlanan metin |
|---|---|---|---|
| Pluribus S01E03, ilk Türkçe parça | 108 sn; %57 / 59. sn'de 404, toparlandı | 86 sn; 341 indirme grubu | 413 |
| Pluribus S01E08, ilk Türkçe parça | 124 sn; hata yok | 120 sn; 387 grup, başlangıçta ve %47'de 404, ikisi de toparlandı | 462 |

- Dört hazırlama da tamamlandı; üç gerçek 404 olayı kontrollü yenilemeyle aşıldı.
- İlk gruplama planı S01E03 için 409, S01E08 için 458 grup gerektiriyordu. Son planda yaklaşık %16 daha az grup var. Toplam HTTP sayısı yönlendirme ve indeks doğrulamalarını da içerir.
- Son testte S01E03 toplam yaklaşık 10,5 MB, S01E08 yaklaşık 14,9 MB veri aldı. S01E08'de iki yeniden indeks doğrulaması da bu toplama dahildir. Daha az istek, sınırlı miktarda daha fazla veri indirme karşılığında elde edilir.
- Test edilen dosyalardaki TX3G zaman ölçeği 90000; sıfır değil. Daha eski içerikler hakkında yapılan timescale=0 iddiası bu dosyalara genellenemez.
- 404'ten sonra asıl adresten aynı dosyanın doğrulanıp okunabilmesi gözlendi. Hatanın sağlayıcı tarafındaki kesin sebebi (adres ömrü, yönlendirme veya düğüm davranışı) henüz bilinmiyor.
- İstemcide eşzamanlı istek tepe değeri 1 idi. Bu ölçüm sağlayıcının tüm bağlantı/istek politikaları için bir garanti değildir.
- Süreler ağ koşullarına ve içerik yapısına bağlıdır; TV'de aynı süre ya da her içerikte sorunsuzluk garantisi verilmez.

## Yerel doğrulama

`node tools/verify.js` uygulama JavaScript sözdizimini, mevcut Chromium 76 uyumluluk kontrollerini, sürüm tutarlılığını ve yedi test grubunu çalıştırır; ardından WGT üretir.

Testler: ayarlar/hesaplar, yerleşik altyazı açılışı, 404 yenileme, değişen dosya, eksik Range yanıtı, 403/429'da durma, yarım hazırlıktan devam, tek istek kuyruğu, beklerken/indirirken iptal, önbellek, AVPlay/HTML5 ortak metin çizicisi, çakışan cue'lar, ileri/geri sarma, hata yüzdesi ve kumanda eylemleri.

## Paket ve TV kontrolü

`HM_Player_v1.12.0_Temel.wgt` temel (imzasız) pakettir. Mevcut uygulama kimliği korunur. Hedef TV'ye uygun sertifikayla imzalama kurulum aracındaki mevcut akışla yapılmalıdır. Paylaşım ZIP'i aynı WGT'nin kopyasını içerir; önceki sürüm dosyaları korunur.

TV'de Pluribus S01E03/S01E08 için Türkçe altyazıyı hem AVPlay hem HTML5 ile seçin; ilk metnin görünmesini, ileri/geri sarınca zamanlamayı ve ikinci seçişte önbellek kullanımını kontrol edin. İndirme yüzdesinin tamamlanması tek başına fiziksel TV'de görüntü doğrulaması değildir.

## Sonraki sürüm notu

Canlı TV: ilk OK sağda sesli küçük ön izleme; oynayan kanalda ikinci OK kesintisiz tam ekran; Geri aynı listeye dönüş. Üstte oynayan kanal, altta odaktaki kanalın EPG'si. Yalnızca gezinmek kanal değiştirmeyecek ve ikinci medya bağlantısı açılmayacak.
