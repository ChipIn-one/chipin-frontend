import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { localizedPath, SUPPORTED_LOCALES } from './src/i18n/locales';
import { appLoginUrl, PROD_APP_ORIGIN } from './src/lib/appOrigin';

// #941: /llms.txt (llmstxt.org) for AI assistants, served from public/ as a static file.
const LLMS_TXT = fileURLToPath(new URL('./public/llms.txt', import.meta.url));
const SITE = 'https://chipin.one';
/** The public site pages: every locale home and legal page (src/pages). */
const PAGE_SLUGS = ['', 'privacy', 'terms'];
const SITE_PAGES = SUPPORTED_LOCALES.flatMap(locale =>
    PAGE_SLUGS.map(slug => new URL(localizedPath(locale, slug), SITE).href),
);
/** The app entry the site header links to ("Open ChipIn"). */
const APP_ENTRY = appLoginUrl(PROD_APP_ORIGIN);

describe('public/llms.txt', () => {
    const text = existsSync(LLMS_TXT) ? readFileSync(LLMS_TXT, 'utf8') : '';
    const links = [...text.matchAll(/\]\(([^)]*)\)/g)].map(match => match[1] ?? '');

    test('exists and starts with the # ChipIn heading and a summary', () => {
        expect(existsSync(LLMS_TXT)).toBe(true);
        expect(text.split('\n').slice(0, 3)).toEqual([
            '# ChipIn',
            '',
            expect.stringMatching(/^> \S/),
        ]);
    });

    test('has the Features, Pricing and Pages sections', () => {
        expect(text).toMatch(/^## Features$/m);
        expect(text).toMatch(/^## Pricing$/m);
        expect(text).toMatch(/^## Pages$/m);
    });

    test('every link is an absolute URL of a real public page', () => {
        expect(links.length).toBeGreaterThan(0);
        expect(links.filter(link => !SITE_PAGES.includes(link) && link !== APP_ENTRY)).toEqual([]);
        // Every site page is listed.
        expect(SITE_PAGES.filter(page => !links.includes(page))).toEqual([]);
    });

    test('every listed site page has a source page', () => {
        for (const slug of PAGE_SLUGS.filter(Boolean)) {
            expect(existsSync(new URL(`./src/pages/${slug}.astro`, import.meta.url))).toBe(true);
            expect(existsSync(new URL(`./src/pages/[locale]/${slug}.astro`, import.meta.url))).toBe(
                true,
            );
        }
    });

    test('makes no rating, review or paid-plan claims', () => {
        expect(text).not.toMatch(/rating|review|receipt|attach|premium|\$\d|€\d/i);
    });
});
