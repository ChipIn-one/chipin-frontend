import { getLocalUser } from 'helpers/localStorage';

const SUPPORTED_LOCALES = ['en', 'ru', 'es', 'pt-BR', 'pt-PT'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Set for O(1) lookup — avoids repeated Array.includes casts.
const SUPPORTED_LOCALES_SET: ReadonlySet<SupportedLocale> = new Set(SUPPORTED_LOCALES);

// Type predicate wraps the single necessary cast, keeping matchLocale cast-free.
const isSupportedLocale = (s: string): s is SupportedLocale => {
    return (SUPPORTED_LOCALES_SET as ReadonlySet<string>).has(s);
};

// Only fully-lowercased normalized forms are valid keys (e.g. 'us-en', not 'us-EN').
// This map handles structurally inverted or otherwise pathological tags.
const LOCALE_ALIASES: Readonly<Record<string, SupportedLocale>> = {
    'us-en': 'en',
};

// Language codes that need a non-trivial region fallback.
// Keys are restricted to the set of lang tags actually present in SUPPORTED_LOCALES
// or that appear as the language part of a supported locale.
type LanguageCode = 'en' | 'ru' | 'es' | 'pt';

// Applied only when neither exact match nor language match succeeds.
// E.g. 'pt' and 'pt-AO' both resolve to 'pt-BR'.
const LANGUAGE_FALLBACK: Readonly<Partial<Record<LanguageCode, SupportedLocale>>> = {
    pt: 'pt-BR',
};

/**
 * Normalizes a raw locale string to `lang` or `lang-REGION` canonical form.
 * - Replaces underscores with dashes
 * - Language → lowercase, Region → UPPERCASE
 * - Skips script/variant subtags (e.g. zh-Hans-CN → zh-CN)
 * Returns null for structurally invalid inputs.
 */
const normalizeLocale = (input: string): string | null => {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const parts = input.trim().replace(/_/g, '-').split('-');
    const lang = parts[0].toLowerCase();

    if (!/^[a-z]{2,3}$/.test(lang)) {
        return null;
    }

    // Intentional: scan all subtags after the language and return the first one that
    // looks like a region code (exactly 2–3 letters). This skips script tags (4 chars,
    // e.g. 'Hans') and numeric variants. Example: zh-Hans-CN → zh-CN.
    for (let i = 1; i < parts.length; i++) {
        const upper = parts[i].toUpperCase();

        if (/^[A-Z]{2,3}$/.test(upper)) {
            return `${lang}-${upper}`;
        }
    }

    return lang;
};

/**
 * Resolves a raw locale string to a SupportedLocale.
 *
 * Resolution order:
 * 1. Alias map   — lookup by lowercased normalized key (e.g. 'us-en' → 'en')
 * 2. Exact match — (e.g. 'pt-PT' → 'pt-PT')
 * 3. Language match — lang tag is itself supported (e.g. 'en-US' → 'en')
 * 4. Language fallback — map by lang tag (e.g. 'pt-AO' → 'pt-BR')
 * 5. null
 */
const matchLocale = (raw: string): SupportedLocale | null => {
    const normalized = normalizeLocale(raw);

    if (!normalized) {
        return null;
    }

    // normalized is guaranteed to be either:
    //   'lang'         (e.g. 'en', 'pt')
    //   'lang-REGION'  (e.g. 'pt-BR', 'en-US')

    // 1. Exact match — checked before aliases so a supported locale can never
    //    be silently redirected by an alias entry (alias only handles unsupported inputs).
    if (isSupportedLocale(normalized)) {
        return normalized;
    }

    // 2. Alias map — handles pathological inputs (e.g. 'us-en' → 'en').
    const aliased = LOCALE_ALIASES[normalized.toLowerCase()];

    if (aliased !== undefined) {
        return aliased;
    }

    const dashIndex = normalized.indexOf('-');
    const lang = dashIndex === -1 ? normalized : normalized.slice(0, dashIndex);

    // 3. Language match — 'en-US' → 'en'
    if (isSupportedLocale(lang)) {
        return lang;
    }

    // 4. Language fallback — 'pt-AO' → 'pt-BR'
    return LANGUAGE_FALLBACK[lang as LanguageCode] ?? null;
};

const getStoredLocale = (): string | null => {
    return getLocalUser()?.settings.language ?? null;
};

/**
 * Returns the browser's preferred language list.
 * Gracefully handles missing navigator (SSR / test environments).
 */
const getBrowserLanguages = (): readonly string[] => {
    if (typeof navigator === 'undefined') {
        return [];
    }

    if (navigator.languages && navigator.languages.length > 0) {
        return navigator.languages;
    }

    if (navigator.language && navigator.language.length > 0) {
        return [navigator.language];
    }

    return [];
};

const resolveBrowserLocale = (
    languages: readonly string[] = getBrowserLanguages(),
): SupportedLocale => {
    for (const language of languages) {
        const match = matchLocale(language);

        if (match !== null) {
            return match;
        }
    }

    return 'en';
};

/**
 * Resolves the active locale with priority:
 * 1. Valid locale in local user cache
 * 2. First matching browser language
 * 3. Fallback: 'en'
 *
 * Auto-detected locale is NOT persisted.
 */
const resolveLocale = (): SupportedLocale => {
    const stored = getStoredLocale();

    if (stored !== null) {
        const match = matchLocale(stored);

        if (match !== null) {
            return match;
        }
    }

    return resolveBrowserLocale();
};

// Monotonic counter — incremented on every call to onChangeLocale.
// Each call captures its own snapshot; only the last snapshot matches on resolution.
let _localeRequestId = 0;

/**
 * Applies the user-selected locale to i18n.
 * Dynamic import avoids circular dependency with i18n/index.ts.
 * Last-write-wins: each call increments a request id; superseded calls are dropped.
 */
const onChangeLocale = (locale: SupportedLocale): void => {
    const requestId = ++_localeRequestId;

    void import('i18n/index')
        .then(({ default: i18n }) => {
            if (_localeRequestId === requestId) {
                void i18n.changeLanguage(locale);
            }
        })
        .catch(() => {
            // i18n module failed to load. The store cache remains the source of truth.
        });
};

export {
    matchLocale,
    normalizeLocale,
    onChangeLocale,
    resolveBrowserLocale,
    resolveLocale,
    SUPPORTED_LOCALES,
};
export type { SupportedLocale };
