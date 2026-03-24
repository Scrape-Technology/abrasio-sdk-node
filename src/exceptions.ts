/**
 * Custom exceptions for Abrasio SDK.
 * Ported from Python abrasio/_exceptions.py
 */

export class AbrasioError extends Error {
    details: Record<string, unknown>;

    constructor(message: string, details: Record<string, unknown> = {}) {
        super(message);
        this.name = 'AbrasioError';
        this.details = details;
        Object.setPrototypeOf(this, AbrasioError.prototype);
    }
}

export class AuthenticationError extends AbrasioError {
    constructor(message = 'Invalid or missing API key') {
        super(message);
        this.name = 'AuthenticationError';
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

export class SessionError extends AbrasioError {
    sessionId?: string;

    constructor(message: string, sessionId?: string) {
        super(message, { sessionId });
        this.name = 'SessionError';
        this.sessionId = sessionId;
        Object.setPrototypeOf(this, SessionError.prototype);
    }
}

export class BrowserError extends AbrasioError {
    constructor(message: string) {
        super(message);
        this.name = 'BrowserError';
        Object.setPrototypeOf(this, BrowserError.prototype);
    }
}

export class TimeoutError extends AbrasioError {
    timeoutMs?: number;

    constructor(message = 'Operation timed out', timeoutMs?: number) {
        super(message, { timeoutMs });
        this.name = 'TimeoutError';
        this.timeoutMs = timeoutMs;
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}

export class InsufficientFundsError extends AbrasioError {
    balance?: number;

    constructor(balance?: number) {
        let message = 'Insufficient funds in your Abrasio account';
        if (balance != null) message += ` (current balance: $${balance.toFixed(2)})`;
        super(message, { balance });
        this.name = 'InsufficientFundsError';
        this.balance = balance;
        Object.setPrototypeOf(this, InsufficientFundsError.prototype);
    }
}

export class RateLimitError extends AbrasioError {
    retryAfter?: number;

    constructor(retryAfter?: number) {
        let message = 'Rate limit exceeded';
        if (retryAfter) message += `. Retry after ${retryAfter} seconds`;
        super(message, { retryAfter });
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}

export class BlockedError extends AbrasioError {
    url?: string;
    statusCode?: number;

    constructor(url?: string, statusCode?: number) {
        let message = 'Request was blocked by the target site';
        if (url) message += ` (${url})`;
        if (statusCode) message += ` - Status: ${statusCode}`;
        super(message, { url, statusCode });
        this.name = 'BlockedError';
        this.url = url;
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, BlockedError.prototype);
    }
}
