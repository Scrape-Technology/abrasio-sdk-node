/**
 * Cloud browser implementation using Abrasio API with Patchright.
 * Ported from Python abrasio/cloud/browser.py
 */
import { type Browser, type BrowserContext, type Page } from 'patchright';
import type { AbrasioConfig, ArtifactInfo } from '../types.js';
export declare class CloudBrowser {
    private config;
    private _apiClient;
    private _browser;
    private _sessionId;
    private _wsEndpoint;
    private _liveViewUrl;
    private _resourceBlockedContexts;
    constructor(config: AbrasioConfig);
    private _applyResourceBlockingOnce;
    get browser(): Browser;
    get sessionId(): string | null;
    get liveViewUrl(): string | null;
    start(): Promise<void>;
    close(): Promise<void>;
    /**
     * List files downloaded by the browser during this session, each with
     * a presigned S3 URL to fetch the bytes directly.
     */
    getArtifacts(): Promise<ArtifactInfo[]>;
    newContext(options?: Record<string, unknown>): Promise<BrowserContext>;
    newPage(): Promise<Page>;
}
