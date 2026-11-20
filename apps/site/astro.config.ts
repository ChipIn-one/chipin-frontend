import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import { seoGuard } from './integrations/seoGuard';
import { astroLocales, DEFAULT_LOCALE } from './src/i18n/locales';

const locales = astroLocales();

// Spec 04 §3.1–§3.2. Canonical and hreflang are always on https://chipin.one; the dev hosts get
// `X-Robots-Tag: noindex` from vercel.json instead.
export default defineConfig({
    site: 'https://chipin.one',
    output: 'static',
    trailingSlash: 'ignore',
    build: {
        format: 'directory',
        // The site CSP has `style-src 'self'`; seoGuard fails on inline styles.
        inlineStylesheets: 'never',
    },
    i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales,
        routing: { prefixDefaultLocale: false, redirectToDefaultLocale: false },
    },
    integrations: [
        sitemap({
            i18n: {
                defaultLocale: DEFAULT_LOCALE,
                locales: Object.fromEntries(locales.map(locale => [locale, locale])),
            },
            // Invite pages are noindex (§3.5); 404 is not a page of the site.
            filter: page => !/^https:\/\/chipin\.one\/(?:404\/?$|join\/)/.test(page),
        }),
        seoGuard({ vercelJson: new URL('./vercel.json', import.meta.url) }),
    ],
});
