import { describe, expect, test } from 'vitest';

import { ROOT_FAVICONS } from '../../integrations/rootFavicons';
import { SUPPORTED_LOCALES } from '../i18n/locales';
import { messages } from '../i18n/ui';

import { TELEGRAM_URL } from './siteLinks';
import { homeStructuredData, LOGO_PATH, serializeJsonLd } from './structuredData';

const SITE = new URL('https://chipin.one');

describe('homeStructuredData', () => {
    test.each(SUPPORTED_LOCALES)('%s: Organization, WebSite and WebApplication', locale => {
        const { meta } = messages(locale);
        const [organization, website, app] = homeStructuredData({ locale, site: SITE })['@graph'];

        expect(organization).toEqual({
            '@type': 'Organization',
            '@id': 'https://chipin.one/#organization',
            name: 'ChipIn',
            url: 'https://chipin.one/',
            logo: 'https://chipin.one/favicon.svg',
            sameAs: [TELEGRAM_URL],
        });
        expect(website).toMatchObject({
            '@type': 'WebSite',
            url: 'https://chipin.one/',
            inLanguage: ['en', 'ru'],
            publisher: { '@id': organization['@id'] },
        });
        expect(app).toMatchObject({
            '@type': 'WebApplication',
            applicationCategory: 'FinanceApplication',
            operatingSystem: 'Web',
            description: meta.home.description,
            inLanguage: ['en', 'ru'],
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        });
    });

    // One entity per @id: every locale gives the same url and inLanguage (only texts differ).
    test('the WebSite and WebApplication are the same on every locale home', () => {
        const nodes = SUPPORTED_LOCALES.map(locale => {
            const [, website, app] = homeStructuredData({ locale, site: SITE })['@graph'];

            return [website.url, website.inLanguage, app.url, app.inLanguage];
        });

        for (const node of nodes) {
            expect(node).toEqual([
                'https://chipin.one/',
                ['en', 'ru'],
                'https://chipin.one/',
                ['en', 'ru'],
            ]);
        }
    });

    test('the logo is a file the site serves at its root', () => {
        expect(ROOT_FAVICONS.map(({ file }) => `/${file}`)).toContain(LOGO_PATH);
    });

    test('has no ratings, reviews or FAQ', () => {
        const json = JSON.stringify(
            SUPPORTED_LOCALES.map(locale => homeStructuredData({ locale, site: SITE })),
        );

        expect(json).not.toMatch(/aggregateRating|review|FAQPage/i);
    });
});

describe('serializeJsonLd', () => {
    test('cannot close the script element or open a comment', () => {
        const json = serializeJsonLd({ text: '</script><!-- & -->' });

        expect(json).not.toMatch(/[<>&]/);
        expect(JSON.parse(json)).toEqual({ text: '</script><!-- & -->' });
    });

    test('escapes U+2028 and U+2029', () => {
        const json = serializeJsonLd({ text: 'a\u2028b\u2029c' });

        expect(json).toBe('{"text":"a\\u2028b\\u2029c"}');
        expect(JSON.parse(json)).toEqual({ text: 'a\u2028b\u2029c' });
    });
});
