/**
 * Abrasio Node.js SDK
 *
 * Native TypeScript SDK for stealth web scraping with Patchright.
 * Supports local mode (free, persistent Chrome) and cloud mode (paid, Abrasio API).
 *
 * @example
 * ```typescript
 * import { Abrasio } from 'abrasio-sdk';
 *
 * // Local mode (free)
 * const abrasio = new Abrasio({ headless: false, region: 'BR' });
 * await abrasio.start();
 * const page = await abrasio.newPage();
 * await page.goto('https://example.com');
 * await abrasio.close();
 *
 * // Cloud mode (paid)
 * const cloud = new Abrasio({ apiKey: 'sk_...' });
 * await cloud.start();
 * const page2 = await cloud.newPage();
 * await page2.goto('https://example.com');
 * await cloud.close();
 * ```
 */

export { Abrasio } from './abrasio.js';

export {
    type FingerprintConfig,
    type AbrasioConfig,
    type AbrasioOptions,
    DEFAULT_FINGERPRINT_CONFIG,
    createConfig,
    isCloudMode,
    isLocalMode,
} from './types.js';

export {
    AbrasioError,
    AuthenticationError,
    SessionError,
    BrowserError,
    TimeoutError,
    InsufficientFundsError,
    RateLimitError,
    BlockedError,
} from './exceptions.js';

export {
    type RegionConfig,
    REGION_CONFIG,
    getRegionConfig,
    autoConfigureRegion,
    listSupportedRegions,
} from './region-defaults.js';

export {
    humanMoveTo,
    humanClick,
    humanType,
    humanScroll,
    humanWait,
    randomDelay,
    simulateReading,
} from './utils/human.js';
