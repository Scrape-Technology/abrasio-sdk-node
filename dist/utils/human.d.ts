/**
 * Human-like behavior simulation utilities.
 * Ported from Python abrasio/utils/human.py
 *
 * Implements realistic human behavior patterns:
 * - Bezier curve mouse movements with Fitts's Law timing
 * - Variable typing speed with occasional mistakes
 * - Natural scrolling with momentum
 */
import type { BrowserContext, Page } from 'patchright';
export declare function humanMoveTo(page: Page, x: number, y: number, options?: {
    minTime?: number;
    maxTime?: number;
    stepsPerSecond?: number;
    jitter?: number;
}): Promise<void>;
export declare function humanClick(page: Page, options?: {
    selector?: string;
    x?: number;
    y?: number;
    offsetRange?: number;
    moveFirst?: boolean;
    doubleClick?: boolean;
}): Promise<void>;
export declare function humanType(page: Page, text: string, options?: {
    selector?: string;
    minDelayMs?: number;
    maxDelayMs?: number;
    mistakeProbability?: number;
    thinkPauseProbability?: number;
}): Promise<void>;
export declare function humanScroll(page: Page, options?: {
    direction?: 'up' | 'down';
    amount?: number;
    smooth?: boolean;
    duration?: number;
}): Promise<void>;
export declare function randomDelay(minMs?: number, maxMs?: number): Promise<void>;
export declare function humanWait(minSeconds?: number, maxSeconds?: number): Promise<void>;
export declare function simulateReading(page: Page, options?: {
    minSeconds?: number;
    maxSeconds?: number;
}): Promise<void>;
/**
 * Monkey-patches a Playwright Page so every interaction is automatically humanized.
 * Idempotent — safe to call multiple times on the same page.
 *
 * Patched methods: goto, click, fill, type, hover
 * Cursor overlay is injected immediately (headed mode only).
 */
export declare function humanizePage(page: Page, opts?: {
    headless?: boolean;
    speedFactor?: number;
}): Promise<void>;
/**
 * Humanizes ALL pages in a Playwright BrowserContext (existing and future).
 *
 * - Patches page.goto / click / fill / type / hover on every page.
 * - Listens for new pages and patches them automatically.
 * - Cursor overlay is injected inside the patched goto, after navigation — never
 *   as addInitScript (which runs before DOM exists and causes navigation failures).
 */
export declare function humanizeContext(ctx: BrowserContext, opts?: {
    headless?: boolean;
    speedFactor?: number;
}): Promise<void>;
