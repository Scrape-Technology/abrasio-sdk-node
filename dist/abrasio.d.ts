/**
 * Main Abrasio class — unified interface for local and cloud browsers.
 * Ported from Python abrasio/_api.py
 */
import type { BrowserContext, Page } from 'patchright';
import { type AbrasioConfig, type AbrasioOptions } from './types.js';
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
}
