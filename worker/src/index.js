const TMDB_ORIGIN = 'https://api.themoviedb.org';
const API_PREFIX = '/tmdb/3';

const COMMON_PARAMS = {
  language: true,
  query: true,
  include_adult: true,
  year: true,
  first_air_date_year: true,
  append_to_response: true
};

const APPEND_VALUES = {
  credits: true,
  external_ids: true,
  release_dates: true,
  content_ratings: true
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  };
}

function json(status, payload, extraHeaders) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(), extraHeaders || {})
  });
}

function routeTtl(path) {
  if (path === '/configuration') return 86400;
  if (/^\/search\//.test(path)) return 3600;
  if (/\/watch\/providers$/.test(path)) return 21600;
  return 86400;
}

function allowedPath(path) {
  return path === '/configuration' ||
    /^\/search\/(?:movie|tv)$/.test(path) ||
    /^\/(?:movie|tv)\/\d{1,10}$/.test(path) ||
    /^\/(?:movie|tv)\/\d{1,10}\/watch\/providers$/.test(path) ||
    /^\/tv\/\d{1,10}\/season\/\d{1,4}$/.test(path);
}

function validParam(key, value, path) {
  if (!COMMON_PARAMS[key]) return false;
  if (key === 'language') return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value);
  if (key === 'query') return /^\/search\//.test(path) && value.length > 0 && value.length <= 160;
  if (key === 'include_adult') return /^\/search\//.test(path) && value === 'false';
  if (key === 'year' || key === 'first_air_date_year') return /^(?:19|20)\d{2}$/.test(value);
  if (key === 'append_to_response') {
    if (!/^\/(?:movie|tv)\/\d{1,10}$/.test(path)) return false;
    var parts = value.split(',');
    if (!parts.length || parts.length > 4) return false;
    for (var i = 0; i < parts.length; i++) if (!APPEND_VALUES[parts[i]]) return false;
    return true;
  }
  return false;
}

export function validateTmdbRequest(url) {
  if (url.pathname.indexOf(API_PREFIX) !== 0) return { error: 'unknown_route' };
  var path = url.pathname.slice(API_PREFIX.length) || '/';
  if (!allowedPath(path)) return { error: 'unsupported_tmdb_route' };

  var params = new URLSearchParams();
  var seen = {};
  var count = 0;
  for (const pair of url.searchParams.entries()) {
    var key = pair[0], value = pair[1];
    count++;
    if (count > 8 || seen[key] || !validParam(key, value, path)) return { error: 'unsupported_query_parameter' };
    seen[key] = true;
    params.set(key, value);
  }
  if (/^\/search\//.test(path) && !seen.query) return { error: 'missing_search_query' };
  return { path: path, params: params, ttl: routeTtl(path) };
}

function cacheStore() {
  try { return typeof caches !== 'undefined' ? caches.default : null; }
  catch (e) { return null; }
}

export async function handleRequest(request, env, ctx) {
  var url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== 'GET') return json(405, { error: 'method_not_allowed' }, { Allow: 'GET, OPTIONS' });
  if (url.pathname === '/health') return json(200, { ok: true, service: 'hm-player-tmdb-proxy' }, { 'Cache-Control': 'no-store' });

  var validated = validateTmdbRequest(url);
  if (validated.error) return json(validated.error === 'unknown_route' ? 404 : 400, { error: validated.error });
  if (!env || !env.TMDB_READ_TOKEN) return json(503, { error: 'service_not_configured' }, { 'Cache-Control': 'no-store' });

  var cache = cacheStore();
  var cacheKey = new Request(url.toString(), { method: 'GET' });
  if (cache) {
    var hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  var upstreamUrl = new URL('/3' + validated.path, TMDB_ORIGIN);
  validated.params.forEach(function (value, key) { upstreamUrl.searchParams.set(key, value); });

  var upstream;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + env.TMDB_READ_TOKEN
      }
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'tmdb_fetch_failed', message: String(error && error.message || error) }));
    return json(502, { error: 'upstream_unavailable' }, { 'Cache-Control': 'no-store' });
  }

  var headers = corsHeaders();
  headers['Content-Type'] = upstream.headers.get('Content-Type') || 'application/json; charset=utf-8';
  headers['Cache-Control'] = upstream.ok ? 'public, max-age=' + validated.ttl : 'no-store';
  var response = new Response(upstream.body, { status: upstream.status, headers: headers });
  if (cache && (upstream.ok || upstream.status === 404) && ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
}

export default {
  fetch: function (request, env, ctx) { return handleRequest(request, env, ctx); }
};
