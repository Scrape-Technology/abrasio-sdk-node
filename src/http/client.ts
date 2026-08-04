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
import { TLSFingerprintError, HTTPError } from '../exceptions.js';
import { BrowserImpersonation } from './impersonation.js';
import { StealthResponse } from './response.js';
import { getRegionConfig } from '../region-defaults.js';
import { normalizeProxyUrl } from '../utils/certificates.js';

// Minimal structural typing for the optional `impers` backend — imported
// dynamically so the SDK builds and installs without it present.
interface ImpersResponseLike {
    status: number;
    url: string;
    encoding: string;
    content: Buffer;
    headers: { toObject(): Record<string, string> };
}
interface ImpersSessionLike {
    request(method: string, url: string, options?: Record<string, unknown>): Promise<ImpersResponseLike>;
    close(): Promise<void>;
}
interface ImpersModuleLike {
    Session: new (options?: Record<string, unknown>) => ImpersSessionLike;
}

let _impersPromise: Promise<ImpersModuleLike> | null = null;

/**
 * Lazily import the optional `impers` backend. Uses a non-literal specifier so
 * the TypeScript compiler does not try to resolve (or require the types of) an
 * optional dependency that may not be installed.
 */
async function loadImpers(): Promise<ImpersModuleLike> {
    if (!_impersPromise) {
        const specifier = 'impers';
        _impersPromise = import(specifier).catch((err: unknown) => {
            _impersPromise = null;
            throw new TLSFingerprintError(
                'The stealth HTTP client requires the optional "impers" package for TLS ' +
                "fingerprint spoofing (Node's built-in https/fetch cannot spoof JA3/JA4). " +
                'Install it with: npm install impers. ' +
                `Underlying error: ${String(err)}`,
            );
        }) as Promise<ImpersModuleLike>;
    }
    return _impersPromise;
}

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
export function acceptLanguageForLocale(locale: string): string {
    const lang = locale.split('-')[0];
    if (lang === 'en') return `${locale},en;q=0.9`;
    return `${locale},${lang};q=0.9,en-US;q=0.8,en;q=0.7`;
}

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
export class StealthClient {
    private readonly opts: {
        impersonate: string;
        timeout: number;
        proxy?: string | ProxyConfig;
        headers?: Record<string, string>;
        cookies?: Record<string, string>;
        region?: string;
        rotateImpersonation: boolean;
        verify: boolean;
    };
    private _session: ImpersSessionLike | null = null;
    private _starting: Promise<ImpersSessionLike> | null = null;
    // Incremented by close() so an in-flight _ensureSession() can detect it ran
    // concurrently and discard its result instead of resurrecting a closed client.
    private _closeEpoch = 0;

    constructor(options: StealthClientOptions = {}) {
        this.opts = {
            impersonate: options.impersonate ?? BrowserImpersonation.DEFAULT,
            timeout: options.timeout ?? 30000,
            proxy: options.proxy,
            headers: options.headers,
            cookies: options.cookies,
            region: options.region,
            rotateImpersonation: options.rotateImpersonation ?? false,
            verify: options.verify ?? true,
        };
    }

    /** Explicitly initialize the underlying session. Optional — requests auto-start it. */
    async start(): Promise<StealthClient> {
        await this._ensureSession();
        return this;
    }

    private async _ensureSession(): Promise<ImpersSessionLike> {
        if (this._session) return this._session;
        if (this._starting) return this._starting;

        // Bug found in review, 2026-07-15: session construction is async (loadImpers()
        // + native Session setup), so close() can run while it's still in flight. The
        // old code unconditionally did `this._session = session` when construction
        // finished, silently resurrecting a "closed" client with a live, undisposed
        // native session (the new session's own resources were never released, and a
        // later get() would reuse this leaked session instead of erroring or starting
        // fresh). Capture the close epoch and re-check it after the awaits: if close()
        // ran in the meantime, close the just-built session instead of keeping it.
        const epoch = this._closeEpoch;
        this._starting = (async () => {
            const impers = await loadImpers();
            const session = new impers.Session({
                impersonate: this.opts.impersonate,
                headers: this._buildDefaultHeaders(),
                cookies: this.opts.cookies,
                proxy: normalizeProxyUrl(this.opts.proxy),
                verify: this.opts.verify,
                timeout: this.opts.timeout / 1000, // impers uses seconds
            });
            if (epoch !== this._closeEpoch) {
                await session.close().catch(() => {});
                throw new HTTPError("StealthClient was closed while a session was starting");
            }
            this._session = session;
            this._starting = null;
            return session;
        })();

        return this._starting;
    }

