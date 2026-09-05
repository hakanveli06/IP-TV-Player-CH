# H&M Player v1.13.0 — ön izleme ve deneysel uyumluluk

## Kurulum

`HM_Player_v1.13.0_Temel.wgt` temel/imzasız pakettir. Apps2Samsung ile hedef TV için imzalayıp kurun. Uygulama kimliği korunmuştur; H&M Player'ın önceki sürümünü günceller. Başka bir uygulama kimliği kullanılmadı. Önceki v1.12.0 paketleri geri dönüş için korundu. Yeni sürüm gerçek Samsung cihazında henüz test edilmedi.

## Canlı TV ön izlemesi

- Kanal listesinde ilk OK: sağdaki küçük pencerede oynatır.
- Yukarı/aşağı ile gezinmek yayını değiştirmez. Sağ altta listede seçili kanalın EPG'si, pencerenin altında oynayan kanalın adı/programı ayrı gösterilir.
- Farklı kanalda OK: önce eski oynatıcı kapanır, 250 ms bekleme sonrası yeni kanal küçük pencerede açılır. Aynı anda ikinci video oynatıcısı açılmaz.
- Oynayan kanalda ikinci OK: mevcut yayın yeniden yüklenmeden tam ekran olur.
- Tam ekranda Geri veya OK: mevcut yayın küçük pencereye döner. Listede Geri: kategorilere odaklanır.
- Başka ana menüye geçmek veya Stop: ön izlemeyi kapatır.
- AVPlay için video dikdörtgeni, HTML5 için video öğesinin konumu/boyutu değiştirilir. Samsung donanım katmanının küçük pencere davranışı cihazda ayrıca doğrulanmalıdır.

## Deneysel MP4 uyumluluk modu — kesin çözüm değildir

Sugar yerel testlerinde 32 toplam parça açıldı; 33 parçalı kontrollü ses/altyazı çoğaltmaları açılmadı. Bu nedenle fazla parçaları TV ayrıştırıcısına vermeyen ayrı bir MSE denemesi eklendi.

1. Film veya diziyi normal şekilde açın. Normal AVPlay/HTML5 davranışı ve çalışan kaynakların altyazı yolu değişmedi.
2. Oynatma hata ekranında **OK**, deneysel MP4 yolunu açıkça seçer.
3. Eski medya oynatıcısı ve altyazı istekleri kapatılır; 650 ms sonra MP4 Range okuyucusu başlar.
4. Uygulama içindeki MP4Box.js, video ve Türkçe varsa Türkçe/aksi halde ilk ses parçasını fMP4 parçaları halinde HTML5 MSE'ye verir. TV'ye altyazı parçaları verilmez. Video/ses yeniden kodlanmaz, harici proxy kullanılmaz.
5. Bu ilk deney **baştan başlar; sarma, ses dili değiştirme ve altyazı kapalıdır**. Deney önceki normal izleme konumunu kayıtta ezmez. Geri ile çıkılabilir.

### Bilinen sınırlamalar ve test sonucu

- Yalnızca normal MP4 hedeflenir. MKV, HLS/TS, DRM ve zaten parçalı MP4 bu deneyin kapsamında değildir.
- MSE codec desteği native AVPlay/HTML5 doğrudan URL desteğiyle aynı değildir. Desteklenmeyen codec dönüştürülmez.
- Yerel Sugar A dosyası 45 parçadan iki ayrı MSE parçasına dönüştürüldü; FFmpeg video/ses çıktılarını sonuna kadar hatasız çözdü.
- **Masaüstü Chromium 152 tarayıcı testi ses parçasını (parça 2) MSE'de reddetti. Sugar'ın bu yöntemle Samsung'da açıldığı henüz doğrulanmadı.** Modun bu sürümdeki amacı cihazdaki gerçek hata ve yetenekleri de toplamaktır; kullanıma hazır kesin bir Sugar çözümü olarak sunulmaz.
- İlk ses/Türkçe ses seçimi dışındaki ses seçenekleri korunmaz. Doğal altyazı seçimi bu deneyde yoktur; normal oynatmadaki mevcut altyazı sistemi değişmedi.
- HTTP 206 ve doğrulanabilir Content-Range gerekir. CORS/Range engeli, dosya boyutu değişmesi ve HTTP hataları açık raporlanır; bu deneyde otomatik tekrar yapılmaz.
- 512 KiB sıralı istekler, 35 saniyelik tampon bekletme, bellek/kuyruk ve başlık inceleme sınırları vardır. Büyük/uyumsuz dosyada kontrollü durabilir; tam bölüm testi yapılmadı.
- Aynı anda en fazla bir uygulama Range isteği tasarlanıp mock testte doğrulandı. Bu, sağlayıcının oturum sayma/istek sıklığı kurallarına veya ceza vermeyeceğine garanti değildir. Ayrı TV/telefon yayını test sırasında kapalı olmalıdır.

## Teşhis raporu

- VOD hata ekranında **Yukarı veya INFO**: ayrıntılı rapor.
- Oynatırken INFO teknik bilgi açar; teknik bilgi açıkken tekrar INFO ayrıntılı raporu açar.
- Canlı kanal listesinde INFO: rapor.
- **Yukarı/aşağı veya sağ/sol**: sayfalar; **Geri/OK**: kapat.
- Ayarlar başındaki **Son teşhis raporunu göster**: son kaydedilen rapor. Kayıt cihazda kalır; otomatik yükleme/harici gönderim yoktur.
- Kaynak parça sayısı, codec/dil/zaman ölçeği, MSE seçimi, HTTP durumu/aralığı, aktarılan veri, oynatıcı olayları ve son 40 hata gösterilir. Kullanıcı adı/şifre redaksiyonu korunur.
- Fotoğraf gönderirken özellikle **Kaynak toplam parça**, **MSE video/ses codec**, **Uyumluluk sonucu**, **Uyumluluk HTTP** satırlarının olduğu sayfaları alın.

## Doğrulama ve kapsam

- Mevcut 7 test grubu ve yeni ön izleme davranış testi geçti.
- Yerel MSE iki-parça üretimi ve FFmpeg decode testi geçti.
- MSE sıralı istek, EOF, 403/404'te tekrar etmeden durma ve iptal testleri geçti.
- Browser becerisiyle 1920×1080 yerel HTML5 ön izleme ve seçili/oynayan kanal ayrımı görsel olarak kontrol edildi. Samsung AVPlay doğrulaması değildir.
- Sağlayıcı üzerinde bu sürüm sırasında medya testi yapılmadı. Kullanıcının bilgisayarındaki yerel örnek kullanıldı.
- Test videoları, kimlik bilgileri, teşhis örnekleri ve yerel sunucu WGT'ye dahil edilmez.
- MP4Box.js 0.5.4 npm dağıtımı yerel olarak paketlenmiştir. BSD-3-Clause lisansı `js/MP4BOX-LICENSE.txt` içindedir. Çalışma sırasında CDN bağlantısı gerekmez.
- Daha geniş kapsamlı yeni altyazı/ses/sarma çözümü cihaz raporlarından sonra ele alınacaktır.
