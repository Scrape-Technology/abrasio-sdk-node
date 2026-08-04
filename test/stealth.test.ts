/**
 * Unit tests for the stealth HTTP client's pure logic (no network, no backend).
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { StealthResponse } from '../src/http/response.js';
import { BrowserImpersonation } from '../src/http/impersonation.js';
import { HTTPError } from '../src/exceptions.js';
import { acceptLanguageForLocale } from '../src/http/client.js';
import { REGION_CONFIG } from '../src/region-defaults.js';

test('BrowserImpersonation.DEFAULT matches the Python SDK default', () => {
    assert.equal(BrowserImpersonation.DEFAULT, 'chrome120');
    assert.equal(BrowserImpersonation.CHROME_120, 'chrome120');
});

test('BrowserImpersonation.randomChrome returns a chrome target', () => {
    for (let i = 0; i < 20; i++) {
        assert.match(BrowserImpersonation.randomChrome(), /^chrome\d+$/);
    }
});

test('BrowserImpersonation.forRegion returns a usable target for any region', () => {
    assert.match(BrowserImpersonation.forRegion('BR'), /^chrome\d+$/);
    assert.match(BrowserImpersonation.forRegion(undefined), /^chrome\d+$/);
});

test('StealthResponse decodes text and reports ok for 2xx', () => {
    const res = new StealthResponse({
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        content: Buffer.from('hello world', 'utf-8'),
        url: 'https://example.com',
    });
    assert.equal(res.text, 'hello world');
    assert.equal(res.ok, true);
    assert.equal(res.statusCode, 200);
});

test('StealthResponse.json parses the body', () => {
    const res = new StealthResponse({
        statusCode: 200,
        headers: {},
        content: Buffer.from(JSON.stringify({ a: 1, b: 'x' })),
        url: 'https://example.com',
    });
    assert.deepEqual(res.json(), { a: 1, b: 'x' });
});

test('StealthResponse.raiseForStatus throws HTTPError on non-2xx', () => {
    const res = new StealthResponse({
        statusCode: 403,
        headers: {},
        content: Buffer.from('forbidden'),
        url: 'https://waf.example.com',
    });
    assert.equal(res.ok, false);
    assert.throws(() => res.raiseForStatus(), (err: unknown) => {
        assert.ok(err instanceof HTTPError);
        assert.equal((err as HTTPError).statusCode, 403);
        return true;
    });
});

// Bug found in review, 2026-07-15: Accept-Language used to come from a hand-maintained
// table covering only 11 of the ~40 regions in region-defaults.ts's REGION_CONFIG —
// every other region silently fell back to en-US, itself a fingerprint mismatch.
// acceptLanguageForLocale() derives from REGION_CONFIG instead, covering all of them.

test('acceptLanguageForLocale matches the exact values previously hardcoded (no regression)', () => {
    assert.equal(acceptLanguageForLocale('en-US'), 'en-US,en;q=0.9');
    assert.equal(acceptLanguageForLocale('pt-BR'), 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7');
    assert.equal(acceptLanguageForLocale('de-DE'), 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7');
    assert.equal(acceptLanguageForLocale('zh-CN'), 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7');
});

test('acceptLanguageForLocale covers every region in REGION_CONFIG (not just the old 11)', () => {
    // Regions the old hand-maintained table silently fell back to en-US for.
    const previouslyMissing = ['MX', 'AR', 'CA', 'AU', 'RU', 'IN', 'TR', 'AE'];
    for (const region of previouslyMissing) {
        const locale = REGION_CONFIG[region].locale;
        const header = acceptLanguageForLocale(locale);
        assert.ok(header.startsWith(locale), `${region}: expected header to start with ${locale}, got ${header}`);
        assert.notEqual(header, 'en-US,en;q=0.9', `${region}: still falling back to en-US`);
    }
    // Every configured region produces a well-formed header, no exceptions.
    for (const region of Object.keys(REGION_CONFIG)) {
        assert.match(acceptLanguageForLocale(REGION_CONFIG[region].locale), /^[a-z]{2}-[A-Z]{2},/);
    }
});
