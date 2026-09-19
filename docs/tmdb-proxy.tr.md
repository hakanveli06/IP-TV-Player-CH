# Public v2 TMDb proxy kurulumu

Public v2, ortak TMDb anahtarını Samsung uygulamasına gömmek yerine ücretsiz
Cloudflare Worker secret'ı olarak saklar.

## Gerekenler

- Ücretsiz bir Cloudflare hesabı
- TMDb API Read Access Token
- Node.js

## Yerel doğrulama

```text
cd worker
npm install
npm test
npm run check
```

Yerel istek denemesi için `.dev.vars.example` dosyasını `.dev.vars` adıyla
kopyalayın ve gerçek token'ı yalnızca bu izlenmeyen dosyaya yazın.

## İlk dağıtım

```text
cd worker
npx wrangler login
npx wrangler secret put TMDB_READ_TOKEN
npm run deploy
```

Secret değeri terminal komutuna veya `wrangler.jsonc` içine yazılmamalıdır;
Wrangler'ın açtığı gizli giriş istemine yapıştırılmalıdır.

Dağıtım tamamlandığında verilen HTTPS adresinin sonuna `/tmdb/3` ekleyin ve
`js/runtime-config.js` içindeki `tmdbProxyBase` alanına yazın. Örnek biçim:

```text
https://worker-adresi.example.workers.dev/tmdb/3
```

Bu dosyaya TMDb anahtarı değil, yalnızca herkese açık Worker adresi yazılır.

## Yayın öncesi kontrol

Proje kökünde `npm run verify` çalıştırın. Bu işlem Worker dry-run'ını, proxy
testlerini, Public kaynak taramasını ve WGT içeriğinin hassas bilgi taramasını
da kapsar.
