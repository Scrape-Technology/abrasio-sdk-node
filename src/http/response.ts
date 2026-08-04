/**
 * Response wrapper for the stealth HTTP client.
 * Ported from Python abrasio/http/client.py (StealthResponse).
 *
 * Wraps the underlying `impers` response in a small, stable interface so callers
 * don't depend on the optional backend's types directly.
 */

import { HTTPError } from '../exceptions.js';

export interface StealthResponseInit {
    statusCode: number;
    headers: Record<string, string>;
    content: Buffer;
    url: string;
    encoding?: string;
}

export class StealthResponse {
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

    constructor(init: StealthResponseInit) {
        this.statusCode = init.statusCode;
        this.headers = init.headers;
        this.content = init.content;
        this.url = init.url;
        this.encoding = init.encoding || 'utf-8';
    }

    /** Decode the response body as text. */
    get text(): string {
        return this.content.toString(this.encoding as BufferEncoding);
    }

    /** True if the status is 2xx. */
    get ok(): boolean {
        return this.statusCode >= 200 && this.statusCode < 300;
    }

    /** Parse the response body as JSON. */
    json<T = unknown>(): T {
        return JSON.parse(this.text) as T;
    }

    /** Throw `HTTPError` if the response is not 2xx. */
    raiseForStatus(): void {
        if (!this.ok) {
            throw new HTTPError(`HTTP ${this.statusCode}: ${this.url}`, this.statusCode, this.url);
        }
    }
}
