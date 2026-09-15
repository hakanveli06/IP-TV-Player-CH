# H&M Player

[English](README.md) · [Türkçe](docs/readme/README.tr.md) · [Deutsch](docs/readme/README.de.md) · [Français](docs/readme/README.fr.md) · [Español](docs/readme/README.es.md) · [Русский](docs/readme/README.ru.md) · [Português](docs/readme/README.pt.md)

A remote-first IPTV player for Samsung Tizen TVs. H&M Player combines Live TV, movies and series with hardware AVPlay support, HTML5 fallback, channel preview, EPG, multiple accounts and optional TMDb metadata.

## Highlights

- Live TV, movies, series, favourites and recently watched
- Separate AVPlay/HTML5 engine choices for Live TV and VOD
- Two-step channel preview and seamless full-screen transition
- Daily EPG, recent-channel switching and channel history
- Audio-track and subtitle selection, including a recovery path for malformed TX3G subtitles
- Adaptive Live TV buffering and automatic reconnect
- Up to six IPTV profiles, with account-scoped favourites, history and resume data
- Category visibility controls and favourite-channel ordering
- Optional TMDb ratings, localised titles and summaries, cast photos, production details and country-specific streaming availability
- Built-in diagnostics that do not expose the IPTV password
- UI languages: Automatic, Turkish, English, German, French, Spanish, Russian and Portuguese

Provider channel/category names and EPG text are displayed as supplied by the IPTV service. TMDb text follows the selected app language, while streaming availability follows the independently selected content region.

## Compatibility

The primary target is Samsung Tizen TV at 1920×1080. The code stays compatible with the Chromium 76 generation used by Tizen 6.0 and includes an automatic AVPlay compatibility mode for older Samsung models.

Installation requires a Samsung/Tizen certificate that includes the target TV DUID. You can use Apps2Samsung or Tizen Studio to sign and install the WGT package.

## First start

The first-start assistant intentionally asks only for:

1. Interface language
2. Xtream IPTV account details

Playback-engine, buffer and TMDb choices remain in Settings so first start stays short.

## Optional TMDb integration

The Public package contains no shared TMDb secret. Users can enter their own free 32-character TMDb API key or API Read Access Token under **Settings → TMDb**. The same screen explains the benefits, how to obtain a key and how to choose the content region.

TMDb is optional, does not affect playback, is independent from the IPTV provider and does not consume an IPTV connection. See the [TMDb setup guide](docs/tmdb-setup.md).

## Build and test

Requirements: Node.js; no external npm package is required.

```powershell
npm test
npm run build
npm run verify
npm run audit:packages
npm run audit:public
```

`npm run build` creates `dist/HM_Player_vX.Y.Z_Public.wgt` without an embedded TMDb credential.

For a local Family package, put the token on one line in `.private/tmdb-token.txt` or set `HM_TMDB_TOKEN`, then run:

```powershell
npm run build:family
```

The Family WGT and convenience ZIP are created in the repository root and are ignored by the Public repository.

## Security and privacy

- IPTV credentials are entered on the TV and are not part of the source code.
- Never commit real IPTV accounts, signing certificates or raw diagnostic exports.
- A personal TMDb credential is stored locally on the TV and is not sent to the IPTV provider.
- The Public package build and repository audit reject embedded TMDb secrets and fixed IPTV credentials.

## Documentation

- [TMDb setup](docs/tmdb-setup.md)
- [Turkish README](docs/readme/README.tr.md)
- [Changelog](CHANGELOG.md)
- [v1.21.0 release notes](SURUM_NOTLARI_v1.21.0.md)

## Current version

**1.21.0**

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability data shown by TMDb is provided by JustWatch.
