# TMDb proxy Worker

This Worker keeps the shared TMDb credential outside the Samsung WGT and the
public Git history. It accepts only the TMDb routes and query parameters used
by the player.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Put a TMDb API Read Access Token in `.dev.vars`.
3. Run `npm install`, then `npm test` and `npm run dev`.

## Deployment

Authenticate Wrangler, store the token as a Cloudflare secret, then deploy:

```text
npx wrangler login
npx wrangler secret put TMDB_READ_TOKEN
npm run deploy
```

After deployment, set `tmdbProxyBase` in `js/runtime-config.js` to the Worker
URL followed by `/tmdb/3`. Never place the TMDb token in that file.
