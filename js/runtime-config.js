/* Public v2 calisma ayarlari. Bu dosya yalnizca gizli olmayan adresleri
   icerir; TMDb kimlik bilgisi Cloudflare Worker secret olarak tutulur. */
window.HM_RUNTIME = window.HM_RUNTIME || {
  tmdbProxyBase: 'https://hm-player-tmdb-proxy.hakanveli.workers.dev/tmdb/3',
  buildChannel: 'public-v2'
};
