/**
 * HTTP client for Abrasio API.
 * Ported from Python abrasio/cloud/api_client.py
 */
import type { AbrasioConfig, ArtifactInfo, ProxyConfig } from '../types.js';
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
        /** Route to the home-server worker pool (hardest anti-bot targets only, e.g. Shopee). */
        hard?: boolean;
    }): Promise<Record<string, unknown>>;
    getSession(sessionId: string): Promise<Record<string, unknown>>;
    waitForReady(sessionId: string, timeoutSeconds?: number, pollInterval?: number): Promise<Record<string, unknown>>;
    finishSession(sessionId: string): Promise<Record<string, unknown>>;
    /**
     * List files downloaded by the browser during this session.
     *
     * Each entry has a presigned S3 URL (valid ~1h) the caller can fetch
     * directly — no further Abrasio API calls needed to get the bytes.
     */
    getSessionArtifacts(sessionId: string): Promise<ArtifactInfo[]>;
    private _requestWithRetry;
    private _handleResponse;
}
