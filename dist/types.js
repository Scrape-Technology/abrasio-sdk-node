/**
 * Abrasio SDK Type Definitions
 * Ported from Python abrasio-sdk
 */
export const DEFAULT_FINGERPRINT_CONFIG = {
    webgl: true,
    webrtc: true,
    canvasNoise: false,
    audioNoise: false,
};
export function createConfig(options = {}) {
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
        console.warn('[abrasio] WARNING: API key is set but apiUrl resolves to localhost. ' +
            'Set ABRASIO_API_URL (or pass apiUrl) to point at the Abrasio cloud endpoint.');
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
export function isCloudMode(config) {
    return config.apiKey != null && config.apiKey.startsWith('sk_');
}
export function isLocalMode(config) {
    return !isCloudMode(config);
}
