/**
 * HTTP client for Abrasio API.
 * Ported from Python abrasio/cloud/api_client.py
 */
import type { AbrasioConfig, ProxyConfig } from '../types.js';
export declare class AbrasioAPIClient {
    private baseUrl;
    private apiKey;
    constructor(config: AbrasioConfig);
    createSession(options?: {
        url?: string;
        region?: string;
        profileId?: string;
        device?: string;
        mobileModel?: string;
        /** Proxy override — string "http://host:port" or structured object.
         *  Overrides the proxy stored in the selected profile's meta.json. */
        proxy?: string | ProxyConfig;
    }): Promise<Record<string, unknown>>;
    getSession(sessionId: string): Promise<Record<string, unknown>>;
    waitForReady(sessionId: string, timeoutSeconds?: number, pollInterval?: number): Promise<Record<string, unknown>>;
    finishSession(sessionId: string): Promise<Record<string, unknown>>;
    private _requestWithRetry;
    private _handleResponse;
}
