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
export declare const BrowserImpersonation: {
    readonly CHROME_142: "chrome142";
    readonly CHROME_136: "chrome136";
    readonly CHROME_131: "chrome131";
    readonly CHROME_124: "chrome124";
    readonly CHROME_120: "chrome120";
    readonly CHROME_119: "chrome119";
    readonly CHROME_116: "chrome116";
    readonly CHROME_110: "chrome110";
    readonly CHROME_107: "chrome107";
    readonly CHROME_104: "chrome104";
    readonly CHROME_101: "chrome101";
    readonly CHROME_100: "chrome100";
    readonly CHROME_131_ANDROID: "chrome131_android";
    readonly CHROME_99_ANDROID: "chrome99_android";
    readonly EDGE_101: "edge101";
    readonly EDGE_99: "edge99";
    readonly SAFARI_18_0: "safari180";
    readonly SAFARI_17_0: "safari170";
    readonly SAFARI_15_5: "safari155";
    readonly SAFARI_IOS_18_0: "safari180_ios";
    readonly SAFARI_IOS_17_0: "safari170_ios";
    readonly FIREFOX_135: "firefox135";
    readonly FIREFOX_133: "firefox133";
    /** Default — a recent stable Chrome verified to reproduce the exact Chrome JA4. */
    readonly DEFAULT: "chrome120";
    /** Pick a random recent Chrome version (for `rotateImpersonation`). */
    readonly randomChrome: () => string;
    /**
     * Recommended impersonation for a region. Chrome dominates worldwide, so this
     * currently returns a random recent Chrome everywhere — kept for parity with the
     * Python SDK and as an extension point for region-specific browser share.
     */
    readonly forRegion: (_region?: string) => string;
};
