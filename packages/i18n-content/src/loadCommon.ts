import type { SupportedLocale } from './locales';

// Vite bundles each matched JSON as its own lazy chunk; a bare specifier with a variable
// (`import(`@chipin/i18n-content/common/${lng}.json`)`) would stay a runtime import (spec 04 §2.10).
const COMMON = import.meta.glob<Record<string, unknown>>('../common/*.json', {
    import: 'default',
});

/** The `common` namespace of `lng`; an unknown locale rejects. */
const loadCommon = (lng: SupportedLocale): Promise<Record<string, unknown>> => {
    const load = COMMON[`../common/${lng}.json`];

    return load ? load() : Promise.reject(new Error(`No common locale: ${String(lng)}`));
};

export { loadCommon };
