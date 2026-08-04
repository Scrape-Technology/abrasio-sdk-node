/**
 * Response wrapper for the stealth HTTP client.
 * Ported from Python abrasio/http/client.py (StealthResponse).
 *
 * Wraps the underlying `impers` response in a small, stable interface so callers
 * don't depend on the optional backend's types directly.
 */
import { HTTPError } from '../exceptions.js';
export class StealthResponse {
    /** HTTP status code. */
    statusCode;
    /** Response headers (lower-cased keys, as returned by the backend). */
    headers;
    /** Raw response body. */
    content;
    /** Final URL (after redirects). */
    url;
    /** Text encoding used by `text`. */
    encoding;
    constructor(init) {
        this.statusCode = init.statusCode;
        this.headers = init.headers;
        this.content = init.content;
        this.url = init.url;
        this.encoding = init.encoding || 'utf-8';
    }
    /** Decode the response body as text. */
    get text() {
        return this.content.toString(this.encoding);
    }
    /** True if the status is 2xx. */
    get ok() {
        return this.statusCode >= 200 && this.statusCode < 300;
    }
    /** Parse the response body as JSON. */
    json() {
        return JSON.parse(this.text);
    }
    /** Throw `HTTPError` if the response is not 2xx. */
    raiseForStatus() {
        if (!this.ok) {
            throw new HTTPError(`HTTP ${this.statusCode}: ${this.url}`, this.statusCode, this.url);
        }
    }
}
