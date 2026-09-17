/**
 * Cloud browser implementation using Abrasio API with Patchright.
 * Ported from Python abrasio/cloud/browser.py
 */
import { chromium } from 'patchright';
import { SessionError } from '../exceptions.js';
import { AbrasioAPIClient } from './api-client.js';
export class CloudBrowser {
    config;
    _apiClient = null;
    _browser = null;
    _sessionId = null;
    _wsEndpoint = null;
    _liveViewUrl = null;
    // Contexts already given block_resources' route() — a cloud session's
    // context is created lazily (see newPage/newContext), not necessarily
    // during start(), so this must be applied wherever a context first comes
    // into existence, exactly once per context (a WeakSet avoids leaking a
    // reference once the context is closed).
    _resourceBlockedContexts = new WeakSet();
    constructor(config) {
        this.config = config;
    }
    async _applyResourceBlockingOnce(context) {
        if (!this.config.blockResources || this._resourceBlockedContexts.has(context))
            return;
        this._resourceBlockedContexts.add(context);
        const { applyResourceBlocking } = await import('../resource-blocking.js');
        await applyResourceBlocking(context, this.config.blockResources);
    }
    get browser() {
        if (!this._browser)
            throw new Error('Browser not connected');
        return this._browser;
    }
    get sessionId() {
        return this._sessionId;
    }
    get liveViewUrl() {
        return this._liveViewUrl;
    }
    async start() {
        this._apiClient = new AbrasioAPIClient(this.config);
        try {
            // Create session
            const sessionData = await this._apiClient.createSession({
                url: this.config.url,
                region: this.config.region,
                profileId: this.config.profileId,
                device: this.config.device,
                mobileModel: this.config.mobileModel,
                proxy: this.config.proxy, // Override profile's stored proxy (if provided)
                hard: this.config.hard,
            });
            this._sessionId = sessionData['id'];
            if (!this._sessionId) {
                throw new SessionError('No session ID returned from API');
            }
            // Wait for session to be ready
            const session = await this._apiClient.waitForReady(this._sessionId, 60);
            this._wsEndpoint = session['ws_endpoint'];
            if (!this._wsEndpoint) {
                throw new SessionError('No WebSocket endpoint returned', this._sessionId);
            }
            // Live view URL
            const liveViewUrl = session['live_view_url'];
            if (liveViewUrl) {
                this._liveViewUrl = liveViewUrl;
                console.log(`\n[Abrasio] Live View: ${liveViewUrl}\n`);
            }
            // Connect via Patchright CDP
            this._browser = await chromium.connectOverCDP(this._wsEndpoint);
            const contexts = this._browser.contexts();
            // Humanize all page interactions if requested
            if (this.config.humanize && contexts.length > 0) {
                const { humanizeContext } = await import('../utils/human.js');
                await humanizeContext(contexts[0], {
                    headless: this.config.headless,
                    speedFactor: this.config.humanizeSpeed,
                });
            }
            if (contexts.length > 0) {
                await this._applyResourceBlockingOnce(contexts[0]);
            }
        }
        catch (e) {
            await this.close();
            throw e;
        }
    }
    async close() {
        // 1. Signal worker to stop BEFORE dropping the CDP connection.
        //    This ensures the worker receives FINISHING while the connection
        //    is still alive instead of waiting for a heartbeat timeout.
        if (this._apiClient && this._sessionId) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
                await this._apiClient.finishSession(this._sessionId);
            }
            catch (e) {
                console.warn(`[abrasio] Failed to finish session: ${e}`);
            }
            finally {
                clearTimeout(timer);
            }
        }
        // 2. Now safely drop the CDP connection.
        if (this._browser) {
            try {
                await this._browser.close();
            }
            catch (e) {
                console.warn(`[abrasio] Failed to close browser: ${e}`);
            }
            finally {
                this._browser = null;
            }
        }
        this._apiClient = null;
        this._sessionId = null;
        this._wsEndpoint = null;
    }
    /**
     * List files downloaded by the browser during this session, each with
     * a presigned S3 URL to fetch the bytes directly.
     */
    async getArtifacts() {
        if (!this._apiClient || !this._sessionId) {
            throw new Error('Browser not started or session not active');
        }
        return await this._apiClient.getSessionArtifacts(this._sessionId);
    }
    async newContext(options) {
        if (!this._browser)
            throw new Error('Browser not connected');
        const contexts = this._browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await this._browser.newContext(options);
        await this._applyResourceBlockingOnce(context);
        return context;
    }
    async newPage() {
        if (!this._browser)
            throw new Error('Browser not connected');
        const contexts = this._browser.contexts();
        const context = contexts.length > 0
            ? contexts[0]
            : await this._browser.newContext();
        await this._applyResourceBlockingOnce(context);
        return await context.newPage();
    }
}
