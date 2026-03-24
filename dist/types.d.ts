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
    viewport?: {
        width: number;
        height: number;
    } | null;
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
    viewport?: {
        width: number;
        height: number;
    } | null;
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
export declare const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig;
export declare function createConfig(options?: AbrasioOptions): AbrasioConfig;
export declare function isCloudMode(config: AbrasioConfig): boolean;
export declare function isLocalMode(config: AbrasioConfig): boolean;