    /** Close the underlying session and release resources. Safe to call multiple times. */
    async close(): Promise<void> {
        this._closeEpoch++;
        const session = this._session;
        this._session = null;
        this._starting = null;
        if (session) await session.close();
    }

    /** Enables `await using client = new StealthClient(...)` for automatic cleanup. */
    async [Symbol.asyncDispose](): Promise<void> {
        await this.close();
    }

    /** Accept-Language for the configured region (defaults to US English). */
    private _acceptLanguage(): string {
        const region = (this.opts.region || 'US').toUpperCase();
        const locale = getRegionConfig(region)?.locale ?? 'en-US';
        return acceptLanguageForLocale(locale);
    }

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
    private _buildDefaultHeaders(): Record<string, string> {
        return {
            'Accept-Language': this._acceptLanguage(),
            ...(this.opts.headers ?? {}),
        };
    }

    /** Make an HTTP request. */
    async request(method: string, url: string, options: StealthRequestOptions = {}): Promise<StealthResponse> {
        const session = await this._ensureSession();

        const impersonate = this.opts.rotateImpersonation
            ? BrowserImpersonation.randomChrome()
            : undefined; // undefined => use the session's configured impersonation

        const reqOptions: Record<string, unknown> = {
            headers: options.headers,
            params: options.params,
            data: options.data,
            json: options.json,
            cookies: options.cookies,
            allowRedirects: options.allowRedirects,
            timeout: (options.timeout ?? this.opts.timeout) / 1000, // impers uses seconds
        };
        if (impersonate) reqOptions['impersonate'] = impersonate;

        // Drop undefined keys so the backend applies its own defaults.
        for (const k of Object.keys(reqOptions)) {
            if (reqOptions[k] === undefined) delete reqOptions[k];
        }

        let res: ImpersResponseLike;
        try {
            res = await session.request(method.toUpperCase(), url, reqOptions);
        } catch (err) {
            throw new HTTPError(`Stealth request failed for ${url}: ${String(err)}`, undefined, url);
        }

        return new StealthResponse({
            statusCode: res.status,
            headers: res.headers.toObject(),
            content: res.content,
            url: res.url,
            encoding: res.encoding,
        });
    }

    /** Make a GET request. */
    get(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('GET', url, options);
    }
    /** Make a POST request. */
    post(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('POST', url, options);
    }
    /** Make a PUT request. */
    put(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('PUT', url, options);
    }
    /** Make a DELETE request. */
    delete(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('DELETE', url, options);
    }
    /** Make a HEAD request. */
    head(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('HEAD', url, options);
    }
    /** Make an OPTIONS request. */
    options(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('OPTIONS', url, options);
    }
    /** Make a PATCH request. */
    patch(url: string, options?: StealthRequestOptions): Promise<StealthResponse> {
        return this.request('PATCH', url, options);
    }
}

/** One-off GET with TLS fingerprinting. Creates and disposes a client internally. */
export async function stealthGet(
    url: string,
    options?: StealthClientOptions & StealthRequestOptions,
): Promise<StealthResponse> {
    const client = new StealthClient(options);
    try {
        return await client.get(url, options);
    } finally {
        await client.close();
    }
}

/** One-off POST with TLS fingerprinting. Creates and disposes a client internally. */
export async function stealthPost(
    url: string,
    options?: StealthClientOptions & StealthRequestOptions,
): Promise<StealthResponse> {
    const client = new StealthClient(options);
    try {
        return await client.post(url, options);
    } finally {
        await client.close();
    }
}
