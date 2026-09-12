/**
 * Tests for applyResourceBlocking — the client-side "cut bytes_consumed" helper.
 *
 * Uses a minimal fake BrowserContext/Route (no real browser) since the logic
 * under test is pure: register a route handler, then abort/continue based on
 * resourceType(). Confirms both branches and the no-op/unknown-type paths.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyResourceBlocking } from '../src/resource-blocking.js';

type RouteHandler = (route: FakeRoute) => unknown;

class FakeRoute {
    aborted = false;
    continued = false;
    constructor(private _resourceType: string) {}
    request() {
        return { resourceType: () => this._resourceType };
    }
    abort() {
        this.aborted = true;
    }
    continue() {
        this.continued = true;
    }
}

class FakeContext {
    handler: RouteHandler | null = null;
    async route(_pattern: string, handler: RouteHandler) {
        this.handler = handler;
    }
}

test('applyResourceBlocking aborts requests matching a blocked resourceType', async () => {
    const ctx = new FakeContext();
    await applyResourceBlocking(ctx as any, ['image', 'media', 'font']);

    const imageRoute = new FakeRoute('image');
    await ctx.handler!(imageRoute);
    assert.equal(imageRoute.aborted, true);
    assert.equal(imageRoute.continued, false);
});

test('applyResourceBlocking continues requests not in the blocklist', async () => {
    const ctx = new FakeContext();
    await applyResourceBlocking(ctx as any, ['image', 'media', 'font']);

    const docRoute = new FakeRoute('document');
    await ctx.handler!(docRoute);
    assert.equal(docRoute.continued, true);
    assert.equal(docRoute.aborted, false);
});

test('applyResourceBlocking is a no-op when resourceTypes is empty or undefined', async () => {
    const ctxEmpty = new FakeContext();
    await applyResourceBlocking(ctxEmpty as any, []);
    assert.equal(ctxEmpty.handler, null);

    const ctxUndef = new FakeContext();
    await applyResourceBlocking(ctxUndef as any, undefined);
    assert.equal(ctxUndef.handler, null);
});

test('applyResourceBlocking warns but still blocks on an unrecognized resource type', async () => {
    const ctx = new FakeContext();
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => warnings.push(msg);
    try {
        await applyResourceBlocking(ctx as any, ['image', 'totally-not-a-type']);
    } finally {
        console.warn = originalWarn;
    }

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /totally-not-a-type/);

    const imageRoute = new FakeRoute('image');
    await ctx.handler!(imageRoute);
    assert.equal(imageRoute.aborted, true);
});
