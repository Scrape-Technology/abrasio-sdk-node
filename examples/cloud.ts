/**
 * Cloud mode example: Use Abrasio API for managed browser sessions.
 * Requires an API key (set ABRASIO_API_KEY or pass apiKey option).
 */

import { Abrasio } from '../src/index.js';

async function main() {
    const abrasio = new Abrasio({
        apiKey: process.env['ABRASIO_API_KEY'] ?? "{your api key here}",
        region: 'BR',
        url: 'https://books.toscrape.com',
        headless: false,
    });

    try {
        console.log('Starting cloud session...');
        await abrasio.start();

        if (abrasio.liveViewUrl) {
            console.log(`Live view: ${abrasio.liveViewUrl}`);
        }

        const page = await abrasio.newPage();
        await page.goto('https://books.toscrape.com');

        const title = await page.title();
        console.log(`Page title: ${title}`);

        const page2 = await abrasio.newPage();
        await page2.goto('https://books.toscrape.com/catalogue/category/books/travel_2/index.html');
        const title2 = await page2.title();
        console.log(`Page title: ${title2}`);

    } finally {
        await abrasio.close();
        console.log('Session finished');
    }
}

main().catch(console.error);
