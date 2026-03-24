/**
 * Region configuration: locale, timezone, and validation.
 * Ported from Python abrasio/utils/fingerprint.py
 */
export interface RegionConfig {
    locale: string;
    timezone: string;
    validTimezones: string[];
}
export declare const REGION_CONFIG: Record<string, RegionConfig>;
export declare function getRegionConfig(region: string): RegionConfig | undefined;
export declare function autoConfigureRegion(region: string, locale?: string, timezone?: string): {
    locale: string;
    timezone: string;
    warnings: string[];
};
export declare function listSupportedRegions(): string[];
