/**
 * Main Abrasio class — unified interface for local and cloud browsers.
 * Ported from Python abrasio/_api.py
 */

import type { BrowserContext, Page } from 'patchright';
import {
    type AbrasioConfig,
    type AbrasioOptions,
    createConfig,
    isCloudMode,
    isLocalMode,
} from './types.js';
import { AbrasioError } from './exceptions.js';
import { autoConfigureRegion } from './region-defaults.js';
import type { StealthBrowser } from './local/browser.js';
import type { CloudBrowser } from './cloud/browser.js';

type BrowserImpl = StealthBrowser | CloudBrowser;

export class Abrasio {
    readonly config: AbrasioConfig;
    private _browser: BrowserImpl | null = null;

    constructor(options: AbrasioOptions = {}) {
        this.config = createConfig(options);

        // Auto-configure locale/timezone for local mode only.
        // Cloud mode: no defaults — API infers region from URL.
        if (isLocalMode(this.config)) {
            if (this.config.region && this.config.autoConfigureRegion) {
                const { locale, timezone } = autoConfigureRegion(
                    this.config.region,
                    this.config.locale,
                    this.config.timezone,
                );
                if (!this.config.locale) this.config.locale = locale;
                if (!this.config.timezone) this.config.timezone = timezone;
            }

            // Local Chrome needs a locale/timezone to launch with
            if (!this.config.locale) this.config.locale = 'en-US';
            if (!this.config.timezone) this.config.timezone = 'America/New_York';
        }
    }

    /** Check if running in cloud mode. */
    get isCloud(): boolean {
        return isCloudMode(this.config);
    }

    /** Check if running in local mode. */
    get isLocal(): boolean {
        return isLocalMode(this.config);
    }

    /** Get live view URL (cloud mode only). */
    get liveViewUrl(): string | null {
        if (this._browser && 'liveViewUrl' in this._browser) {
            return (this._browser as CloudBrowser).liveViewUrl;
        }
        return null;
    }

    /** Get the underlying browser/context object. */
    get browser(): BrowserContext {
        if (!this._browser) throw new AbrasioError('Browser not started.');
        if ('context' in this._browser) {
            return (this._browser as StealthBrowser).context;
        }
        if ('browser' in this._browser) {
            const b = (this._browser as CloudBrowser).browser;
            const contexts = b.contexts();
            if (contexts.length > 0) return contexts[0];
        }
        throw new AbrasioError('Browser object not available.');
    }

    /** Start the browser. */
    async start(): Promise<Abrasio> {
        if (isCloudMode(this.config)) {
            await this._startCloud();
        } else {
            await this._startLocal();
        }
        return this;
    }

    /** Close the browser and cleanup resources. */
    async close(): Promise<void> {
        if (this._browser) {
            try {
                await this._browser.close();
            } finally {
                this._browser = null;
            }
        }
    }

    /** Create a new page. */
    async newPage(): Promise<Page> {
        if (!this._browser) {
            throw new AbrasioError("Browser not started. Call start() first.");
        }
        return await this._browser.newPage();
    }

    /** Create a new browser context. */
    async newContext(options?: Record<string, unknown>): Promise<BrowserContext> {
        if (!this._browser) {
            throw new AbrasioError("Browser not started. Call start() first.");
        }
        return await this._browser.newContext(options);
    }

    private async _startLocal(): Promise<void> {
        const { StealthBrowser } = await import('./local/browser.js');
        this._browser = new StealthBrowser(this.config);
        await this._browser.start();
    }

    private async _startCloud(): Promise<void> {
        const { CloudBrowser } = await import('./cloud/browser.js');
        this._browser = new CloudBrowser(this.config);
        await this._browser.start();
    }
}
