/**
 * Custom exceptions for Abrasio SDK.
 * Ported from Python abrasio/_exceptions.py
 */
export declare class AbrasioError extends Error {
    details: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class AuthenticationError extends AbrasioError {
    constructor(message?: string);
}
export declare class SessionError extends AbrasioError {
    sessionId?: string;
    constructor(message: string, sessionId?: string);
}
export declare class BrowserError extends AbrasioError {
    constructor(message: string);
}
export declare class TimeoutError extends AbrasioError {
    timeoutMs?: number;
    constructor(message?: string, timeoutMs?: number);
}
export declare class InsufficientFundsError extends AbrasioError {
    balance?: number;
    constructor(balance?: number);
}
export declare class RateLimitError extends AbrasioError {
    retryAfter?: number;
    constructor(retryAfter?: number);
}
export declare class BlockedError extends AbrasioError {
    url?: string;
    statusCode?: number;
    constructor(url?: string, statusCode?: number);
}
/**
 * Raised when the optional TLS-fingerprinting backend (`impers`) is not
 * installed. `StealthClient` needs it to spoof a real browser's TLS/JA3
 * fingerprint — Node's built-in `https`/`fetch` cannot. Mirrors the Python
 * SDK's `TLSFingerprintError` (there, curl_cffi is the missing dependency).
 */
export declare class TLSFingerprintError extends AbrasioError {
    constructor(message?: string);
}
/** Raised by `StealthResponse.raiseForStatus()` on a non-2xx response. */
export declare class HTTPError extends AbrasioError {
    statusCode?: number;
    url?: string;
    constructor(message: string, statusCode?: number, url?: string);
}
