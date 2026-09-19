import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, validateTmdbRequest } from '../src/index.js';

test('health endpoint never needs a secret', async () => {
  const response = await handleRequest(new Request('https://example.test/health'), {}, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'hm-player-tmdb-proxy' });
});

test('only supported routes and parameters are accepted', () => {
  assert.equal(validateTmdbRequest(new URL('https://example.test/tmdb/3/search/movie?query=Sugar&language=tr-TR&include_adult=false')).error, undefined);
  assert.equal(validateTmdbRequest(new URL('https://example.test/tmdb/3/account')).error, 'unsupported_tmdb_route');
  assert.equal(validateTmdbRequest(new URL('https://example.test/tmdb/3/search/movie?query=Sugar&api_key=secret')).error, 'unsupported_query_parameter');
  assert.equal(validateTmdbRequest(new URL('https://example.test/tmdb/3/search/movie')).error, 'missing_search_query');
});

test('proxy injects the bearer secret without exposing it in the URL', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedAuth = '';
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedAuth = init.headers.Authorization;
    return new Response('{"results":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await handleRequest(
      new Request('https://example.test/tmdb/3/search/tv?query=Pachinko&language=tr-TR&include_adult=false'),
      { TMDB_READ_TOKEN: 'worker-secret-token' },
      { waitUntil: () => {} }
    );
    assert.equal(response.status, 200);
    assert.equal(capturedAuth, 'Bearer worker-secret-token');
    assert.equal(capturedUrl.includes('worker-secret-token'), false);
    assert.equal(capturedUrl, 'https://api.themoviedb.org/3/search/tv?query=Pachinko&language=tr-TR&include_adult=false');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('missing Worker secret fails closed', async () => {
  const response = await handleRequest(new Request('https://example.test/tmdb/3/configuration'), {}, {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'service_not_configured' });
});
