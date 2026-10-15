import { SUPPORTED_LOCALES, type SupportedLocale } from 'constants/locales';

// Single source of truth for indexable pages and their released locale paths.
const PUBLIC_PAGES = [
    { id: 'home', segment: '', metaKey: 'home' },
    { id: 'privacy', segment: 'privacy', metaKey: 'privacy' },
    { id: 'terms', segment: 'terms', metaKey: 'terms' },
] as const;
const PUBLIC_HOME_PAGE = PUBLIC_PAGES[0].id;

const LOCALE_PREFIX: Record<SupportedLocale, string> = {
    en: '', ru: '/ru', es: '/es', 'pt-BR': '/pt-br', 'pt-PT': '/pt-pt',
};
const PUBLIC_ROUTE_ENTRIES = SUPPORTED_LOCALES.flatMap(locale =>
    PUBLIC_PAGES.map(page => {
        const prefix = LOCALE_PREFIX[locale];
        const path = page.segment ? prefix + '/' + page.segment : prefix + '/';
        return { page: page.id, locale, path, metaKey: page.metaKey };
    }),
);
export { LOCALE_PREFIX, PUBLIC_HOME_PAGE, PUBLIC_PAGES, PUBLIC_ROUTE_ENTRIES };
