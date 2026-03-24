/**
 * Region configuration: locale, timezone, and validation.
 * Ported from Python abrasio/utils/fingerprint.py
 */
export const REGION_CONFIG = {
    US: { locale: 'en-US', timezone: 'America/New_York', validTimezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'] },
    BR: { locale: 'pt-BR', timezone: 'America/Sao_Paulo', validTimezones: ['America/Sao_Paulo', 'America/Manaus', 'America/Bahia', 'America/Fortaleza', 'America/Belem', 'America/Recife'] },
    GB: { locale: 'en-GB', timezone: 'Europe/London', validTimezones: ['Europe/London'] },
    DE: { locale: 'de-DE', timezone: 'Europe/Berlin', validTimezones: ['Europe/Berlin'] },
    FR: { locale: 'fr-FR', timezone: 'Europe/Paris', validTimezones: ['Europe/Paris'] },
    ES: { locale: 'es-ES', timezone: 'Europe/Madrid', validTimezones: ['Europe/Madrid', 'Atlantic/Canary'] },
    IT: { locale: 'it-IT', timezone: 'Europe/Rome', validTimezones: ['Europe/Rome'] },
    PT: { locale: 'pt-PT', timezone: 'Europe/Lisbon', validTimezones: ['Europe/Lisbon', 'Atlantic/Azores'] },
    NL: { locale: 'nl-NL', timezone: 'Europe/Amsterdam', validTimezones: ['Europe/Amsterdam'] },
    SE: { locale: 'sv-SE', timezone: 'Europe/Stockholm', validTimezones: ['Europe/Stockholm'] },
    NO: { locale: 'nb-NO', timezone: 'Europe/Oslo', validTimezones: ['Europe/Oslo'] },
    DK: { locale: 'da-DK', timezone: 'Europe/Copenhagen', validTimezones: ['Europe/Copenhagen'] },
    FI: { locale: 'fi-FI', timezone: 'Europe/Helsinki', validTimezones: ['Europe/Helsinki'] },
    PL: { locale: 'pl-PL', timezone: 'Europe/Warsaw', validTimezones: ['Europe/Warsaw'] },
    IE: { locale: 'en-IE', timezone: 'Europe/Dublin', validTimezones: ['Europe/Dublin'] },
    CH: { locale: 'de-CH', timezone: 'Europe/Zurich', validTimezones: ['Europe/Zurich'] },
    AT: { locale: 'de-AT', timezone: 'Europe/Vienna', validTimezones: ['Europe/Vienna'] },
    CZ: { locale: 'cs-CZ', timezone: 'Europe/Prague', validTimezones: ['Europe/Prague'] },
    HU: { locale: 'hu-HU', timezone: 'Europe/Budapest', validTimezones: ['Europe/Budapest'] },
    RO: { locale: 'ro-RO', timezone: 'Europe/Bucharest', validTimezones: ['Europe/Bucharest'] },
    GR: { locale: 'el-GR', timezone: 'Europe/Athens', validTimezones: ['Europe/Athens'] },
    TR: { locale: 'tr-TR', timezone: 'Europe/Istanbul', validTimezones: ['Europe/Istanbul'] },
    RU: { locale: 'ru-RU', timezone: 'Europe/Moscow', validTimezones: ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok'] },
    UA: { locale: 'uk-UA', timezone: 'Europe/Kyiv', validTimezones: ['Europe/Kyiv'] },
    CA: { locale: 'en-CA', timezone: 'America/Toronto', validTimezones: ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax'] },
    MX: { locale: 'es-MX', timezone: 'America/Mexico_City', validTimezones: ['America/Mexico_City', 'America/Tijuana', 'America/Cancun'] },
    AR: { locale: 'es-AR', timezone: 'America/Argentina/Buenos_Aires', validTimezones: ['America/Argentina/Buenos_Aires'] },
    CL: { locale: 'es-CL', timezone: 'America/Santiago', validTimezones: ['America/Santiago'] },
    CO: { locale: 'es-CO', timezone: 'America/Bogota', validTimezones: ['America/Bogota'] },
    PE: { locale: 'es-PE', timezone: 'America/Lima', validTimezones: ['America/Lima'] },
    JP: { locale: 'ja-JP', timezone: 'Asia/Tokyo', validTimezones: ['Asia/Tokyo'] },
    KR: { locale: 'ko-KR', timezone: 'Asia/Seoul', validTimezones: ['Asia/Seoul'] },
    CN: { locale: 'zh-CN', timezone: 'Asia/Shanghai', validTimezones: ['Asia/Shanghai'] },
    TW: { locale: 'zh-TW', timezone: 'Asia/Taipei', validTimezones: ['Asia/Taipei'] },
    HK: { locale: 'zh-HK', timezone: 'Asia/Hong_Kong', validTimezones: ['Asia/Hong_Kong'] },
    SG: { locale: 'en-SG', timezone: 'Asia/Singapore', validTimezones: ['Asia/Singapore'] },
    AU: { locale: 'en-AU', timezone: 'Australia/Sydney', validTimezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Brisbane'] },
    NZ: { locale: 'en-NZ', timezone: 'Pacific/Auckland', validTimezones: ['Pacific/Auckland'] },
    ZA: { locale: 'en-ZA', timezone: 'Africa/Johannesburg', validTimezones: ['Africa/Johannesburg'] },
    IN: { locale: 'en-IN', timezone: 'Asia/Kolkata', validTimezones: ['Asia/Kolkata'] },
    AE: { locale: 'ar-AE', timezone: 'Asia/Dubai', validTimezones: ['Asia/Dubai'] },
    SA: { locale: 'ar-SA', timezone: 'Asia/Riyadh', validTimezones: ['Asia/Riyadh'] },
};
export function getRegionConfig(region) {
    return REGION_CONFIG[region.toUpperCase()];
}
export function autoConfigureRegion(region, locale, timezone) {
    const config = getRegionConfig(region);
    const warnings = [];
    if (!config) {
        warnings.push(`Unknown region '${region}'. Using defaults.`);
        return { locale: locale ?? 'en-US', timezone: timezone ?? 'America/New_York', warnings };
    }
    const finalLocale = locale ?? config.locale;
    const finalTimezone = timezone ?? config.timezone;
    if (timezone && !config.validTimezones.includes(timezone)) {
        warnings.push(`Timezone '${timezone}' is unusual for region '${region}'.`);
    }
    return { locale: finalLocale, timezone: finalTimezone, warnings };
}
export function listSupportedRegions() {
    return Object.keys(REGION_CONFIG).sort();
}
