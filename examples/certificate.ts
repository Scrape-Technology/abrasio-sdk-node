/**
 * Client certificate login example (e.g. ICP-Brasil digital certificate on gov.br).
 *
 * Demonstrates `Abrasio.routeWithCertificate(...)`: intercepts the certificate-login
 * request and replays it outside the browser using Node's `https` module (which
 * supports TLS client certificates, including PFX/PKCS12, natively), then fulfills
 * the route with the real response.
 *
 * Works in both local and cloud mode, unlike Patchright's native `clientCertificates`
 * option (local mode only) — see README.md "Client Certificates" section for why.
 *
 * Before running:
 *   export ABRASIO_API_KEY=sk_live_xxx
 *   export DEMO_CERT_PFX_PATH=/path/to/certificado.pfx
 *   export DEMO_CERT_PASSPHRASE=...
 */

import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Abrasio, buildClientCertificate } from '../src/index.js';

async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
        return await rl.question(question);
    } finally {
        rl.close();
    }
}

async function main() {
    const apiKey = process.env['ABRASIO_API_KEY'];
    if (!apiKey) {
        console.log('Set ABRASIO_API_KEY environment variable to use cloud mode');
        console.log('Example: export ABRASIO_API_KEY=sk_live_xxx');
        return;
    }

    const pfxPath = process.env['DEMO_CERT_PFX_PATH'] ?? await prompt('Path to the .pfx certificate: ');
    const passphrase = process.env['DEMO_CERT_PASSPHRASE'] ?? await prompt('Certificate passphrase: ');

    const cert = buildClientCertificate('https://login.esocial.gov.br', {
        pfxPath,
        passphrase,
    });

    const abrasio = new Abrasio({ apiKey, region: 'BR' });

    try {
        await abrasio.start();
        const page = await abrasio.newPage();
        await page.goto('https://login.esocial.gov.br/login.aspx');
        await page.locator('//*[@id="login-acoes"]/div[2]/p/button').click();
        await page.waitForLoadState();

        await page.evaluate('document.getElementById("operation-field").setAttribute("name", "operation");');
        await page.evaluate('document.getElementById("operation-field").setAttribute("value", "login-certificate");');

        const certificateButton = page.locator('//*[@id="login-certificate"]');
        const formAction = await certificateButton.getAttribute('formaction');
        await page.evaluate(`document.getElementById('loginData').setAttribute('action','${formAction}')`);

        // Intercept the certificate-login submission and replay it outside the
        // browser with the client certificate attached, via Node's https module.
        await abrasio.routeWithCertificate(page, formAction ?? '', cert);

        await certificateButton.click();
        await page.waitForLoadState();
        console.log('Logged in:', page.url());
    } finally {
        await abrasio.close();
    }
}

main().catch(console.error);
