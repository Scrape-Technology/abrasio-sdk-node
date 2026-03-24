/**
 * Stealth browser implementation using Patchright for maximum anti-detection.
 * Ported from Python abrasio/local/browser.py
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'patchright';
import type { AbrasioConfig } from '../types.js';

// Canvas noise script: adds subtle random noise to canvas pixel data reads.
const CANVAS_NOISE_SCRIPT = `
(() => {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const imageData = originalGetImageData.apply(this, args);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i]     = data[i]     + (Math.random() < 0.5 ? -1 : 1) & 0xff;
            data[i + 1] = data[i + 1] + (Math.random() < 0.5 ? -1 : 1) & 0xff;
            data[i + 2] = data[i + 2] + (Math.random() < 0.5 ? -1 : 1) & 0xff;
        }
        return imageData;
    };
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const ctx = this.getContext('2d');
        if (ctx) {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            ctx.putImageData(imageData, 0, 0);
        }
        return originalToDataURL.apply(this, args);
    };
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
        const ctx = this.getContext('2d');
        if (ctx) {
            const imageData = ctx.getImageData(0, 0, this.width, this.height);
            ctx.putImageData(imageData, 0, 0);
        }
        return originalToBlob.call(this, callback, ...args);
    };
})();
`;

// Audio noise script: adds subtle noise to AudioContext fingerprint reads.
const AUDIO_NOISE_SCRIPT = `
(() => {
    const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        originalGetFloatFrequencyData.call(this, array);
        for (let i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * 0.001;
        }
    };
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function(channel) {
        const data = originalGetChannelData.call(this, channel);
        for (let i = 0; i < data.length; i++) {
            data[i] += (Math.random() - 0.5) * 0.0001;
        }
        return data;
    };
})();
`;

export class StealthBrowser {
    private config: AbrasioConfig;
    private _context: BrowserContext | null = null;
    private _userDataDir: string | null = null;
    private _isTempDir = false;

    constructor(config: AbrasioConfig) {
        this.config = config;
    }

    get context(): BrowserContext {
        if (!this._context) throw new Error('Browser not started');
        return this._context;
    }

    async start(): Promise<void> {
        // User data directory
        if (this.config.userDataDir) {
            this._userDataDir = this.config.userDataDir;
            fs.mkdirSync(this._userDataDir, { recursive: true });
        } else {
            this._userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abrasio_profile_'));
            this._isTempDir = true;
        }

        const args = this._getStealthArgs();

        const proxy = this.config.proxy
            ? typeof this.config.proxy === 'string'
                ? { server: this.config.proxy }
                : this.config.proxy
            : undefined;

        this._context = await chromium.launchPersistentContext(
            this._userDataDir,
            {
                channel: 'chrome',
                headless: this.config.headless,
                args,
                proxy,
                viewport: this.config.viewport ?? null,
                ignoreDefaultArgs: [
                    '--enable-automation',
                    '--disable-extensions',
                ],
                permissions: ['geolocation', 'notifications'],
            },
        );

        // Inject fingerprint noise scripts
        await this._injectFingerprintNoise();

        // Humanize all page interactions if requested
        if (this.config.humanize) {
            const { humanizeContext } = await import('../utils/human.js');
            await humanizeContext(this._context, {
                headless: this.config.headless,
                speedFactor: this.config.humanizeSpeed,
            });
        }
    }

    async close(): Promise<void> {
        if (this._context) {
            await this._context.close();
            this._context = null;
        }

        // Cleanup temp user data dir
        if (this._isTempDir && this._userDataDir) {
            try {
                fs.rmSync(this._userDataDir, { recursive: true, force: true });
            } catch {
                // ignore
            }
        }
    }

    async newContext(): Promise<BrowserContext> {
        if (!this._context) throw new Error('Browser not started');
        // With persistent context, return the main context.
        // Creating multiple contexts reduces stealth.
        return this._context;
    }

    async newPage(): Promise<Page> {
        if (!this._context) throw new Error('Browser not started');
        return await this._context.newPage();
    }

    private _getStealthArgs(): string[] {
        const fp = this.config.fingerprint;

        const args = [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-default-browser-check',
            '--disable-infobars',
            '--disable-popup-blocking',
            '--disable-component-update',
            '--disable-default-apps',
        ];

        // Fix User-Agent in headless mode (removes "HeadlessChrome")
        if (this.config.headless) {
            const system = os.platform();
            let userAgent: string;
            if (system === 'win32') {
                userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            } else if (system === 'darwin') {
                userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            } else {
                userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
            }
            args.push(`--user-agent=${userAgent}`);
        }

        // WebGL control
        if (!fp.webgl) {
            args.push('--disable-webgl', '--disable-webgl2');
        }

        // WebRTC IP leak protection
        if (!fp.webrtc) {
            args.push(
                '--enforce-webrtc-ip-permission-check',
                '--disable-webrtc-multiple-routes',
                '--disable-webrtc-hw-encoding',
            );
        }

        // Extra args
        if (this.config.extraArgs.length > 0) {
            args.push(...this.config.extraArgs);
        }

        return args;
    }

    private async _injectFingerprintNoise(): Promise<void> {
        if (!this._context) return;
        const fp = this.config.fingerprint;

        if (fp.canvasNoise) {
            await this._context.addInitScript({ content: CANVAS_NOISE_SCRIPT });
        }

        if (fp.audioNoise) {
            await this._context.addInitScript({ content: AUDIO_NOISE_SCRIPT });
        }
    }
}
