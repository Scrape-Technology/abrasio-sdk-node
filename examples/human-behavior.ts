/**
 * Human behavior example: Simulate realistic user interactions.
 * Uses Bezier curve mouse movements, natural typing with typos, and smooth scrolling.
 */

import { Abrasio, humanClick, humanType, humanScroll, humanWait, simulateReading } from '../src/index.js';

async function main() {
    const abrasio = new Abrasio({
        headless: false,
        region: 'US',
    });

    try {
        await abrasio.start();
        const page = await abrasio.newPage();

        await page.goto('https://www.google.com');
        await humanWait(1, 3);

        // Type in the search box with human-like speed and occasional typos
        console.log('Typing search query...');
        await humanClick(page, { selector: 'textarea[name="q"]' });
        await humanType(page, 'patchright stealth browser automation', {
            mistakeProbability: 0.03,
        });

        await humanWait(0.5, 1.5);

        // Press Enter
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');

        // Simulate reading the results
        console.log('Reading results...');
        await simulateReading(page, { minSeconds: 3, maxSeconds: 6 });

        // Smooth scroll down
        await humanScroll(page, { direction: 'down', amount: 500 });
        await humanWait(1, 2);

        console.log('Done!');

    } finally {
        await abrasio.close();
    }
}

main().catch(console.error);
