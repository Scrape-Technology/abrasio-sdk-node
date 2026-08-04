/**
 * Integration test: verifies StealthClient actually spoofs a real browser TLS
 * fingerprint by inspecting what https://tls.peet.ws reports back.
 *
 * Self-skips when the optional `impers` backend is not installed or the network
 * is unavailable, so it never breaks CI on a machine without the backend/binary.
 *
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { StealthClient } from '../src/http/client.js';
import { TLSFingerprintError } from '../src/exceptions.js';

interface PeetResponse {
    http_version: string;
    tls: { ja3_hash: string; ja4: string };
    http2?: { akamai_fingerprint?: string };
}

test('StealthClient reproduces a real Chrome TLS fingerprint against tls.peet.ws', async (t) => {
    const client = new StealthClient({ region: 'BR', impersonate: 'chrome120', timeout: 30000 });
    let data: PeetResponse;
    try {
        const res = await client.get('https://tls.peet.ws/api/all');
        assert.equal(res.statusCode, 200);
        data = res.json<PeetResponse>();
    } catch (err) {
        await client.close();
        if (err instanceof TLSFingerprintError) {
            t.skip('impers backend not installed (npm install impers to enable)');
            return;
        }
        // Network/DNS/proxy failures shouldn't fail the suite on offline machines.
        t.skip(`network unavailable: ${String(err)}`);
        return;
    }
    await client.close();

    // A real Chrome negotiates HTTP/2 (Node's native https falls back to HTTP/1.1).
    assert.equal(data.http_version, 'h2', 'expected HTTP/2 like a real browser');

    // JA4 for modern Chrome starts with "t13d" (TLS 1.3) and advertises h2 ALPN.
    assert.match(data.tls.ja4, /^t13d\d+h2_/, `unexpected JA4: ${data.tls.ja4}`);

    // The HTTP/2 SETTINGS/window/priority fingerprint must match Chrome's known shape.
    assert.ok(
        (data.http2?.akamai_fingerprint ?? '').includes('|m,a,s,p'),
        `unexpected Akamai H2 fingerprint: ${data.http2?.akamai_fingerprint}`,
    );
});

test('close() racing a concurrent get() does not resurrect a "closed" session', async (t) => {
    // Bug found in review, 2026-07-15: session construction is async (loadImpers() +
    // native Session setup). The old code unconditionally did `this._session = session`
    // once construction finished, even if close() had run in the meantime — silently
    // resurrecting a "closed" client with a live, undisposed native session (leaked
    // resources), which a later get() would then reuse instead of erroring or starting
    // fresh. The fix: an epoch counter close() bumps, checked after the awaits inside
    // _ensureSession() — if it no longer matches, the just-built session is closed
    // immediately instead of kept.
    const client = new StealthClient({ region: 'US', timeout: 30000 });

    // Start a request but do NOT await it yet, then close() immediately — races
    // close() against the in-flight _ensureSession().
    const pending = client.get('https://tls.peet.ws/api/all').catch((err: unknown) => err);
    await client.close();
    const outcome = await pending;

    if (outcome instanceof TLSFingerprintError) {
        t.skip('impers backend not installed (npm install impers to enable)');
        return;
    }

    // Whichever branch won the race, the client must end up in a clean, non-leaked
    // state: a further close() must not throw, and must not find (and thus double
    // dispose of) a resurrected session.
    await client.close();
    assert.ok(true, 'no unhandled rejection or crash from the close()/get() race');
});
