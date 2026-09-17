/** Client-side resource-type blocking, shared by local and cloud browser modes. */
import type { BrowserContext } from 'patchright';
/**
 * Abort every request whose Playwright resourceType is in `resourceTypes`.
 *
 * Runs inside the browser (CDP Fetch domain), before any network connection
 * is made — so it reduces billed bytes_consumed in cloud mode, not just
 * local bandwidth. No-op if `resourceTypes` is empty/undefined.
 */
export declare function applyResourceBlocking(context: BrowserContext, resourceTypes: string[] | undefined): Promise<void>;
