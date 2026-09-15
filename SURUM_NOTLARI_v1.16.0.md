# H&M Player v1.16.0

## Görüntü biçimleri

- AVPlay görüntü biçimleri sağlayıcı metadata'sına bağlı kalmadan, Samsung donanım video alanına doğrudan uygulanır.
- Otomatik, 16:9, 4:3, 4:3→16:9 yakınlaştır, 21:9 sinema ve 21:9→16:9 doldur seçenekleri eklendi.
- Aynı yöntem HTML5 oynatıcıda da karşılık gelen DOM video geometrisiyle uygulanır.
- Canlı ön izleme seçilen biçimden bağımsız olarak 16:9 alanı kullanır; tam ekrana geçince tercih edilen biçim geri yüklenir.
- Canlı TV ve film/dizi için ayrı varsayılan görüntü biçimleri Ayarlar'a eklendi.

## Film ve dizi oynatıcısı

- VOD kontrol çubuğu sadeleştirildi. Kumandada zaten bulunan geri sarma, oynat/duraklat ve ileri sarma düğmeleri bardan kaldırıldı.
- Çubukta Ses ve Altyazı, Altyazı Boyutu, Görüntü Biçimi ve Oynatma Motoru seçenekleri bulunur.
- Görüntü biçimleri, yön tuşları ve OK ile kullanılan ayrı bir seçim panelinden seçilir.
- Açık film veya bölüm, Ayarlar'daki varsayılanı değiştirmeden AVPlay ile HTML5 arasında geçirilebilir.
- Motor değişiminde mevcut oynatıcı önce tamamen kapatılır, 500 ms emniyet aralığından sonra diğer motor açılır ve içerik kaldığı saniyeden devam eder. Aynı anda ikinci medya bağlantısı kurulmaz.

## Ses ve altyazı

- AVPlay'in farklı yazım biçimleriyle sunduğu dil alanları birlikte ve büyük/küçük harften bağımsız okunur.
- HTML5 veya TX3G incelemesinde öğrenilen parça dilleri içerik bazında saklanarak AVPlay'in eksik etiketlerini tamamlar.
- Yerleşik AVPlay altyazısı seçiliyse seçim tamponlama tamamlandıktan ve ilk oynatma zamanı geldikten sonra kontrollü olarak birer kez doğrulanır.
- Bu doğrulama ek medya bağlantısı ya da TX3G indirmesi başlatmaz.
- Uyumlu sunucular doğrudan yerleşik altyazı yolunu; sorunlu TX3G kaynakları yalnızca kullanıcı isterse tek bağlantılı uyumluluk yolunu kullanmaya devam eder.

## Kumanda ve güvenlik

- Çıkış ve diğer onay pencereleri gerçek iki düğmeli kumanda navigasyonuna geçirildi.
- Güvenli varsayılan olarak İptal odaklanır; dört yön tuşu seçim yapar, OK odaktaki işlemi uygular ve Geri iptal eder.
- Yerleşik teşhis korunurken geçici deneysel oynatıcı kodlarının üretim paketine girmediği yeniden doğrulandı.
