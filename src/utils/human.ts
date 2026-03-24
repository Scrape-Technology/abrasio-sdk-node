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

// Fitts's Law constants
const FITTS_A = 0.1;
const FITTS_B = 0.1;

type Point = [number, number];

function bezierPoint(t: number, points: Point[]): Point {
    if (points.length === 1) return points[0];
    const newPoints: Point[] = [];
    for (let i = 0; i < points.length - 1; i++) {
        newPoints.push([
            (1 - t) * points[i][0] + t * points[i + 1][0],
            (1 - t) * points[i][1] + t * points[i + 1][1],
        ]);
    }
    return bezierPoint(t, newPoints);
}

function generateControlPoints(start: Point, end: Point, numControl = 2): Point[] {
    const points: Point[] = [start];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const deviation = Math.min(distance * 0.3, 100);

    for (let i = 0; i < numControl; i++) {
        const t = (i + 1) / (numControl + 1);
        const baseX = start[0] + dx * t;
        const baseY = start[1] + dy * t;

        let perpX = 0, perpY = 0;
        if (distance > 0) {
            perpX = -dy / distance;
            perpY = dx / distance;
        }

        const offset = gaussRandom(0, deviation * 0.5);
        points.push([baseX + perpX * offset, baseY + perpY * offset]);
    }

    points.push(end);
    return points;
}

function calculateMovementTime(distance: number, minTime = 0.1, maxTime = 1.5): number {
    if (distance < 1) return minTime;
    const baseTime = FITTS_A + FITTS_B * Math.log2(1 + distance / 10);
    const time = baseTime * (0.8 + Math.random() * 0.4);
    return Math.max(minTime, Math.min(maxTime, time));
}

function gaussRandom(mean: number, stddev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stddev * z;
}

function addJitter(point: Point, amount: number): Point {
    return [point[0] + gaussRandom(0, amount), point[1] + gaussRandom(0, amount)];
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Public API ──

export async function humanMoveTo(
    page: Page,
    x: number,
    y: number,
    options: { minTime?: number; maxTime?: number; stepsPerSecond?: number; jitter?: number } = {},
): Promise<void> {
    const { minTime = 0.1, maxTime = 1.5, stepsPerSecond = 60, jitter = 0.5 } = options;

    let currentX = 500, currentY = 300;
    try {
        const vp = page.viewportSize();
        if (vp) { currentX = vp.width / 2; currentY = vp.height / 2; }
    } catch { /* ignore */ }

    const start: Point = [currentX, currentY];
    const end: Point = [x, y];
    const distance = Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2);
    const duration = calculateMovementTime(distance, minTime, maxTime);
    const controlPoints = generateControlPoints(start, end);
    const numSteps = Math.max(Math.floor(duration * stepsPerSecond), 10);

    for (let i = 0; i <= numSteps; i++) {
        let t = i / numSteps;
        // Cubic ease-in-out
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        let point = bezierPoint(eased, controlPoints);
        const jitterAmount = jitter * Math.sin(t * Math.PI);
        point = addJitter(point, jitterAmount);

        await page.mouse.move(point[0], point[1]);
        await sleep(duration / numSteps * 1000);
    }
}

export async function humanClick(
    page: Page,
    options: {
        selector?: string;
        x?: number;
        y?: number;
        offsetRange?: number;
        moveFirst?: boolean;
        doubleClick?: boolean;
    } = {},
): Promise<void> {
    const { offsetRange = 5, moveFirst = true, doubleClick = false } = options;
    let { x, y } = options;

    if (options.selector) {
        const element = await page.$(options.selector);
        if (!element) throw new Error(`Element not found: ${options.selector}`);

        const box = await element.boundingBox();
        if (!box) {
            if (doubleClick) await element.dblclick();
            else await element.click();
            return;
        }

        x = box.x + box.width * (0.3 + Math.random() * 0.4);
        y = box.y + box.height * (0.3 + Math.random() * 0.4);
    }

    if (x == null || y == null) {
        throw new Error('Either selector or x,y coordinates must be provided');
    }

    x += Math.floor(Math.random() * (offsetRange * 2 + 1)) - offsetRange;
    y += Math.floor(Math.random() * (offsetRange * 2 + 1)) - offsetRange;

    if (moveFirst) await humanMoveTo(page, x, y);

    await sleep(50 + Math.random() * 100);

    if (doubleClick) await page.mouse.dblclick(x, y);
    else await page.mouse.click(x, y);
}

// Keyboard layout for typos
const KEYBOARD_LAYOUT: Record<string, string> = {
    q: 'wa', w: 'qeas', e: 'wsdr', r: 'edft', t: 'rfgy',
    y: 'tghu', u: 'yhji', i: 'ujko', o: 'iklp', p: 'ol',
    a: 'qwsz', s: 'awedxz', d: 'serfcx', f: 'drtgvc',
    g: 'ftyhbv', h: 'gyujnb', j: 'huikmn', k: 'jiolm',
    l: 'kop', z: 'asx', x: 'zsdc', c: 'xdfv', v: 'cfgb',
    b: 'vghn', n: 'bhjm', m: 'njk',
};

