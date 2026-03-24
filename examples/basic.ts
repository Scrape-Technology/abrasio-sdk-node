/**
 * Basic example: Local mode stealth browsing with Patchright.
 * No API key needed — runs Chrome locally with anti-detection.
 */

import { Abrasio } from '../src/index.js';

async function main() {
    const abrasio = new Abrasio({
        headless: false,
        region: 'BR',
    });

    try {
        await abrasio.start();
        console.log('Browser started (local mode)');

        const page = await abrasio.newPage();

        // Navigate to a fingerprint test site
        console.log('Navigating to creepjs...');
        await page.goto('https://abrahamjuliot.github.io/creepjs/');

        const title = await page.title();
        console.log(`Page title: ${title}`);

        // Wait for results
        await page.waitForTimeout(15000);

        // Screenshot
        await page.screenshot({ path: 'screenshot.png' });
        console.log('Screenshot saved to screenshot.png');

    } finally {
        await abrasio.close();
        console.log('Browser closed');
    }
}

main().catch(console.error);
