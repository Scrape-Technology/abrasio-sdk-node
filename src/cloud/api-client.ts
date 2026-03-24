/**
 * HTTP client for Abrasio API.
 * Ported from Python abrasio/cloud/api_client.py
 */

import { randomUUID } from 'node:crypto';
import type { AbrasioConfig, ProxyConfig } from '../types.js';
import {
    AbrasioError,
    AuthenticationError,
    SessionError,
    InsufficientFundsError,
    RateLimitError,
    TimeoutError,
} from '../exceptions.js';

const MAX_RETRIES = 3;
const RETRY_BACKOFF_BASE = 1.0;
const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AbrasioAPIClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(config: AbrasioConfig) {
        this.baseUrl = config.apiUrl.replace(/\/$/, '');
        if (!config.apiKey) {
            throw new AbrasioError('API key is required. Set ABRASIO_API_KEY or pass apiKey to config.');
        }
        this.apiKey = config.apiKey;
    }

    async createSession(options: {
        url?: string;
        region?: string;
        profileId?: string;
        device?: string;
        mobileModel?: string;
        /** Proxy override — string "http://host:port" or structured object.
         *  Overrides the proxy stored in the selected profile's meta.json. */
        proxy?: string | ProxyConfig;
    } = {}): Promise<Record<string, unknown>> {
        const payload: Record<string, unknown> = {};
        payload.url = options.url ?? 'https://example.com';
        if (options.region) payload.region = options.region;
        if (options.profileId) payload.profile_id = options.profileId;
        if (options.device && options.device !== 'desktop') payload.device = options.device;
        if (options.mobileModel) payload.mobile_model = options.mobileModel;
        if (options.proxy) {
            payload.proxy = typeof options.proxy === 'string'
                ? { server: options.proxy }
                : options.proxy;
        }

        return this._requestWithRetry('POST', '/v1/browser/session/', payload);
    }

    async getSession(sessionId: string): Promise<Record<string, unknown>> {
        return this._requestWithRetry('GET', `/v1/browser/session/${sessionId}`);
    }

    async waitForReady(
        sessionId: string,
        timeoutSeconds = 60,
        pollInterval = 1.0,
    ): Promise<Record<string, unknown>> {
        let elapsed = 0;

        while (elapsed < timeoutSeconds) {
            const session = await this.getSession(sessionId);
            const status = session['status'] as string;

            if (status === 'READY') return session;

            if (status === 'FAILED' || status === 'ERROR') {
                const errorMsg = (session['error_message'] as string) ?? 'Unknown error';
                throw new SessionError(`Session failed: ${errorMsg}`, sessionId);
            }

            if (status === 'FINISHED') {
                throw new SessionError('Session already finished', sessionId);
            }

            await sleep(pollInterval * 1000);
            elapsed += pollInterval;
        }

        throw new TimeoutError(
            `Session ${sessionId} did not become ready within ${timeoutSeconds}s`,
            timeoutSeconds * 1000,
        );
    }

    async finishSession(sessionId: string): Promise<Record<string, unknown>> {
        return this._requestWithRetry('POST', `/v1/browser/session/${sessionId}/finish`);
    }

    private async _requestWithRetry(
        method: string,
        path: string,
        body?: Record<string, unknown>,
    ): Promise<Record<string, unknown>> {
        const url = `${this.baseUrl}${path}`;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const fetchOptions: RequestInit = {
                    method,
                    headers: {
                        'X-API-KEY': this.apiKey,
                        'Content-Type': 'application/json',
                        'User-Agent': 'abrasio-sdk-node/0.2.0',
                        'X-Request-ID': randomUUID(),
                    },
                };

                if (body && (method === 'POST' || method === 'PUT')) {
                    fetchOptions.body = JSON.stringify(body);
                }

                const response = await fetch(url, fetchOptions);

                if (!RETRYABLE_STATUS_CODES.has(response.status)) {
                    return this._handleResponse(response, await response.text());
                }

                // Retryable status
                if (attempt === MAX_RETRIES) {
                    return this._handleResponse(response, await response.text());
                }

                const retryAfter = response.headers.get('Retry-After');
                const wait = retryAfter
                    ? Math.min(parseFloat(retryAfter), 30.0)
                    : Math.min(RETRY_BACKOFF_BASE * (2 ** attempt), 15.0);

                console.warn(`[abrasio] ${path} returned ${response.status}, retrying in ${wait.toFixed(1)}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await sleep(wait * 1000);
            } catch (e) {
                if (e instanceof AbrasioError) throw e;
                lastError = e as Error;
                if (attempt === MAX_RETRIES) {
                    throw new TimeoutError(`Request to ${path} failed: ${lastError.message}`);
                }
                const wait = Math.min(RETRY_BACKOFF_BASE * (2 ** attempt), 15.0);
                await sleep(wait * 1000);
            }
        }

        throw lastError ?? new AbrasioError('Request failed after retries');
    }

    private _handleResponse(response: Response, text: string): Record<string, unknown> {
        if (response.status === 200) {
            try {
                return JSON.parse(text);
            } catch {
                throw new AbrasioError(`Invalid JSON in API response: ${text.slice(0, 200)}`);
            }
        }

        if (response.status === 401) throw new AuthenticationError();

        if (response.status === 402) {
            let balance: number | undefined;
            try {
                balance = JSON.parse(text).balance;
            } catch { /* ignore parse errors */ }
            throw new InsufficientFundsError(balance);
        }

        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            throw new RateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
        }

        if (response.status === 404) throw new SessionError('Session not found');

        let detail: string;
        try {
            const data = JSON.parse(text);
            detail = data.detail ?? 'Unknown error';
        } catch {
            detail = text;
        }

        throw new AbrasioError(`API error (${response.status}): ${detail}`);
    }
}
