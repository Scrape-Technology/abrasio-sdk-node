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

import * as fs from 'node:fs';
import * as https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import forge from 'node-forge';
import type { Page, BrowserContext, Route, Request as PwRequest } from 'patchright';
import type { ClientCertificate, ProxyConfig } from '../types.js';
import { AbrasioError } from '../exceptions.js';

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
export function buildClientCertificate(
    origin: string,
    options: BuildClientCertificateOptions = {},
): ClientCertificate {
    if (!origin) {
        throw new AbrasioError("buildClientCertificate requires 'origin' (e.g. 'https://example.com').");
    }

    const { cert, certPath, key, keyPath, pfx, pfxPath, passphrase } = options;
    const hasPem = Boolean(cert || certPath) && Boolean(key || keyPath);
    const hasPfx = Boolean(pfx || pfxPath);

    if (!hasPem && !hasPfx) {
        throw new AbrasioError(
            'buildClientCertificate requires either both cert/certPath and key/keyPath (PEM), ' +
            'or pfx/pfxPath (PFX/PKCS12).',
        );
    }

    const entry: ClientCertificate = { origin };
    if (cert !== undefined) entry.cert = cert;
    if (certPath !== undefined) entry.certPath = certPath;
    if (key !== undefined) entry.key = key;
    if (keyPath !== undefined) entry.keyPath = keyPath;
    if (pfx !== undefined) entry.pfx = pfx;
    if (pfxPath !== undefined) entry.pfxPath = pfxPath;
    if (passphrase !== undefined) entry.passphrase = passphrase;
    return entry;
}

interface CertMaterial {
    cert: Buffer;
    key: Buffer;
    /** Only set for a PEM key supplied directly (not via PFX, which `resolveCertMaterial` always converts to an unencrypted key). */
    passphrase?: string;
}

/**
 * Convert a PFX/PKCS12 bundle to PEM cert + key via `node-forge`.
 *
 * Node's built-in `tls`/`https` modules reject PKCS12 bundles encrypted with
 * legacy algorithms (RC2-40-CBC / 3DES — OpenSSL 1.x's old default, and still
 * common output from many CA-issued certificates, e.g. ICP-Brasil) with
 * `Unsupported PKCS12 PFX data`, since Node 18+ ships OpenSSL 3 with the
 * legacy provider disabled by default. `node-forge` parses PKCS12 in pure JS
 * and isn't affected, so PFX is always converted to PEM up front rather than
 * passed to `https.Agent` as `pfx`/`passphrase` directly.
 */
export function pfxToPem(pfxBytes: Buffer, passphrase: string | undefined): { cert: Buffer; key: Buffer } {
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBytes.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase ?? '');

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    const keyBags = (
        p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]
        ?? p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]
    );

    const certBag = certBags?.[0];
    const keyBag = keyBags?.[0];
    if (!certBag?.cert || !keyBag?.key) {
        throw new AbrasioError('Could not find a certificate and private key inside the PFX/PKCS12 bundle.');
    }

    const certPem = forge.pki.certificateToPem(certBag.cert);
    const keyPem = forge.pki.privateKeyToPem(keyBag.key);
    return { cert: Buffer.from(certPem, 'utf8'), key: Buffer.from(keyPem, 'utf8') };
}

/**
 * Resolve a `ClientCertificate` entry into raw PEM cert material ready for
 * `https.Agent`/`tls.connect` (`cert`/`key` as Buffers). PFX/PKCS12 entries
 * are converted to PEM via `pfxToPem` for broad compatibility (see its doc).
 */
function resolveCertMaterial(certificate: ClientCertificate): CertMaterial {
    if (certificate.pfx || certificate.pfxPath) {
        const pfxBytes = certificate.pfx ?? fs.readFileSync(certificate.pfxPath as string);
        const { cert, key } = pfxToPem(pfxBytes, certificate.passphrase);
        return { cert, key };
    }

    const cert = certificate.cert ?? (certificate.certPath ? fs.readFileSync(certificate.certPath) : undefined);
    const key = certificate.key ?? (certificate.keyPath ? fs.readFileSync(certificate.keyPath) : undefined);

    if (!cert || !key) {
        throw new AbrasioError(
            'resolveCertMaterial requires either certPath/cert + keyPath/key (PEM), or pfxPath/pfx (PFX/PKCS12).',
        );
    }

    return { cert, key, passphrase: certificate.passphrase };
}

/** Normalize Abrasio's proxy config (string or object) into a single proxy URL string. */
export function normalizeProxyUrl(proxy?: string | ProxyConfig): string | undefined {
    if (!proxy) return undefined;

    if (typeof proxy === 'string') {
        return proxy.includes('://') ? proxy : `http://${proxy}`;
    }

    let server = proxy.server || '';
    if (!server.includes('://')) server = `http://${server}`;

    if (proxy.username && proxy.password) {
        const [scheme, rest] = server.split('://');
        return `${scheme}://${proxy.username}:${proxy.password}@${rest}`;
    }
    return server;
}

