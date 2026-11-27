import { SUPPORTED_LOCALES, type SupportedLocale } from '../i18n/locales';
import { messages } from '../i18n/ui';

import { TELEGRAM_URL } from './siteLinks';

// #941: the home page JSON-LD (schema.org) for search engines and AI assistants. Only facts the
// landing states: the product is free ("Free forever · No credit card required"), it is a web app
// in every site locale, its one public profile is the footer's Telegram channel. No Premium offer
// (not public), no FAQPage (the home page shows no FAQ), no ratings or reviews.

/** The brand mark at a stable root path: emitted by integrations/rootFavicons.ts. */
const LOGO_PATH = '/favicon.svg';

interface Offer {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
}

interface Organization {
    '@type': 'Organization';
    '@id': string;
    name: string;
    url: string;
    logo: string;
    sameAs: string[];
}

interface WebSite {
    '@type': 'WebSite';
    '@id': string;
    name: string;
    url: string;
    inLanguage: SupportedLocale[];
    publisher: { '@id': string };
}

interface WebApplication {
    '@type': 'WebApplication';
    '@id': string;
    name: string;
    url: string;
    applicationCategory: 'FinanceApplication';
    operatingSystem: 'Web';
    description: string;
    inLanguage: SupportedLocale[];
    offers: Offer;
    publisher: { '@id': string };
}

interface HomeStructuredData {
    '@context': 'https://schema.org';
    '@graph': [Organization, WebSite, WebApplication];
}

/** The JSON-LD of a locale's home page; `site` is the canonical origin (https://chipin.one). */
const homeStructuredData = ({
    locale,
    site,
}: {
    locale: SupportedLocale;
    site: URL;
}): HomeStructuredData => {
    const { meta } = messages(locale);
    const root = new URL('/', site).href;
    const organizationId = `${root}#organization`;

    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': organizationId,
                name: meta.brand,
                url: root,
                logo: new URL(LOGO_PATH, site).href,
                sameAs: [TELEGRAM_URL],
            },
            {
                '@type': 'WebSite',
                '@id': `${root}#website`,
                name: meta.brand,
                url: root,
                inLanguage: [...SUPPORTED_LOCALES],
                publisher: { '@id': organizationId },
            },
            {
                '@type': 'WebApplication',
                '@id': `${root}#webapplication`,
                name: meta.brand,
                url: root,
                applicationCategory: 'FinanceApplication',
                operatingSystem: 'Web',
                description: meta.home.description,
                inLanguage: [...SUPPORTED_LOCALES],
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                publisher: { '@id': organizationId },
            },
        ],
    };
};

/**
 * JSON for a `<script type="application/ld+json">` body: `<`, `>` and `&` as `\u` escapes, so no
 * text can close the script or open a comment, and U+2028/U+2029, which older parsers reject.
 */
const serializeJsonLd = (data: unknown): string =>
    JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

export { homeStructuredData, LOGO_PATH, serializeJsonLd };
export type { HomeStructuredData };
