import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerConsentOriginAllowed } from './owner-consent-origin.mjs';
const path = '/api/v1/migration/owner-link';
const origin = 'https://interplanetaryfund.com';
const www = 'https://www.interplanetaryfund.com';
const check = (method, headers = {}, url = origin + path) =>
  ownerConsentOriginAllowed(new Request(url, { method, headers }), new URL(url));

test('allows normal same-origin GET fetch without Origin header', () => {
  assert.equal(check('GET', { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors' }), true);
  assert.equal(check('GET', { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'same-origin' }, www + path), true);
});
test('allows same-origin explicit Origin GET and POST', () => {
  assert.equal(check('GET', { origin }), true);
  assert.equal(check('POST', { origin, 'sec-fetch-site': 'same-origin' }), true);
});
test('rejects absent Origin on POST even with same-origin Fetch Metadata', () => {
  assert.equal(check('POST', { 'sec-fetch-site': 'same-origin' }), false);
});
test('rejects missing origin and metadata on GET', () => {
  assert.equal(check('GET'), false);
});
test('rejects cross-site metadata, including spoofed matching Origin', () => {
  assert.equal(check('GET', { origin, 'sec-fetch-site': 'cross-site' }), false);
  assert.equal(check('POST', { origin, 'sec-fetch-site': 'cross-site' }), false);
});
test('rejects cross-origin, insecure and unapproved hosts', () => {
  assert.equal(check('GET', { origin: 'https://evil.example' }), false);
  assert.equal(check('POST', { origin: www }), false);
  assert.equal(check('GET', { origin: 'http://interplanetaryfund.com' }, 'http://interplanetaryfund.com' + path), false);
  assert.equal(check('GET', { origin: 'https://other.example' }, 'https://other.example' + path), false);
});
test('rejects navigations without Origin to prevent unsolicited challenge cookies', () => {
  assert.equal(check('GET', { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'navigate' }), false);
});
