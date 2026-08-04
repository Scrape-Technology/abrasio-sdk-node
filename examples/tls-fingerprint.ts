/**
 * TLS fingerprinting (HTTP, no browser) example.
 *
 * Demonstrates `StealthClient` — a lightweight HTTP client that spoofs a real
 * browser's TLS/JA3 fingerprint via curl-impersonate (the `impers` package).
 * This is the "T0" fast path: fetch data from WAF/anti-bot-protected endpoints
 * without launching a full browser.
 *
 * Requires the optional backend:
 *   npm install impers
 *
 * Run:
 *   npm run example:tls
 */

import { StealthClient } from '../src/index.js';

async function main() {
    // 1. Prove the fingerprint is a real Chrome by inspecting tls.peet.ws.
    const client = new StealthClient({ region: 'BR', impersonate: 'chrome120' });
    try {
        const res = await client.get('https://tls.peet.ws/api/all');
        res.raiseForStatus();
        const data = res.json<any>();
        console.log('HTTP version :', data.http_version); // "h2" for Chrome
        console.log('JA3 hash     :', data.tls?.ja3_hash);
        console.log('JA4          :', data.tls?.ja4); // starts with t13d... for modern Chrome
        console.log('Akamai H2 fp :', data.http2?.akamai_fingerprint);
        console.log('Accept-Lang  :', data.http1?.headers ? '(see raw)' : 'pt-BR from region');
    } finally {
        await client.close();
    }

    // 2. One-off request with automatic cleanup.
    await using c = new StealthClient({ region: 'US' });
    const ip = await c.get('https://api.ipify.org?format=json');
    console.log('Your IP      :', ip.json());
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
