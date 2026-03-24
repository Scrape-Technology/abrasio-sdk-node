/**
 * Cloud browser implementation using Abrasio API with Patchright.
 * Ported from Python abrasio/cloud/browser.py
 */
import { type Browser, type BrowserContext, type Page } from 'patchright';
import type { AbrasioConfig } from '../types.js';
export declare class CloudBrowser {
    private config;
    private _apiClient;
    private _browser;
    private _sessionId;
    private _wsEndpoint;
    private _liveViewUrl;
    constructor(config: AbrasioConfig);
    get browser(): Browser;
    get sessionId(): string | null;
    get liveViewUrl(): string | null;
    start(): Promise<void>;
    close(): Promise<void>;
    newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
    newPage(): Promise<Page>;
}
