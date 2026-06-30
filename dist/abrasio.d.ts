/**
 * Main Abrasio class — unified interface for local and cloud browsers.
 * Ported from Python abrasio/_api.py
 */
import type { BrowserContext, Page } from 'patchright';
import { type AbrasioConfig, type AbrasioOptions, type ClientCertificate, type ProxyConfig } from './types.js';
export declare class Abrasio {
    readonly config: AbrasioConfig;
    private _browser;
    constructor(options?: AbrasioOptions);
    /** Check if running in cloud mode. */
    get isCloud(): boolean;
    /** Check if running in local mode. */
    get isLocal(): boolean;
    /** Get live view URL (cloud mode only). */
    get liveViewUrl(): string | null;
    /** Get the underlying browser/context object. */
    get browser(): BrowserContext;
    /** Start the browser. */
    start(): Promise<Abrasio>;
    /** Close the browser and cleanup resources. */
    close(): Promise<void>;
    /** Create a new page. */
    newPage(): Promise<Page>;
    /** Create a new browser context. */
    newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
    private _startLocal;
    private _startCloud;
    /**
     * Intercept `url` on `target` (a Page or BrowserContext) and replay it outside
     * the browser using a TLS client certificate, via Node's `https` module.
     *
     * Use this for sites requiring client-cert auth (e.g. ICP-Brasil logins on
     * gov.br). Unlike `clientCertificates` in `AbrasioConfig` (local mode only),
     * this works in both local and cloud mode, since the interception always runs
     * in the driver process regardless of where the browser itself runs.
     *
     * @param target Page or BrowserContext to intercept requests on.
     * @param url URL/glob pattern to intercept, as accepted by Playwright's `route()`.
     * @param certificate A `ClientCertificate` built with `buildClientCertificate(...)`.
     * @param options.proxy Proxy to replay the request through. Defaults to the
     *   session's configured proxy, to keep a consistent exit IP with the rest of
     *   the browser session.
     * @param options.timeoutMs Request timeout in milliseconds. Defaults to the
     *   session's configured `timeout`. Raise this if the replayed request times
     *   out when going through a slow proxy — a timeout here aborts the route and
     *   leaves the page on a failed navigation (`chrome-error://chromewebdata/`).
     * @param options.retries Extra attempts after the first one if the replay
     *   throws (e.g. a flaky proxy). Default 2 (3 attempts total) before aborting
     *   the route.
     * @param options.retryBackoffMs Milliseconds to wait before each retry,
     *   multiplied by the attempt number. Default 1000.
     */
    routeWithCertificate(target: Page | BrowserContext, url: string | RegExp | ((url: URL) => boolean), certificate: ClientCertificate, options?: {
        proxy?: string | ProxyConfig;
        timeoutMs?: number;
        retries?: number;
        retryBackoffMs?: number;
    }): Promise<void>;
}
