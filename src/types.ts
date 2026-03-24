/**
 * Abrasio SDK Type Definitions
 * Ported from Python abrasio-sdk
 */

/** Structured proxy configuration. */
export interface ProxyConfig {
    server: string;
    username?: string;
    password?: string;
}

export interface FingerprintConfig {
    /** Enable WebGL APIs. Disabling is a strong bot signal. */
    webgl: boolean;
    /** Enable WebRTC. Set false with proxy to prevent IP leak. */
    webrtc: boolean;
    /** Add noise to canvas fingerprint reads. */
    canvasNoise: boolean;
    /** Add noise to AudioContext fingerprint reads. */
    audioNoise: boolean;
}

export interface AbrasioConfig {
    /** Abrasio API key for cloud mode. If absent, uses local mode. */
    apiKey?: string;
    /** Abrasio API URL. */
    apiUrl: string;
    /** Target URL (used for region inference in cloud mode). */
    url?: string;

    /** Run browser in headless mode. */
    headless: boolean;
    /** Proxy — URL string "http://user:pass@host:port" or structured object. */
    proxy?: string | ProxyConfig;
    /** Default timeout in milliseconds. */
    timeout: number;

    /** Enable stealth patches. */
    stealth: boolean;
    /** Browser locale (auto-configured from region). */
    locale?: string;
    /** Browser timezone (auto-configured from region). */
    timezone?: string;
    /** Browser viewport. null = no_viewport for better stealth. */
    viewport?: { width: number; height: number } | null;
    /** Persistent profile directory (local mode). */
    userDataDir?: string;

    /** Target region (e.g. "BR", "US"). Auto-configures locale/timezone. */
    region?: string;
    /** Persistent profile ID (cloud mode). */
    profileId?: string;
    /** Auto-configure locale/timezone from region. */
    autoConfigureRegion: boolean;
    /** Device type: "desktop" (default) or "mobile". */
    device: string;
    /** Mobile device preset name (e.g. "pixel-8", "iphone-15"). Used when device="mobile". */
    mobileModel?: string;

    /** Fingerprint protection settings (local mode only). */
    fingerprint: FingerprintConfig;

    /** Extra browser launch arguments. */
    extraArgs: string[];
    /** Enable debug logging. */
    debug: boolean;

    /** Humanize all browser interactions (mouse, keyboard, scroll). */
    humanize: boolean;
    /** Speed multiplier for humanized interactions (1.0 = normal). */
    humanizeSpeed: number;
}

export interface AbrasioOptions {
    /** AbrasioConfig or API key string. */
    config?: AbrasioConfig | string;
    /** Abrasio API key (enables cloud mode). */
    apiKey?: string;
    /** Run browser in headless mode. */
    headless?: boolean;
    /** Proxy — URL string or structured object. Overrides the proxy stored in the selected profile. */
    proxy?: string | ProxyConfig;
    /** Enable stealth patches. */
    stealth?: boolean;
    /** Target region. */
    region?: string;
    /** Persistent profile directory (local mode). */
    userDataDir?: string;
    /** Browser viewport. */
    viewport?: { width: number; height: number } | null;
    /** Extra browser launch arguments. */
    extraArgs?: string[];
    /** Persistent profile ID (cloud mode). */
    profileId?: string;
    /** Device type: "desktop" (default) or "mobile". */
    device?: string;
    /** Mobile device preset (e.g. "pixel-8", "iphone-15"). Used when device="mobile". */
    mobileModel?: string;
    /** Target URL. */
    url?: string;
    /** Abrasio API URL. */
    apiUrl?: string;
    /** Default timeout in ms. */
    timeout?: number;
    /** Fingerprint config overrides. */
    fingerprint?: Partial<FingerprintConfig>;
    /** Debug mode. */
    debug?: boolean;
    /** Humanize all browser interactions. */
    humanize?: boolean;
    /** Speed multiplier for humanized interactions (1.0 = normal). */
    humanizeSpeed?: number;
}

export const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
    webgl: true,
    webrtc: true,
    canvasNoise: false,
    audioNoise: false,
};

export function createConfig(options: AbrasioOptions = {}): AbrasioConfig {
    let apiKey = options.apiKey;

    if (typeof options.config === 'string') {
        apiKey = options.config;
    }

    if (options.config && typeof options.config === 'object') {
        return options.config;
    }

    const resolvedApiKey = apiKey ?? process.env['ABRASIO_API_KEY'];
    const resolvedApiUrl = options.apiUrl ?? process.env['ABRASIO_API_URL'] ?? 'https://abrasio-api.scrapetechnology.com';

    // Warn if an API key is provided but the URL still points at localhost —
    // this almost always means ABRASIO_API_URL was not set in the environment.
    if (resolvedApiKey && resolvedApiUrl.includes('localhost')) {
        console.warn(
            '[abrasio] WARNING: API key is set but apiUrl resolves to localhost. ' +
            'Set ABRASIO_API_URL (or pass apiUrl) to point at the Abrasio cloud endpoint.',
        );
    }

    return {
        apiKey: resolvedApiKey,
        apiUrl: resolvedApiUrl,
        url: options.url,
        headless: options.headless ?? false,
        proxy: options.proxy,
        timeout: options.timeout ?? 30000,
        stealth: options.stealth ?? true,
        locale: undefined,
        timezone: undefined,
        viewport: options.viewport === undefined ? null : options.viewport,
        userDataDir: options.userDataDir,
        region: options.region,
        profileId: options.profileId,
        autoConfigureRegion: true,
        device: options.device ?? 'desktop',
        mobileModel: options.mobileModel,
        fingerprint: { ...DEFAULT_FINGERPRINT_CONFIG, ...options.fingerprint },
        extraArgs: options.extraArgs ?? [],
        debug: options.debug ?? false,
        humanize: options.humanize ?? false,
        humanizeSpeed: options.humanizeSpeed ?? 1.0,
    };
}

export function isCloudMode(config: AbrasioConfig): boolean {
    return config.apiKey != null && config.apiKey.startsWith('sk_');
}

export function isLocalMode(config: AbrasioConfig): boolean {
    return !isCloudMode(config);
}
