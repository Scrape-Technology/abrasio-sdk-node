/**
 * Main Abrasio class — unified interface for local and cloud browsers.
 * Ported from Python abrasio/_api.py
 */
import { createConfig, isCloudMode, isLocalMode, } from './types.js';
import { AbrasioError } from './exceptions.js';
import { autoConfigureRegion } from './region-defaults.js';
export class Abrasio {
    config;
    _browser = null;
    constructor(options = {}) {
        this.config = createConfig(options);
        // Auto-configure locale/timezone for local mode only.
        // Cloud mode: no defaults — API infers region from URL.
        if (isLocalMode(this.config)) {
            if (this.config.region && this.config.autoConfigureRegion) {
                const { locale, timezone } = autoConfigureRegion(this.config.region, this.config.locale, this.config.timezone);
                if (!this.config.locale)
                    this.config.locale = locale;
                if (!this.config.timezone)
                    this.config.timezone = timezone;
            }
            // Local Chrome needs a locale/timezone to launch with
            if (!this.config.locale)
                this.config.locale = 'en-US';
            if (!this.config.timezone)
                this.config.timezone = 'America/New_York';
        }
    }
    /** Check if running in cloud mode. */
    get isCloud() {
        return isCloudMode(this.config);
    }
    /** Check if running in local mode. */
    get isLocal() {
        return isLocalMode(this.config);
    }
    /** Get live view URL (cloud mode only). */
    get liveViewUrl() {
        if (this._browser && 'liveViewUrl' in this._browser) {
            return this._browser.liveViewUrl;
        }
        return null;
    }
    /** Get the underlying browser/context object. */
    get browser() {
        if (!this._browser)
            throw new AbrasioError('Browser not started.');
        if ('context' in this._browser) {
            return this._browser.context;
        }
        if ('browser' in this._browser) {
            const b = this._browser.browser;
            const contexts = b.contexts();
            if (contexts.length > 0)
                return contexts[0];
        }
        throw new AbrasioError('Browser object not available.');
    }
    /** Start the browser. */
    async start() {
        if (isCloudMode(this.config)) {
            await this._startCloud();
        }
        else {
            await this._startLocal();
        }
        return this;
    }
    /** Close the browser and cleanup resources. */
    async close() {
        if (this._browser) {
            try {
                await this._browser.close();
            }
            finally {
                this._browser = null;
            }
        }
    }
    /** Create a new page. */
    async newPage() {
        if (!this._browser) {
            throw new AbrasioError("Browser not started. Call start() first.");
        }
        return await this._browser.newPage();
    }
    /** Create a new browser context. */
    async newContext(options) {
        if (!this._browser) {
            throw new AbrasioError("Browser not started. Call start() first.");
        }
        return await this._browser.newContext(options);
    }
    async _startLocal() {
        const { StealthBrowser } = await import('./local/browser.js');
        this._browser = new StealthBrowser(this.config);
        await this._browser.start();
    }
    async _startCloud() {
        const { CloudBrowser } = await import('./cloud/browser.js');
        this._browser = new CloudBrowser(this.config);
        await this._browser.start();
    }
}
