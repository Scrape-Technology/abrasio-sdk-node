/**
 * Stealth HTTP client with TLS fingerprinting.
 * Ported from Python abrasio/http/client.py (StealthClient).
 *
 * Makes browser-like HTTP requests **without launching a browser** — matching a
 * real browser at the TLS/HTTP layer:
 *   - TLS fingerprint (JA3/JA4)
 *   - HTTP/2 SETTINGS frame + pseudo-header order
 *   - Cipher suite ordering
 *   - Default header order
 *
 * Why this exists (and why plain `fetch`/`https` won't do):
 *   Many anti-bot / WAF systems fingerprint the TLS ClientHello. Node's built-in
 *   TLS stack (OpenSSL) produces a fingerprint that no real browser emits, so a
 *   bare `fetch()` is trivially flagged (e.g. an immediate 403 from WAF-protected
 *   sites) regardless of how carefully you set headers. This client instead drives
 *   `curl-impersonate` (via the `impers` package — the Node analog of Python's
 *   `curl_cffi`), which reproduces a genuine browser fingerprint.
 *
 * Backend dependency (tradeoff, be aware):
 *   TLS-fingerprint spoofing is impossible with Node's built-in modules alone, so
 *   this requires the optional `impers` package. `impers` links `curl-impersonate`
 *   through FFI (koffi) and downloads the prebuilt `curl-impersonate` binary on
 *   first use. It's declared as an *optional* dependency: installing the SDK never
 *   fails if it can't be fetched, and `StealthClient` throws a clear
 *   `TLSFingerprintError` (with install instructions) only when you actually try to
 *   use it without the backend present. This mirrors Python's `abrasio[tls]` extra.
 *
 * Usage:
 *   import { StealthClient } from 'abrasio-sdk';
 *
 *   const client = new StealthClient({ region: 'BR' });
 *   try {
 *     const res = await client.get('https://example.com.br');
 *     console.log(res.statusCode, res.text.slice(0, 200));
 *   } finally {
 *     await client.close();
 *   }
 *
 *   // Or with automatic cleanup (Node 20+/TS 5.2+):
 *   await using c = new StealthClient();
 *   const res = await c.get('https://example.com');
 */
import type { ProxyConfig } from '../types.js';
import { StealthResponse } from './response.js';
/**
 * Derive an `Accept-Language` header value from a BCP-47 locale (e.g. "pt-BR" ->
 * "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"). Fixes a duplication + coverage bug found in
 * review, 2026-07-15: this used to be a hand-maintained table covering only 11 of the
 * ~40 regions in `region-defaults.ts`'s `REGION_CONFIG` — every other supported region
 * (MX, AU, CA, RU, ...) silently fell back to `en-US`, which is itself a fingerprint
 * mismatch (a browser genuinely configured for pt-BR does not send an English
 * Accept-Language). Deriving from the single source of region data in
 * `region-defaults.ts` covers every supported region and removes the second,
 * driftable copy of the same information.
 */
export declare function acceptLanguageForLocale(locale: string): string;
export interface StealthClientOptions {
    /** Browser to impersonate (affects the TLS/HTTP fingerprint). Default: chrome120. */
    impersonate?: string;
    /** Request timeout in **milliseconds** (Node convention). Default: 30000. */
    timeout?: number;
    /** Proxy — URL string "http://user:pass@host:port" or a `{ server, username, password }` object. */
    proxy?: string | ProxyConfig;
    /** Default headers merged into every request. */
    headers?: Record<string, string>;
    /** Default cookies sent with every request. */
    cookies?: Record<string, string>;
    /** Region used to auto-set `Accept-Language` (e.g. "BR" -> pt-BR). */
    region?: string;
    /** Rotate the impersonated Chrome version on each request. Default: false. */
    rotateImpersonation?: boolean;
    /** Verify TLS certificates. Default: true. */
    verify?: boolean;
}
export interface StealthRequestOptions {
    /** Additional headers (merged over the client defaults). */
    headers?: Record<string, string>;
    /** URL query parameters. */
    params?: Record<string, string | number | boolean>;
    /** Request body as form data or raw content. */
    data?: Record<string, string | number | boolean> | string | Buffer;
    /** Request body as JSON (sets Content-Type automatically). */
    json?: unknown;
    /** Additional cookies (merged over the client defaults). */
    cookies?: Record<string, string>;
    /** Per-request timeout in **milliseconds** (overrides the client default). */
    timeout?: number;
    /** Follow redirects (overrides the client default of true). */
    allowRedirects?: boolean;
}
/**
 * HTTP client that spoofs a real browser's TLS/JA3 fingerprint, without a browser.
 *
 * Unlike Python's `StealthClient` (which uses `async with`), Node has no context
 * manager, so the underlying session is created lazily on the first request. Call
 * `close()` when done, or use `await using` for automatic disposal.
 */
export declare class StealthClient {
    private readonly opts;
    private _session;
    private _starting;
    private _closeEpoch;
    constructor(options?: StealthClientOptions);
    /** Explicitly initialize the underlying session. Optional — requests auto-start it. */
    start(): Promise<StealthClient>;
    private _ensureSession;
    /** Close the underlying session and release resources. Safe to call multiple times. */
    close(): Promise<void>;
    /** Enables `await using client = new StealthClient(...)` for automatic cleanup. */
    [Symbol.asyncDispose](): Promise<void>;
    /** Accept-Language for the configured region (defaults to US English). */
    private _acceptLanguage;
    /**
     * Default headers merged into every request.
     *
     * Note: unlike the Python SDK, we deliberately do NOT hand-craft
     * Sec-CH-UA / Sec-Fetch-* / Accept here. `impers`/curl-impersonate already
     * emit those in the exact order and values matching the impersonated browser
     * — reconstructing them by hand risks contradicting the chosen profile and
     * breaking header order (a fingerprint signal). We only set the region-derived
     * Accept-Language (a legitimate per-user variation) plus any caller overrides.
     */
    private _buildDefaultHeaders;
    /** Make an HTTP request. */
    request(method: string, url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make a GET request. */
    get(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make a POST request. */
    post(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make a PUT request. */
    put(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make a DELETE request. */
    delete(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make a HEAD request. */
    head(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make an OPTIONS request. */
    options(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
    /** Make a PATCH request. */
    patch(url: string, options?: StealthRequestOptions): Promise<StealthResponse>;
}
/** One-off GET with TLS fingerprinting. Creates and disposes a client internally. */
export declare function stealthGet(url: string, options?: StealthClientOptions & StealthRequestOptions): Promise<StealthResponse>;
/** One-off POST with TLS fingerprinting. Creates and disposes a client internally. */
export declare function stealthPost(url: string, options?: StealthClientOptions & StealthRequestOptions): Promise<StealthResponse>;