const COMMON_CHARS = new Set('etaoinshrdlu ');
const UNCOMMON_CHARS = new Set('zxqjkvbp');

export async function humanType(
    page: Page,
    text: string,
    options: {
        selector?: string;
        minDelayMs?: number;
        maxDelayMs?: number;
        mistakeProbability?: number;
        thinkPauseProbability?: number;
    } = {},
): Promise<void> {
    const {
        minDelayMs = 30,
        maxDelayMs = 150,
        mistakeProbability = 0.02,
        thinkPauseProbability = 0.05,
    } = options;

    if (options.selector) {
        await humanClick(page, { selector: options.selector });
        await sleep(100 + Math.random() * 200);
    }

    let burstMode = false;
    let burstCounter = 0;

    for (const char of text) {
        let baseDelay: number;
        if (COMMON_CHARS.has(char.toLowerCase())) {
            baseDelay = minDelayMs + Math.random() * (maxDelayMs * 0.6 - minDelayMs);
        } else if (UNCOMMON_CHARS.has(char.toLowerCase())) {
            baseDelay = minDelayMs * 1.5 + Math.random() * (maxDelayMs - minDelayMs * 1.5);
        } else {
            baseDelay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
        }

        if (burstMode) {
            baseDelay *= 0.5;
            burstCounter--;
            if (burstCounter <= 0) burstMode = false;
        } else if (Math.random() < 0.1) {
            burstMode = true;
            burstCounter = 3 + Math.floor(Math.random() * 6);
        }

        if (Math.random() < thinkPauseProbability) {
            await sleep(300 + Math.random() * 700);
        }

        if (Math.random() < mistakeProbability && /[a-z]/i.test(char)) {
            const lower = char.toLowerCase();
            const adjacent = KEYBOARD_LAYOUT[lower];
            if (adjacent) {
                const wrong = adjacent[Math.floor(Math.random() * adjacent.length)];
                const wrongChar = char === char.toUpperCase() ? wrong.toUpperCase() : wrong;
                await page.keyboard.type(wrongChar, { delay: baseDelay });
                await sleep(100 + Math.random() * 200);
                await page.keyboard.press('Backspace');
                await sleep(50 + Math.random() * 100);
            }
            await page.keyboard.type(char, { delay: baseDelay });
        } else {
            await page.keyboard.type(char, { delay: baseDelay });
        }
    }
}

export async function humanScroll(
    page: Page,
    options: {
        direction?: 'up' | 'down';
        amount?: number;
        smooth?: boolean;
        duration?: number;
    } = {},
): Promise<void> {
    const { direction = 'down', smooth = true, duration = 0.5 } = options;
    let amount = options.amount ?? (200 + Math.floor(Math.random() * 400));

    if (direction === 'up') amount = -amount;

    if (!smooth) {
        await page.mouse.wheel(0, amount);
        await sleep(100 + Math.random() * 200);
        return;
    }

    const steps = Math.max(Math.floor(duration * 30), 5);
    const stepAmount = amount / steps;

    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const eased = 1 - Math.pow(1 - t, 3);
        const currentStep = stepAmount * (1 - eased * 0.5);

        await page.mouse.wheel(0, currentStep);
        await sleep((duration / steps) * 1000);
    }

    await sleep(100 + Math.random() * 200);
}

export async function randomDelay(minMs = 100, maxMs = 500): Promise<void> {
    await sleep(minMs + Math.random() * (maxMs - minMs));
}

export async function humanWait(minSeconds = 0.5, maxSeconds = 2.0): Promise<void> {
    // Beta distribution approximation (skewed toward shorter waits)
    const u1 = Math.random();
    const u2 = Math.random();
    const beta = Math.pow(u1, 1 / 2) * Math.pow(u2, 1 / 5); // rough beta(2,5) approximation
    const normalized = beta / (Math.pow(1, 1 / 2) * Math.pow(1, 1 / 5));
    const wait = minSeconds + (maxSeconds - minSeconds) * Math.min(normalized, 1);
    await sleep(wait * 1000);
}

export async function simulateReading(
    page: Page,
    options: { minSeconds?: number; maxSeconds?: number } = {},
): Promise<void> {
    const { minSeconds = 2.0, maxSeconds = 8.0 } = options;
    const readingTime = minSeconds + Math.random() * (maxSeconds - minSeconds);
    let elapsed = 0;

    while (elapsed < readingTime) {
        if (Math.random() < 0.3) {
            await humanScroll(page, { direction: 'down', amount: 100 + Math.floor(Math.random() * 200) });
        }
        const wait = 0.5 + Math.random() * 1.5;
        await sleep(wait * 1000);
        elapsed += wait;
    }
}

// ---------------------------------------------------------------------------
// Cursor overlay and humanizePage / humanizeContext
// ---------------------------------------------------------------------------