/**
 * Build the Agent that handles connection pooling and (when a proxy is set) the
 * CONNECT tunnel. NOTE: constructor-level TLS options on `HttpsProxyAgent` only
 * apply to the hop between this client and the *proxy* — the final TLS upgrade
 * to the actual destination is driven by the per-request options instead (see
 * https-proxy-agent's `connect()`), so the client certificate must be passed on
 * the `https.request()` call itself, not here. `rejectUnauthorized` is kept here
 * too since it's irrelevant which hop it's read from.
 */
function buildAgent(proxyUrl: string | undefined): https.Agent {
    const baseOptions: https.AgentOptions = { rejectUnauthorized: true };
    return proxyUrl
        ? (new HttpsProxyAgent(proxyUrl, baseOptions) as unknown as https.Agent)
        : new https.Agent(baseOptions);
}

interface ReplayResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: Buffer;
}

function performRequest(
    method: string,
    targetUrl: string,
    headers: Record<string, string>,
    body: Buffer | null,
    agent: https.Agent,
    certMaterial: CertMaterial,
    timeoutMs: number,
): Promise<ReplayResponse> {
    return new Promise((resolve, reject) => {
        const u = new URL(targetUrl);

        const req = https.request(
            {
                hostname: u.hostname,
                port: u.port || 443,
                path: u.pathname + u.search,
                method,
                headers,
                agent,
                timeout: timeoutMs,
                // Client cert material — must live here (not just on the agent),
                // since this is what https-proxy-agent forwards to the final TLS
                // upgrade with the destination server when tunneling through a proxy.
                cert: certMaterial.cert,
                key: certMaterial.key,
                passphrase: certMaterial.passphrase,
                rejectUnauthorized: true,
                // Replay only — never follow redirects automatically, the browser
                // will see the response and decide what to do next.
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const responseHeaders: Record<string, string> = {};
                    for (const [k, v] of Object.entries(res.headers)) {
                        responseHeaders[k] = Array.isArray(v) ? v.join(', ') : (v ?? '');
                    }
                    resolve({
                        statusCode: res.statusCode ?? 0,
                        headers: responseHeaders,
                        body: Buffer.concat(chunks),
                    });
                });
            },
        );

        req.on('timeout', () => req.destroy(new Error(`Certificate replay request timed out after ${timeoutMs}ms`)));
        req.on('error', reject);

        if (body) req.write(body);
        req.end();
    });
}

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
export async function routeWithClientCertificate(
    target: Page | BrowserContext,
    url: string | RegExp | ((url: URL) => boolean),
    certificate: ClientCertificate,
    options: RouteWithClientCertificateOptions = {},
): Promise<void> {
    const { proxy, timeoutMs = 30000, retries = 2, retryBackoffMs = 1000 } = options;

    const certMaterial = resolveCertMaterial(certificate);
    const proxyUrl = normalizeProxyUrl(proxy);
    const agent = buildAgent(proxyUrl);

    await target.route(url, async (route: Route, request: PwRequest) => {
        const rawHeaders = request.headers();
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawHeaders)) {
            const lower = k.toLowerCase();
            if (lower !== 'content-length' && lower !== 'host') headers[k] = v;
        }

        let lastErr: unknown;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const resp = await performRequest(
                    request.method(),
                    request.url(),
                    headers,
                    request.postDataBuffer(),
                    agent,
                    certMaterial,
                    timeoutMs,
                );
                await route.fulfill({
                    status: resp.statusCode,
                    headers: resp.headers,
                    body: resp.body,
                });
                return;
            } catch (e) {
                lastErr = e;
                if (attempt < retries) {
                    const wait = retryBackoffMs * (attempt + 1);
                    console.warn(
                        `[abrasio] Certificate route replay attempt ${attempt + 1}/${retries + 1} failed for ` +
                        `${request.url()}: ${String(e)}. Retrying in ${wait}ms.`,
                    );
                    await new Promise((r) => setTimeout(r, wait));
                }
            }
        }

        console.error(
            `[abrasio] Certificate route replay failed for ${request.url()} after ${retries + 1} attempt(s):`,
            lastErr,
        );
        // Fulfill with 502 instead of aborting — route.abort() causes the browser
        // to navigate to chrome-error://chromewebdata/, which is indistinguishable
        // from a real navigation and breaks URL-based error detection in callers.
        // A 502 response keeps the page on a normal HTTP error that callers can handle.
        await route.fulfill({
            status: 502,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
            body: `[abrasio] Certificate route replay failed after ${retries + 1} attempt(s): ${String(lastErr)}`,
        });
    });
}
