import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import { seoGuard } from './integrations/seoGuard';
import { astroLocales, DEFAULT_LOCALE } from './src/i18n/locales';
import { canonicalSitemapUrl } from './src/lib/sitemapUrl';

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
    vite: {
        build: {
            // Astro inlines a small bundled `<script>` (e.g. the landing statistics) into the HTML;
            // the CSP would then need a build-dependent hash. Scripts stay files under `/_astro/`.
            assetsInlineLimit: (file: string) => (/\.m?js$/.test(file) ? false : undefined),
        },
    },
    // The legal texts must render word for word (C2-35): no curly quotes or dashes from `'`/`--`.
    markdown: { smartypants: false },
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
            // Sitemap URLs are the canonical ones: `/privacy`, not `/privacy/`.
            serialize: item => ({
                ...item,
                url: canonicalSitemapUrl(item.url),
                links: item.links?.map(link => ({ ...link, url: canonicalSitemapUrl(link.url) })),
            }),
        }),
        seoGuard({ vercelJson: new URL('./vercel.json', import.meta.url) }),
    ],
});
