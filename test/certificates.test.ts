/**
 * Tests for the client-certificate PKCS12 -> PEM workaround.
 *
 * Background: Node 18+ ships OpenSSL 3 with the legacy provider disabled, which
 * makes Node's native TLS stack reject PKCS12/PFX bundles encrypted with legacy
 * algorithms (RC2-40-CBC / 3DES) — common output from CA-issued certificates
 * including ICP-Brasil — with ERR_CRYPTO_UNSUPPORTED_OPERATION. The SDK works
 * around this by parsing the PFX with node-forge (pure JS) and converting to PEM.
 *
 * These tests generate a legacy-encrypted PFX at runtime with node-forge and
 * verify the SDK's `pfxToPem` produces PEM that Node's own TLS stack accepts —
 * i.e. the workaround is real, not aspirational.
 *
 * (The exact RC2-40-CBC rejection was also verified manually against Node 24:
 * `tls.createSecureContext({ pfx })` throws ERR_CRYPTO_UNSUPPORTED_OPERATION,
 * while `pfxToPem` -> PEM loads cleanly. RC2 generation needs an OpenSSL build
 * with the legacy provider, so this portable test uses 3DES, which node-forge
 * parses through the identical code path.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import forge from 'node-forge';

import { pfxToPem, buildClientCertificate } from '../src/utils/certificates.js';
import { AbrasioError } from '../src/exceptions.js';

/** Build a self-signed cert + key packaged as a legacy-3DES-encrypted PFX. */
function makeLegacyPfx(passphrase: string): Buffer {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 86400e3);
    const attrs = [{ name: 'commonName', value: 'icp-test' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, { algorithm: '3des' });
    return Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
}

test('pfxToPem converts a legacy-encrypted PFX to PEM that Node TLS accepts', () => {
    const pfx = makeLegacyPfx('secret');
    const { cert, key } = pfxToPem(pfx, 'secret');

    assert.match(cert.toString('utf8'), /-----BEGIN CERTIFICATE-----/);
    assert.match(key.toString('utf8'), /-----BEGIN (RSA )?PRIVATE KEY-----/);

    // The whole point: Node's own TLS stack must accept the converted material.
    assert.doesNotThrow(() => tls.createSecureContext({ cert, key }));
});

test('pfxToPem throws on the wrong passphrase', () => {
    const pfx = makeLegacyPfx('secret');
    assert.throws(() => pfxToPem(pfx, 'wrong-passphrase'));
});

test('buildClientCertificate requires an origin', () => {
    assert.throws(
        () => buildClientCertificate('', { pfx: Buffer.from('x') }),
        (err: unknown) => err instanceof AbrasioError,
    );
});

test('buildClientCertificate requires a PEM pair or a PFX', () => {
    assert.throws(
        () => buildClientCertificate('https://example.com', {}),
        (err: unknown) => err instanceof AbrasioError,
    );
});

test('buildClientCertificate accepts a PFX and preserves the passphrase', () => {
    const entry = buildClientCertificate('https://sso.acesso.gov.br', {
        pfx: Buffer.from('dummy'),
        passphrase: 'senha',
    });
    assert.equal(entry.origin, 'https://sso.acesso.gov.br');
    assert.ok(entry.pfx);
    assert.equal(entry.passphrase, 'senha');
});
