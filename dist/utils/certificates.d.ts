/**
 * Client certificate (TLS Client Authentication) helpers.
 * Ported from Python abrasio/utils/certificates.py
 *
 * Patchright accepts client certificates as a `clientCertificates` option on
 * context creation (`newContext` / `launchPersistentContext`), each entry shaped
 * as `{ origin, certPath|cert, keyPath|key, pfxPath|pfx, passphrase }`. This
 * module builds entries in that exact shape.
 *
 * That native mechanism only works in **local mode** (it relies on a local SOCKS
 * proxy the browser must dial back into, which requires the browser and the
 * Playwright driver to be on the same machine). For **cloud mode** (remote
 * browser), use `routeWithClientCertificate` below instead: it intercepts the
 * specific request via Playwright's `route()` API — which always executes in
 * the driver process, regardless of where the browser runs — and replays it
 * outside the browser using Node's built-in `https` module, which supports
 * client certificates (including raw PFX/PKCS12 + passphrase) natively.
 *
 * Parity note: the Python SDK's replay path uses `curl_cffi` with
 * `impersonate="chrome"` so the replayed request's TLS/HTTP fingerprint matches
 * a real Chrome instead of the host language's default fingerprint. There is no
 * verified Node equivalent wired up yet — this implementation uses Node's plain
 * `https` module (Node's own OpenSSL fingerprint). If a target's anti-fraud/WAF
 * layer is sensitive to that mismatch, this is the first thing to revisit.
 */
import type { Page, BrowserContext } from 'patchright';
import type { ClientCertificate, ProxyConfig } from '../types.js';
export interface BuildClientCertificateOptions {
    /** PEM certificate bytes. Use with `key`. */
    cert?: Buffer;
    /** Path to a PEM certificate file. Use with `keyPath`. */
    certPath?: string;
    /** PEM private key bytes. Use with `cert`. */
    key?: Buffer;
    /** Path to a PEM private key file. Use with `certPath`. */
    keyPath?: string;
    /** PFX/PKCS12 bundle bytes. */
    pfx?: Buffer;
    /** Path to a PFX/PKCS12 file. */
    pfxPath?: string;
    /** Passphrase for the private key (PEM or PFX), if encrypted. */
    passphrase?: string;
}
/**
 * Build a Patchright-compatible client certificate entry for TLS Client Auth.
 *
 * Used to authenticate with sites that require a client certificate during
 * login (e.g. ICP-Brasil certificates on gov.br). Pass the result (wrapped in
 * an array) as `clientCertificates` in `AbrasioOptions` / `AbrasioConfig`.
 *
 * @param origin Exact origin the certificate applies to, e.g. "https://sso.acesso.gov.br".
 * @throws AbrasioError if origin is missing, or neither a PEM pair nor a PFX is provided.
 */
export declare function buildClientCertificate(origin: string, options?: BuildClientCertificateOptions): ClientCertificate;
export interface RouteWithClientCertificateOptions {
    /**
     * Proxy to replay the request through (string or `{server, username, password}`).
     * Should match the browser session's proxy to keep a consistent exit IP.
     */
    proxy?: string | ProxyConfig;
    /**
     * Request timeout in milliseconds. Defaults to 30000 — too short here and a
     * timeout aborts the route, leaving the page on a failed navigation
     * (`chrome-error://chromewebdata/`).
     */
    timeoutMs?: number;
    /**
     * Extra attempts after the first one if the replay throws (connection/timeout/
     * proxy/TLS errors from a flaky proxy). Default 2 (3 attempts total). Does not
     * retry on HTTP error responses (4xx/5xx) — only on request errors, since those
     * are the ones that abort the route instead of returning a real response to the page.
     */
    retries?: number;
    /**
     * Milliseconds to wait before each retry, multiplied by the attempt number
     * (1st retry waits `retryBackoffMs`, 2nd waits `2 * retryBackoffMs`, ...). Default 1000.
     */
    retryBackoffMs?: number;
}
/**
 * Intercept `url` on `target` (a Patchright `Page` or `BrowserContext`) and replay it
 * outside the browser using the given client certificate, via Node's `https` module.
 *
 * This works in both local and cloud mode, unlike Patchright's native
 * `clientCertificates` option (local mode only) — the route handler always executes
 * in the driver process, regardless of where the browser itself runs.
 */
export declare function routeWithClientCertificate(target: Page | BrowserContext, url: string | RegExp | ((url: URL) => boolean), certificate: ClientCertificate, options?: RouteWithClientCertificateOptions): Promise<void>;
