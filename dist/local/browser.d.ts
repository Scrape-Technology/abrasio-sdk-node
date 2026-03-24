/**
 * Stealth browser implementation using Patchright for maximum anti-detection.
 * Ported from Python abrasio/local/browser.py
 */
import { type BrowserContext, type Page } from 'patchright';
import type { AbrasioConfig } from '../types.js';
export declare class StealthBrowser {
    private config;
    private _context;
    private _userDataDir;
    private _isTempDir;
    constructor(config: AbrasioConfig);
    get context(): BrowserContext;
    start(): Promise<void>;
    close(): Promise<void>;
    newContext(): Promise<BrowserContext>;
    newPage(): Promise<Page>;
    private _getStealthArgs;
    private _injectFingerprintNoise;
}
