# H&M Player v1.20.0

## Public ve Family dağıtımları

- Aynı özelliklere sahip iki açıkça adlandırılmış paket üretilir.
- `Public` paketinde gömülü TMDb anahtarı veya jetonu bulunmaz.
- `Family` paketi yerel, Git dışında tutulan TMDb jetonuyla hazır çalışacak şekilde üretilir.
- Paketleyici, yerel Family jetonunun Public WGT içine sızmadığını yazma aşamasında doğrular.

## Uygulama içi TMDb ayarı

- Ayarlar menüsüne `TMDb film ve dizi bilgileri` ekranı eklendi.
- Public kullanıcı kendi 32 karakterli TMDb API anahtarını veya API okuma erişim jetonunu girebilir.
- Anahtar kaydedilmeden önce TMDb bağlantısıyla doğrulanır.
- Anahtar göster/gizle ve kişisel anahtarı temizleme seçenekleri eklendi.
- Öncelik sırası: televizyonda girilen kişisel anahtar, Family paketine gömülü jeton, yapılandırılmamış durum.
- TMDb ayarı IPTV hesaplarından bağımsız olarak yalnızca televizyonda saklanır.

## Uyumluluk

- Oynatma, hesaplar, altyazı, ön izleme ve arama davranışları v1.19.1 ile aynıdır.
- Samsung Tizen / Chromium 76 uyumluluğu korunmuştur.
