/**
 * Browser impersonation profiles for TLS fingerprinting.
 * Ported from Python abrasio/http/client.py (BrowserImpersonation).
 *
 * Each value is a `curl-impersonate` target string understood by the `impers`
 * backend (the Node analog of Python's curl_cffi). Selecting a profile makes the
 * outgoing request reproduce that browser's exact TLS ClientHello (JA3/JA4),
 * cipher ordering, HTTP/2 SETTINGS frame and default header order.
 */
/**
 * Named browser impersonation targets plus helpers.
 *
 * `impersonate` is typed as a plain `string` throughout so any target the
 * installed `impers`/curl-impersonate build supports (e.g. "chrome131",
 * "firefox133", "safari180") can be passed directly, not just the ones named here.
 */
export const BrowserImpersonation = {
    // Chrome (most common — recommended for most sites)
    CHROME_142: 'chrome142',
    CHROME_136: 'chrome136',
    CHROME_131: 'chrome131',
    CHROME_124: 'chrome124',
    CHROME_120: 'chrome120',
    CHROME_119: 'chrome119',
    CHROME_116: 'chrome116',
    CHROME_110: 'chrome110',
    CHROME_107: 'chrome107',
    CHROME_104: 'chrome104',
    CHROME_101: 'chrome101',
    CHROME_100: 'chrome100',
    // Chrome Android
    CHROME_131_ANDROID: 'chrome131_android',
    CHROME_99_ANDROID: 'chrome99_android',
    // Edge (good for Microsoft-related sites)
    EDGE_101: 'edge101',
    EDGE_99: 'edge99',
    // Safari (good for Apple-related sites)
    SAFARI_18_0: 'safari180',
    SAFARI_17_0: 'safari170',
    SAFARI_15_5: 'safari155',
    // Safari iOS
    SAFARI_IOS_18_0: 'safari180_ios',
    SAFARI_IOS_17_0: 'safari170_ios',
    // Firefox
    FIREFOX_135: 'firefox135',
    FIREFOX_133: 'firefox133',
    /** Default — a recent stable Chrome verified to reproduce the exact Chrome JA4. */
    DEFAULT: 'chrome120',
    /** Pick a random recent Chrome version (for `rotateImpersonation`). */
    randomChrome() {
        const versions = [
            'chrome142', 'chrome136', 'chrome131', 'chrome124', 'chrome120', 'chrome119',
        ];
        return versions[Math.floor(Math.random() * versions.length)];
    },
    /**
     * Pick a random target across desktop browser *families*, not just Chrome
     * versions — real traffic to any site is a mix of Chrome/Safari/Edge/Firefox,
     * and a pool that only ever produces Chrome is itself a (mild) fingerprint:
     * every "different" request still looks like the same browser vendor.
     *
     * Weighted roughly toward real-world desktop share (Chrome most common, then
     * Safari, Edge and Firefox trailing) via duplicate entries rather than a
     * precise weighted-random model — good enough for diversity, not a claim of
     * exact market-share percentages.
     */
    randomBrowser() {
        const pool = [
            // Chrome — weighted heaviest
            'chrome142', 'chrome142', 'chrome142', 'chrome136', 'chrome136', 'chrome131', 'chrome124',
            // Safari — second most common on the open desktop web
            'safari180', 'safari180', 'safari170',
            // Edge
            'edge101',
            // Firefox
            'firefox135',
        ];
        return pool[Math.floor(Math.random() * pool.length)];
    },
    /**
     * Recommended impersonation for a region. No solid per-region browser-share
     * data is wired in here (the previous version's region branches were dead —
     * every path returned randomChrome() regardless of region), so this is
     * honestly just randomBrowser() everywhere for now. Real per-region weighting
     * is a legitimate future improvement, not something to fake with invented
     * percentages.
     */
    forRegion(_region) {
        return BrowserImpersonation.randomBrowser();
    },
};
