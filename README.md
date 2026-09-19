# IP TV Player CH — v2

Samsung Tizen televizyonlar için geliştirilen IPTV oynatıcısının herkese açık v2 sürümü.

Bu depo v2 ile birlikte sıfırdan başlatılmıştır. Önceki özel Family sürümünün Git geçmişi ve gizli yapılandırmaları bu depoya taşınmamıştır.

## Durum

v2 geliştirmesi başlamıştır. İlk hedef, çalışan v1.32.2 tabanındaki özellikleri koruyarak TMDb entegrasyonunu herkese açık dağıtıma uygun ve kaynak kodda gizli anahtar bulunmayacak şekilde yeniden kurmaktır.

## Güvenlik ilkesi

- TMDb veya başka bir hizmete ait gizli anahtarlar uygulama kaynaklarına, WGT paketine ya da Git geçmişine eklenmez.
- Yerel geliştirme sırları Git tarafından izlenmeyen dosyalarda tutulur.
- Her Public sürüm, yayımlanmadan önce anahtar ve hassas bilgi denetiminden geçirilir.

## Sürüm çizgisi

- `v2.x`: Bu Public depoda geliştirilen ve yayımlanan sürümler
- `v1.32.2`: Özel Family sürümünün tamamlanmış son sürümü; bu deponun geçmişine dahil değildir

Kaynak kod ve kurulum belgeleri v2 altyapısı hazırlanırken bu depoya eklenecektir.
