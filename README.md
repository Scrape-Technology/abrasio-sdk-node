# Abrasio SDK for Node.js

Native TypeScript SDK for stealth web scraping with [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs) (undetected Playwright fork).

Supports two modes:
- **Local mode** (free) -- runs Chrome locally with full anti-detection
- **Cloud mode** (paid) -- uses Abrasio API for managed browser sessions via CDP

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [Abrasio Class](#abrasio-class)
  - [Options & Types](#options--types)
  - [Exceptions](#exceptions)
  - [Human Behavior Simulation](#human-behavior-simulation)
  - [Region Configuration](#region-configuration)
- [Examples](#examples)
- [Stealth Features](#stealth-features)
- [Patchright vs Playwright](#patchright-vs-playwright)
- [Cloud Mode Details](#cloud-mode-details)
- [Building from Source](#building-from-source)

---

## Installation

```bash
npm install abrasio-sdk
```

After installing, download the Chromium binary used by Patchright:

```bash
npx patchright install chromium
```

**Requirements:**
- Node.js >= 18.0.0
- Google Chrome installed (local mode uses `channel: 'chrome'`)

## Quick Start

### Local Mode (free)

No API key needed. Launches Chrome locally with stealth patches.

```typescript
import { Abrasio } from 'abrasio-sdk';

const abrasio = new Abrasio({
  headless: false,
  region: 'BR',
});

try {
  await abrasio.start();
  const page = await abrasio.newPage();
  await page.goto('https://example.com');

  const title = await page.title();
  console.log(title);
} finally {
  await abrasio.close();
}
```

### Cloud Mode (paid)

Requires an API key (`sk_...`). Creates a managed session via the Abrasio API and connects over CDP WebSocket.

```typescript
import { Abrasio } from 'abrasio-sdk';

const abrasio = new Abrasio({
  apiKey: 'sk_your_api_key',
  region: 'BR',
  url: 'https://target-site.com',
});

try {
  await abrasio.start();

  if (abrasio.liveViewUrl) {
    console.log(`Watch live: ${abrasio.liveViewUrl}`);
  }

  const page = await abrasio.newPage();
  await page.goto('https://target-site.com');
  // ... scrape data ...
} finally {
  await abrasio.close();
}
```

### Mode Auto-Detection

The SDK automatically selects the mode based on the API key:

| Condition | Mode |
|-----------|------|
| No `apiKey` or key doesn't start with `sk_` | **Local** |
| `apiKey` starts with `sk_` | **Cloud** |

```typescript
// Local mode -- no key
new Abrasio({ region: 'US' });

// Cloud mode -- sk_ key
new Abrasio({ apiKey: 'sk_live_abc123' });

// Also reads from environment
// export ABRASIO_API_KEY=sk_live_abc123
new Abrasio(); // -> cloud mode
```

---

## Architecture

```
LOCAL MODE:
  Abrasio SDK
    └── Patchright.chromium.launchPersistentContext()
          └── Google Chrome (channel: 'chrome')
                ├── Stealth args (disable automation flags)
                ├── Canvas noise injection
                ├── Audio noise injection
                └── WebGL/WebRTC control

CLOUD MODE:
  Abrasio SDK
    └── AbrasioAPIClient (HTTP)
          └── POST /v1/browser/session/ -> poll until READY
                └── Patchright.chromium.connectOverCDP(ws_endpoint)
                      └── Remote browser (managed by Abrasio)
```

### Project Structure

```
abrasio-sdk-node/
├── src/
│   ├── index.ts              # Public exports
│   ├── abrasio.ts            # Unified Abrasio class
│   ├── types.ts              # TypeScript interfaces
│   ├── exceptions.ts         # Error hierarchy (8 classes)
│   ├── region-defaults.ts    # 40+ country locale/timezone configs
│   ├── local/
│   │   └── browser.ts        # StealthBrowser (Patchright persistent context)
│   ├── cloud/
│   │   ├── api-client.ts     # HTTP client with retry logic
│   │   └── browser.ts        # CloudBrowser (API + CDP connection)
│   └── utils/
│       └── human.ts          # Human behavior simulation
├── examples/
│   ├── basic.ts              # Local mode example
│   ├── cloud.ts              # Cloud mode example
│   └── human-behavior.ts     # Human interaction simulation
├── package.json
└── tsconfig.json
```

---

## Configuration

### AbrasioOptions

Pass these when creating an `Abrasio` instance:

```typescript
const abrasio = new Abrasio({
  // -- Mode Selection --
  apiKey: 'sk_...',           // Enables cloud mode. Env: ABRASIO_API_KEY
  apiUrl: 'https://...',      // API URL. Env: ABRASIO_API_URL. Default: http://localhost:8000

  // -- Browser Settings --
  headless: true,             // Run headless. Default: true
  proxy: 'http://user:pass@host:port',  // Proxy URL (local mode)
  timeout: 30000,             // Default timeout in ms. Default: 30000
  viewport: { width: 1920, height: 1080 },  // Viewport size. Default: null (no viewport)
  extraArgs: ['--flag'],      // Extra Chrome launch args. Default: []

  // -- Region & Locale --
  region: 'BR',               // Auto-configures locale + timezone
  // locale and timezone are auto-set from region, but can be overridden

  // -- Profiles --
  userDataDir: '/path/to/profile',  // Persistent profile dir (local mode)
  profileId: 'prof_abc123',         // Persistent profile ID (cloud mode)

  // -- Fingerprint Protection --
  fingerprint: {
    webgl: true,              // Enable WebGL. Default: true
    webrtc: true,             // Enable WebRTC. Default: true
    canvasNoise: false,       // Canvas fingerprint noise. Default: false
    audioNoise: false,        // Audio fingerprint noise. Default: false
  },

  // -- Target --
  url: 'https://target.com',  // Target URL (cloud mode region inference)

  // -- Other --
  stealth: true,              // Enable stealth patches. Default: true
  debug: false,               // Debug logging. Default: false
});
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ABRASIO_API_KEY` | API key for cloud mode | -- |
| `ABRASIO_API_URL` | Abrasio API base URL | `http://localhost:8000` |

### Viewport Behavior

| Value | Behavior |
|-------|----------|
| `null` (default) | No fixed viewport -- better stealth, browser uses natural window size |
| `{ width, height }` | Fixed viewport dimensions |

> **Tip:** Using `null` viewport is recommended for stealth. Fixed viewports are a common bot signal.

---

## API Reference

### Abrasio Class

The main entry point. Unified interface for both local and cloud modes.

#### Constructor

```typescript
new Abrasio(options?: AbrasioOptions)
```

Creates an Abrasio instance. Does **not** start the browser -- call `start()` to launch.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `config` | `AbrasioConfig` | Resolved configuration (read-only) |
| `isCloud` | `boolean` | `true` if running in cloud mode |
| `isLocal` | `boolean` | `true` if running in local mode |
| `liveViewUrl` | `string \| null` | Live view URL (cloud mode only) |
| `browser` | `BrowserContext` | Underlying Patchright browser context |

#### Methods

##### `start(): Promise<Abrasio>`

Starts the browser. In local mode, launches Chrome with stealth patches. In cloud mode, creates an API session and connects via CDP.

```typescript
const abrasio = new Abrasio({ region: 'US' });
await abrasio.start();
```

Returns the `Abrasio` instance for chaining.

##### `close(): Promise<void>`

Closes the browser and cleans up resources. In cloud mode, also notifies the API that the session is finished.

```typescript
await abrasio.close();
```

Always call this in a `finally` block to prevent resource leaks.

##### `newPage(): Promise<Page>`

Creates a new page (tab) in the browser context.

```typescript
const page = await abrasio.newPage();
await page.goto('https://example.com');
```

Returns a Patchright `Page` object (compatible with Playwright API).

##### `newContext(options?: Record<string, unknown>): Promise<BrowserContext>`

Returns the browser context. In local mode with persistent context, returns the existing context (creating multiple contexts reduces stealth). In cloud mode, returns the first existing context or creates a new one.

```typescript
const context = await abrasio.newContext();
```

---

### Options & Types

#### `FingerprintConfig`

Controls browser fingerprint protection (local mode only).

```typescript
interface FingerprintConfig {
  webgl: boolean;        // Enable WebGL APIs (disable = strong bot signal)
  webrtc: boolean;       // Enable WebRTC (disable with proxy to prevent IP leak)
  canvasNoise: boolean;  // Add noise to canvas fingerprint reads
  audioNoise: boolean;   // Add noise to AudioContext fingerprint reads
}
```

**Defaults:**

```typescript
{
  webgl: true,
  webrtc: true,
  canvasNoise: false,
  audioNoise: false,
}
```

#### `AbrasioConfig`

Full resolved configuration (created internally from `AbrasioOptions`).

```typescript
interface AbrasioConfig {
  apiKey?: string;
  apiUrl: string;
  url?: string;
  headless: boolean;
  proxy?: string;
  timeout: number;
  stealth: boolean;
  locale?: string;
  timezone?: string;
  viewport?: { width: number; height: number } | null;
  userDataDir?: string;
  region?: string;
  profileId?: string;
  autoConfigureRegion: boolean;
  fingerprint: FingerprintConfig;
  extraArgs: string[];
  debug: boolean;
}
```

#### Helper Functions

```typescript
import { isCloudMode, isLocalMode, createConfig } from 'abrasio-sdk';

// Check mode from config
isCloudMode(config: AbrasioConfig): boolean   // apiKey starts with 'sk_'
isLocalMode(config: AbrasioConfig): boolean   // not cloud mode

// Build config from options
createConfig(options?: AbrasioOptions): AbrasioConfig
```

---

### Exceptions

All exceptions extend `AbrasioError`, which extends `Error`.

```
AbrasioError
├── AuthenticationError     -- Invalid or missing API key (HTTP 401)
├── SessionError            -- Session creation/management failures
├── BrowserError            -- Browser launch/connection failures
├── TimeoutError            -- Operation timeouts
├── InsufficientFundsError  -- Account balance too low (HTTP 402)
├── RateLimitError          -- Too many requests (HTTP 429)
└── BlockedError            -- Request blocked by target site
```

#### Usage

```typescript
import {
  Abrasio,
  AbrasioError,
  AuthenticationError,
  InsufficientFundsError,
  TimeoutError,
} from 'abrasio-sdk';

try {
  const abrasio = new Abrasio({ apiKey: 'sk_...' });
  await abrasio.start();
  // ...
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof InsufficientFundsError) {
    console.error(`Low balance: $${error.balance?.toFixed(2)}`);
  } else if (error instanceof TimeoutError) {
    console.error(`Timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof AbrasioError) {
    console.error('Abrasio error:', error.message, error.details);
  }
}
```

#### Exception Properties

| Exception | Extra Properties |
|-----------|-----------------|
| `AbrasioError` | `details: Record<string, unknown>` |
| `SessionError` | `sessionId?: string` |
| `TimeoutError` | `timeoutMs?: number` |
| `InsufficientFundsError` | `balance?: number` |
| `RateLimitError` | `retryAfter?: number` (seconds) |
| `BlockedError` | `url?: string`, `statusCode?: number` |

---

### Human Behavior Simulation

Utilities for simulating realistic human interactions. These help bypass behavior-based bot detection by mimicking real user patterns.

```typescript
import {
  humanMoveTo,
  humanClick,
  humanType,
  humanScroll,
  humanWait,
  randomDelay,
  simulateReading,
} from 'abrasio-sdk';
```

#### `humanMoveTo(page, x, y, options?)`

Moves the mouse cursor along a Bezier curve path with Fitts's Law timing and natural jitter.

```typescript
await humanMoveTo(page, 500, 300, {
  minTime: 0.1,         // Min movement duration (seconds). Default: 0.1
  maxTime: 1.5,         // Max movement duration (seconds). Default: 1.5
  stepsPerSecond: 60,   // Mouse move resolution. Default: 60
  jitter: 0.5,          // Random pixel offset. Default: 0.5
});
```

**How it works:**
1. Generates Bezier control points with random perpendicular deviation
2. Calculates movement duration using Fitts's Law: `T = a + b * log2(1 + D/10)`
3. Interpolates along the curve with cubic ease-in-out
4. Adds Gaussian jitter that peaks mid-movement

#### `humanClick(page, options?)`

Clicks an element or coordinates with human-like behavior.

```typescript
// Click by CSS selector
await humanClick(page, { selector: 'button.submit' });

// Click by coordinates
await humanClick(page, { x: 500, y: 300 });

// Double-click
await humanClick(page, { selector: '#item', doubleClick: true });

// Click without mouse movement (faster)
await humanClick(page, { selector: '#btn', moveFirst: false });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `selector` | `string` | -- | CSS selector to click |
| `x` | `number` | -- | X coordinate |
| `y` | `number` | -- | Y coordinate |
| `offsetRange` | `number` | `5` | Random pixel offset from target center |
| `moveFirst` | `boolean` | `true` | Move mouse to element before clicking |
| `doubleClick` | `boolean` | `false` | Perform double-click |

**Behavior:** When using a selector, clicks at a random point within the element (30-70% of width/height), not dead center. This avoids the common bot signal of always clicking at exact center.

#### `humanType(page, text, options?)`

Types text with variable speed, burst typing, think pauses, and realistic typos.

```typescript
await humanType(page, 'Hello world!', {
  selector: 'input#search',      // Click this element first
  minDelayMs: 30,                 // Min inter-key delay. Default: 30
  maxDelayMs: 150,                // Max inter-key delay. Default: 150
  mistakeProbability: 0.02,       // Chance of typo per char. Default: 0.02
  thinkPauseProbability: 0.05,    // Chance of thinking pause. Default: 0.05
});
```

**Typing characteristics:**
- **Variable speed by character:** Common letters (`etaoinshrdlu `) are typed faster, uncommon letters (`zxqjkvbp`) are typed slower
- **Burst mode:** 10% chance of entering burst mode, typing 3-8 consecutive characters at 2x speed
- **Think pauses:** 5% chance per character of a 300-1000ms pause (simulating thinking)
- **Realistic typos:** 2% chance per letter of typing an adjacent keyboard key, pausing, pressing Backspace, then typing the correct key

#### `humanScroll(page, options?)`

Scrolls the page with natural momentum and easing.

```typescript
// Smooth scroll down (default)
await humanScroll(page);

// Scroll up 500px
await humanScroll(page, { direction: 'up', amount: 500 });

// Instant scroll (no animation)
await humanScroll(page, { smooth: false, amount: 300 });

// Slow smooth scroll
await humanScroll(page, { duration: 1.5, amount: 800 });
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `direction` | `'up' \| 'down'` | `'down'` | Scroll direction |
| `amount` | `number` | Random 200-600 | Pixels to scroll |
| `smooth` | `boolean` | `true` | Animate with easing |
| `duration` | `number` | `0.5` | Animation duration (seconds) |

**Behavior:** Smooth scrolling uses cubic ease-out, decelerating at the end like a real mouse wheel.

#### `humanWait(minSeconds?, maxSeconds?)`

Waits a random duration using a Beta distribution (skewed toward shorter waits -- more realistic than uniform).

```typescript
await humanWait(0.5, 2.0);  // Wait 0.5-2.0 seconds (usually closer to 0.5)
```

#### `randomDelay(minMs?, maxMs?)`

Simple uniform random delay.

```typescript
await randomDelay(100, 500);  // Wait 100-500ms (uniform distribution)
```

#### `simulateReading(page, options?)`

Simulates reading a page: waits while occasionally scrolling down.

```typescript
await simulateReading(page, {
  minSeconds: 2.0,   // Min reading time. Default: 2.0
  maxSeconds: 8.0,   // Max reading time. Default: 8.0
});
```

**Behavior:** Every ~0.5-2s, has a 30% chance of scrolling down 100-300px. Continues until the reading time elapses. Mimics a user scanning through content.

---

### Region Configuration

The SDK auto-configures `locale` and `timezone` from a region code when you set the `region` option.

#### Supported Regions (40+)

| Region | Locale | Default Timezone |
|--------|--------|------------------|
| `US` | `en-US` | `America/New_York` |
| `BR` | `pt-BR` | `America/Sao_Paulo` |
| `GB` | `en-GB` | `Europe/London` |
| `DE` | `de-DE` | `Europe/Berlin` |
| `FR` | `fr-FR` | `Europe/Paris` |
| `ES` | `es-ES` | `Europe/Madrid` |
| `IT` | `it-IT` | `Europe/Rome` |
| `PT` | `pt-PT` | `Europe/Lisbon` |
| `NL` | `nl-NL` | `Europe/Amsterdam` |
| `SE` | `sv-SE` | `Europe/Stockholm` |
| `NO` | `nb-NO` | `Europe/Oslo` |
| `DK` | `da-DK` | `Europe/Copenhagen` |
| `FI` | `fi-FI` | `Europe/Helsinki` |
| `PL` | `pl-PL` | `Europe/Warsaw` |
| `IE` | `en-IE` | `Europe/Dublin` |
| `CH` | `de-CH` | `Europe/Zurich` |
| `AT` | `de-AT` | `Europe/Vienna` |
| `CZ` | `cs-CZ` | `Europe/Prague` |
| `HU` | `hu-HU` | `Europe/Budapest` |
| `RO` | `ro-RO` | `Europe/Bucharest` |
| `GR` | `el-GR` | `Europe/Athens` |
| `TR` | `tr-TR` | `Europe/Istanbul` |
| `RU` | `ru-RU` | `Europe/Moscow` |
| `UA` | `uk-UA` | `Europe/Kyiv` |
| `CA` | `en-CA` | `America/Toronto` |
| `MX` | `es-MX` | `America/Mexico_City` |
| `AR` | `es-AR` | `America/Argentina/Buenos_Aires` |
| `CL` | `es-CL` | `America/Santiago` |
| `CO` | `es-CO` | `America/Bogota` |
| `PE` | `es-PE` | `America/Lima` |
| `JP` | `ja-JP` | `Asia/Tokyo` |
| `KR` | `ko-KR` | `Asia/Seoul` |
| `CN` | `zh-CN` | `Asia/Shanghai` |
| `TW` | `zh-TW` | `Asia/Taipei` |
| `HK` | `zh-HK` | `Asia/Hong_Kong` |
| `SG` | `en-SG` | `Asia/Singapore` |
| `AU` | `en-AU` | `Australia/Sydney` |
| `NZ` | `en-NZ` | `Pacific/Auckland` |
| `ZA` | `en-ZA` | `Africa/Johannesburg` |
| `IN` | `en-IN` | `Asia/Kolkata` |
| `AE` | `ar-AE` | `Asia/Dubai` |
| `SA` | `ar-SA` | `Asia/Riyadh` |

Regions with multiple timezones (like US, BR, CA, RU, AU, MX, ES) also have a `validTimezones` list for validation.

#### Region Functions

```typescript
import {
  getRegionConfig,
  autoConfigureRegion,
  listSupportedRegions,
  REGION_CONFIG,
} from 'abrasio-sdk';

// Get config for a region
const config = getRegionConfig('BR');
// { locale: 'pt-BR', timezone: 'America/Sao_Paulo', validTimezones: [...] }

// Auto-configure with override support
const { locale, timezone, warnings } = autoConfigureRegion('BR', undefined, 'America/Manaus');
// locale: 'pt-BR', timezone: 'America/Manaus', warnings: []

// Unusual timezone triggers warning
const result = autoConfigureRegion('BR', undefined, 'Europe/London');
// warnings: ["Timezone 'Europe/London' is unusual for region 'BR'."]

// List all supported region codes
const regions = listSupportedRegions();
// ['AE', 'AR', 'AT', 'AU', 'BR', 'CA', ...]
```

---

## Examples

### Run Examples

```bash
npm run example:basic    # Local mode stealth browsing
npm run example:cloud    # Cloud mode with API key
npm run example:human    # Human behavior simulation
```

### Scraping with Data Extraction

```typescript
import { Abrasio, humanWait } from 'abrasio-sdk';

const abrasio = new Abrasio({ headless: true, region: 'US' });

try {
  await abrasio.start();
  const page = await abrasio.newPage();

  await page.goto('https://news.ycombinator.com');
  await humanWait(1, 2);

  // Extract data using standard Playwright selectors
  const titles = await page.$$eval('.titleline > a', (links) =>
    links.map((a) => ({
      title: a.textContent,
      url: a.getAttribute('href'),
    }))
  );

  console.log(`Found ${titles.length} stories`);
  titles.slice(0, 5).forEach((t) => console.log(`  - ${t.title}`));
} finally {
  await abrasio.close();
}
```

### Persistent Profile (cookies/localStorage survive restarts)

```typescript
import { Abrasio } from 'abrasio-sdk';

const abrasio = new Abrasio({
  headless: false,
  region: 'US',
  userDataDir: './my-chrome-profile',  // Persists across runs
});

try {
  await abrasio.start();
  const page = await abrasio.newPage();

  // First run: login manually or programmatically
  // Second run: cookies are already there
  await page.goto('https://example.com/dashboard');
} finally {
  await abrasio.close();
}
```

### Using with Proxy

```typescript
import { Abrasio } from 'abrasio-sdk';

const abrasio = new Abrasio({
  region: 'BR',
  proxy: 'http://user:password@proxy.example.com:8080',
  fingerprint: {
    webgl: true,
    webrtc: false,    // Disable WebRTC to prevent IP leak through proxy
    canvasNoise: true,
    audioNoise: true,
  },
});

try {
  await abrasio.start();
  const page = await abrasio.newPage();
  await page.goto('https://httpbin.org/ip');
  console.log(await page.textContent('body'));
} finally {
  await abrasio.close();
}
```

### Screenshots & PDFs

```typescript
import { Abrasio } from 'abrasio-sdk';

const abrasio = new Abrasio({ headless: true });

try {
  await abrasio.start();
  const page = await abrasio.newPage();
  await page.goto('https://example.com');

  // Full-page screenshot
  await page.screenshot({ path: 'page.png', fullPage: true });

  // PDF export (headless only)
  await page.pdf({ path: 'page.pdf', format: 'A4' });
} finally {
  await abrasio.close();
}
```

### Combining Human Behavior with Scraping

```typescript
import {
  Abrasio,
  humanClick,
  humanType,
  humanScroll,
  humanWait,
  simulateReading,
} from 'abrasio-sdk';

const abrasio = new Abrasio({ headless: false, region: 'US' });

try {
  await abrasio.start();
  const page = await abrasio.newPage();

  // Navigate
  await page.goto('https://www.google.com');
  await humanWait(1, 3);

  // Search with human typing
  await humanClick(page, { selector: 'textarea[name="q"]' });
  await humanType(page, 'web scraping best practices');
  await humanWait(0.5, 1);
  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');

  // Read results like a human
  await simulateReading(page, { minSeconds: 3, maxSeconds: 6 });

  // Click a result
  await humanClick(page, { selector: '#search a h3' });
  await page.waitForLoadState('networkidle');

  // Read the article
  await simulateReading(page, { minSeconds: 5, maxSeconds: 15 });
  await humanScroll(page, { direction: 'down', amount: 800 });
} finally {
  await abrasio.close();
}
```

### Multiple Pages in Parallel

```typescript
import { Abrasio } from 'abrasio-sdk';

const abrasio = new Abrasio({ headless: true, region: 'US' });
const urls = [
  'https://example.com/page1',
  'https://example.com/page2',
  'https://example.com/page3',
];

try {
  await abrasio.start();

  const results = await Promise.all(
    urls.map(async (url) => {
      const page = await abrasio.newPage();
      await page.goto(url);
      const title = await page.title();
      await page.close();
      return { url, title };
    })
  );

  results.forEach((r) => console.log(`${r.url} -> ${r.title}`));
} finally {
  await abrasio.close();
}
```

---

## Stealth Features

### Patchright Patches (built-in)

Patchright applies these patches automatically:

| Patch | Description |
|-------|-------------|
| `Runtime.enable` leak | Prevents CDP leak through `Runtime.enable` |
| `Console.enable` | Blocks `console.enable` detection vector |
| `AutomationControlled` | Removes `navigator.webdriver = true` flag |
| Headless detection | Fixes various headless indicators |

### SDK Stealth Args

The SDK adds these Chrome flags in local mode:

```
--disable-blink-features=AutomationControlled
--no-first-run
--no-sandbox
--disable-dev-shm-usage
--no-default-browser-check
--disable-infobars
--disable-popup-blocking
--disable-component-update
--disable-default-apps
```

In headless mode, the SDK also overrides the User-Agent to remove `HeadlessChrome`, using a realistic UA for your OS (Windows/macOS/Linux).

### Ignored Default Args

These Playwright/Patchright default args are explicitly **excluded** to improve stealth:

```
--enable-automation     (removed: triggers bot detection)
--disable-extensions    (removed: extensions improve fingerprint realism)
```

### Fingerprint Noise Injection

When enabled, these scripts are injected via `addInitScript` before any page loads:

**Canvas Noise** (`canvasNoise: true`):
- Adds +/-1 random noise to RGB channels on `getImageData()`
- Intercepts `toDataURL()` and `toBlob()` to pass through the noise filter
- Each page load generates a unique canvas fingerprint

**Audio Noise** (`audioNoise: true`):
- Adds 0.001 noise to `AnalyserNode.getFloatFrequencyData()`
- Adds 0.0001 noise to `AudioBuffer.getChannelData()`
- Prevents audio fingerprint correlation across sessions

### WebGL & WebRTC Control

```typescript
fingerprint: {
  webgl: false,   // Adds --disable-webgl --disable-webgl2
  webrtc: false,  // Adds --enforce-webrtc-ip-permission-check
                   //       --disable-webrtc-multiple-routes
                   //       --disable-webrtc-hw-encoding
}
```

> **Recommendation:** Keep `webgl: true` (disabling is a strong bot signal). Set `webrtc: false` when using proxies to prevent IP leak.

### Persistent Context

Local mode uses `launchPersistentContext` with `channel: 'chrome'`, which means:
- Uses the user's real Chrome installation (not Chromium)
- Persistent cookies, localStorage, and IndexedDB across sessions (when `userDataDir` is set)
- Single context for better stealth (multiple contexts are a bot signal)

---

## Patchright vs Playwright

This SDK uses [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs) instead of Playwright. Patchright is a drop-in replacement with identical API but additional stealth patches.

**Key differences:**

| Feature | Playwright | Patchright |
|---------|-----------|------------|
| `navigator.webdriver` | `true` | `false` |
| `Runtime.enable` leak | Exposed | Patched |
| `Console.enable` detection | Vulnerable | Blocked |
| Headless indicators | Present | Removed |
| API compatibility | -- | 100% compatible |

You can use the full Playwright API: selectors, waiting, screenshots, PDF generation, network interception, etc. See the [Playwright docs](https://playwright.dev/docs/api/class-page) for the complete Page/BrowserContext API.

---

## Cloud Mode Details

### Session Lifecycle

```
1. SDK creates session   -> POST /v1/browser/session/
2. API returns session   -> { id, status: "PENDING" }
3. SDK polls status      -> GET /v1/browser/session/{id}  (every 1s, up to 60s)
4. Session becomes READY -> { status: "READY", ws_endpoint: "ws://..." }
5. SDK connects via CDP  -> chromium.connectOverCDP(ws_endpoint)
6. Scraping happens      -> Page operations via CDP WebSocket
7. SDK closes            -> POST /v1/browser/session/{id}/finish
```

### API Client Retry Logic

The HTTP client automatically retries on transient errors:

- **Retryable status codes:** 429, 502, 503, 504
- **Max retries:** 3
- **Backoff:** Exponential (1s, 2s, 4s) capped at 15s, or `Retry-After` header (capped at 30s)
- **Network errors:** Retried with same backoff strategy
- **Non-retryable errors:** Thrown immediately (401, 402, 404, etc.)

### Authentication

The API key is sent via the `X-API-KEY` header on every request.

### Cloud vs Local Comparison

| Feature | Local Mode | Cloud Mode |
|---------|------------|------------|
| Cost | Free | Pay-per-use |
| Setup | Chrome + Patchright | Just API key |
| Execution | Your machine | Abrasio infrastructure |
| Scaling | Limited by resources | Auto-scaling |
| Profiles | Local directory | Managed by API |
| Best for | Development, testing | Production workloads |

---

## Building from Source

```bash
git clone <repo>
cd abrasio-sdk-node

npm install
npm run build     # Compiles TypeScript to dist/
npm run dev       # Watch mode for development
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `patchright` | Undetected Playwright fork (stealth browser automation) |
| `typescript` | TypeScript compiler (dev) |
| `tsx` | TypeScript executor for examples (dev) |
| `@types/node` | Node.js type definitions (dev) |

## Support & Community

| Channel | Link |
|---------|------|
| 💬 Discord | [discord.gg/GBSKsC8DvS](https://discord.gg/GBSKsC8DvS) |
| 📧 Email | [joao.sobhie@scrapetechnology.com](mailto:joao.sobhie@scrapetechnology.com) |
| 🌐 Docs | [scrapetechnology.com/abrasio/docs](https://scrapetechnology.com/abrasio/docs) |

For bug reports and feature requests, open a thread in the `#abrasio-feedback` channel on Discord.

## License

MIT
