/**
 * Response wrapper for the stealth HTTP client.
 * Ported from Python abrasio/http/client.py (StealthResponse).
 *
 * Wraps the underlying `impers` response in a small, stable interface so callers
 * don't depend on the optional backend's types directly.
 */
export interface StealthResponseInit {
    statusCode: number;
    headers: Record<string, string>;
    content: Buffer;
    url: string;
    encoding?: string;
}
export declare class StealthResponse {
    /** HTTP status code. */
    readonly statusCode: number;
    /** Response headers (lower-cased keys, as returned by the backend). */
    readonly headers: Record<string, string>;
    /** Raw response body. */
    readonly content: Buffer;
    /** Final URL (after redirects). */
    readonly url: string;
    /** Text encoding used by `text`. */
    readonly encoding: string;
    constructor(init: StealthResponseInit);
    /** Decode the response body as text. */
    get text(): string;
    /** True if the status is 2xx. */
    get ok(): boolean;
    /** Parse the response body as JSON. */
    json<T = unknown>(): T;
    /** Throw `HTTPError` if the response is not 2xx. */
    raiseForStatus(): void;
}