const _CURSOR_OVERLAY_JS = `
(function() {
  try {
    if (document.getElementById('__abr_cursor__')) return;
    var root = document.documentElement || document.body;
    if (!root) return;
    var el = document.createElement('div');
    el.id = '__abr_cursor__';
    el.style.cssText = [
      'position:fixed', 'top:0', 'left:0',
      'width:18px', 'height:18px',
      'background:rgba(255,80,0,0.80)',
      'border:2.5px solid rgba(255,255,255,0.95)',
      'border-radius:50%',
      'box-shadow:0 0 8px 3px rgba(255,100,0,0.55)',
      'pointer-events:none',
      'z-index:2147483647',
      'transform:translate(-50%,-50%)',
      'transition:left 0.018s linear,top 0.018s linear',
      'will-change:left,top',
    ].join(';');
    root.appendChild(el);
    document.addEventListener('mousemove', function(e) {
      el.style.left = e.clientX + 'px';
      el.style.top  = e.clientY + 'px';
    }, {passive: true});
  } catch(e) {}
})();
`;

const _humanizedPages = new WeakSet<Page>();

/**
 * Monkey-patches a Playwright Page so every interaction is automatically humanized.
 * Idempotent — safe to call multiple times on the same page.
 *
 * Patched methods: goto, click, fill, type, hover
 * Cursor overlay is injected immediately (headed mode only).
 */
export async function humanizePage(
    page: Page,
    opts: { headless?: boolean; speedFactor?: number } = {},
): Promise<void> {
    if (_humanizedPages.has(page)) return;
    _humanizedPages.add(page);

    const { headless = false, speedFactor = 1.0 } = opts;

    // Note: cursor overlay is NOT injected here — it runs inside the patched goto
    // after navigation completes, which is the only safe moment (DOM is guaranteed ready).

    // ---- goto -------------------------------------------------------
    const origGoto = page.goto.bind(page);
    (page as any).goto = async (url: string, options?: Record<string, unknown>) => {
        await sleep(50 + Math.random() * 250);
        const result = await origGoto(url, options as any);
        await sleep(100 + Math.random() * 350);
        if (!headless) {
            try { await page.evaluate(_CURSOR_OVERLAY_JS); } catch { /* ignore */ }
        }
        return result;
    };

    // ---- click -------------------------------------------------------
    const origClick = page.click.bind(page);
    (page as any).click = async (selector: string, options?: Record<string, unknown>) => {
        const btn = (options as any)?.button ?? 'left';
        if (btn === 'left') {
            try {
                await humanClick(page, { selector, moveFirst: true });
                return;
            } catch { /* fall through */ }
        }
        return origClick(selector, options as any);
    };

    // ---- fill --------------------------------------------------------
    const origFill = page.fill.bind(page);
    (page as any).fill = async (selector: string, value: string, options?: Record<string, unknown>) => {
        try {
            await humanClick(page, { selector, moveFirst: true });
            await sleep(80 + Math.random() * 120);
            await page.keyboard.press('Control+a');
            await sleep(50 + Math.random() * 70);
            await humanType(page, value);
            return;
        } catch { /* fall through */ }
        return origFill(selector, value, options as any);
    };

    // ---- type --------------------------------------------------------
    const origType = (page as any).type?.bind(page);
    if (origType) {
        (page as any).type = async (selector: string, text: string, options?: Record<string, unknown>) => {
            try {
                await humanClick(page, { selector, moveFirst: true });
                await humanType(page, text);
                return;
            } catch { /* fall through */ }
            return origType(selector, text, options);
        };
    }

    // ---- hover -------------------------------------------------------
    const origHover = page.hover.bind(page);
    (page as any).hover = async (selector: string, options?: Record<string, unknown>) => {
        try {
            const element = await page.$(selector);
            if (element) {
                const box = await element.boundingBox();
                if (box) {
                    const tx = box.x + box.width * (0.2 + Math.random() * 0.6);
                    const ty = box.y + box.height * (0.2 + Math.random() * 0.6);
                    await humanMoveTo(page, tx, ty);
                    return;
                }
            }
        } catch { /* fall through */ }
        return origHover(selector, options as any);
    };
}

/**
 * Humanizes ALL pages in a Playwright BrowserContext (existing and future).
 *
 * - Patches page.goto / click / fill / type / hover on every page.
 * - Listens for new pages and patches them automatically.
 * - Cursor overlay is injected inside the patched goto, after navigation — never
 *   as addInitScript (which runs before DOM exists and causes navigation failures).
 */
export async function humanizeContext(
    ctx: BrowserContext,
    opts: { headless?: boolean; speedFactor?: number } = {},
): Promise<void> {
    const { headless = false, speedFactor = 1.0 } = opts;

    for (const page of ctx.pages()) {
        try { await humanizePage(page, { headless, speedFactor }); } catch { /* ignore */ }
    }

    ctx.on('page', (page: Page) => {
        humanizePage(page, { headless, speedFactor }).catch(() => { /* ignore */ });
    });
}
