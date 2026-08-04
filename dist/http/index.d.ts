/**
 * Stealth HTTP client with TLS fingerprinting (no browser required).
 * Mirrors Python's `abrasio.http` module.
 *
 * Uses `curl-impersonate` (via the optional `impers` package) to make HTTP
 * requests that reproduce a real browser at the TLS/HTTP layer:
 *   - JA3/JA4 TLS fingerprint matching
 *   - HTTP/2 SETTINGS frame + pseudo-header order
 *   - Cipher suite ordering
 *   - Default header order
 *
 * This is the "T0" fast path: bypass WAF/anti-bot TLS fingerprinting for simple
 * data extraction without paying for a full cloud browser. Node's built-in
 * `https`/`fetch` cannot do this — their TLS ClientHello matches no real browser.
 *
 * @example
 * ```ts
 * import { StealthClient } from 'abrasio-sdk';
 *
 * const client = new StealthClient({ region: 'BR' });
 * try {
 *   const res = await client.get('https://example.com.br');
 *   console.log(res.statusCode, res.text);
 * } finally {
 *   await client.close();
 * }
 * ```
 */
export { StealthClient, stealthGet, stealthPost, type StealthClientOptions, type StealthRequestOptions, } from './client.js';
export { StealthResponse, type StealthResponseInit } from './response.js';
export { BrowserImpersonation } from './impersonation.js';
