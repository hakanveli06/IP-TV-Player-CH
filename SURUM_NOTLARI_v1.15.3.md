# H&M Player v1.15.3 — AVPlay DAR ve ön izleme EPG düzeltmesi

## AVPlay görüntü oranı

- Xtream `get_vod_info` yanıtındaki `display_aspect_ratio` ve `sample_aspect_ratio` bilgileri oynatıcıya taşınır.
- Kare olmayan piksel kullanan videolarda yalnızca kodlanmış genişlik/yüksekliğe bakılmaz.
- `Oranı koru`, gerçek görüntü oranından ortalanmış donanımsal AVPlay alanı hesaplar.
- `16:9 doldur`, 1920×1080 alanını kullanır.
- Bu bilgi zaten film/dizi ayrıntısı alınırken geldiği için ikinci medya bağlantısı açılmaz ve `max_connections=1` korunur.

Doğrulama örneği: Mehmet hesabındaki `AMERICA IS SINKING` dosyası 1280×720 kodlu olmasına rağmen yaklaşık 2,37:1 görüntü oranındadır. `Oranı koru` için beklenen AVPlay alanı `0 / 134 / 1920 / 812`, `16:9 doldur` için `0 / 0 / 1920 / 1080` değeridir.

## Canlı TV ön izleme

- AVPlay ön izleme deliğini oluşturan maske korunur.
- Oynayan kanal ve seçili kanal EPG metinleri ayrı, opak ve maskenin üstünde bir katmana alınmıştır.

Bu paket imzasızdır; Apps2Samsung ile hedef TV için imzalanarak kurulmalıdır.
