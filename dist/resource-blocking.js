/** Client-side resource-type blocking, shared by local and cloud browser modes. */
// Playwright/CDP resourceType() values. No built-in allowlist beyond
// validating the name isn't a typo — caller decides what's safe to block.
const KNOWN_RESOURCE_TYPES = new Set([
    'document', 'stylesheet', 'image', 'media', 'font', 'script',
    'texttrack', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest',
    'signedexchange', 'ping', 'cspviolationreport', 'preflight', 'other',
]);
/**
 * Abort every request whose Playwright resourceType is in `resourceTypes`.
 *
 * Runs inside the browser (CDP Fetch domain), before any network connection
 * is made — so it reduces billed bytes_consumed in cloud mode, not just
 * local bandwidth. No-op if `resourceTypes` is empty/undefined.
 */
export async function applyResourceBlocking(context, resourceTypes) {
    if (!resourceTypes || resourceTypes.length === 0)
        return;
    const blocked = new Set(resourceTypes);
    const unknown = [...blocked].filter((t) => !KNOWN_RESOURCE_TYPES.has(t));
    if (unknown.length > 0) {
        console.warn(`[abrasio] blockResources contains unrecognized resource type(s): ${unknown.join(', ')}. ` +
            `Known types: ${[...KNOWN_RESOURCE_TYPES].join(', ')}`);
    }
    await context.route('**/*', (route) => {
        if (blocked.has(route.request().resourceType())) {
            return route.abort();
        }
        return route.continue();
    });
}
