import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
    DEFAULT_LOCALE,
    localizedPath,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from '../i18n/locales';

// Review C2-35, spec 04 row 04-3b2: the legal pages are the `legal` collection. The checks read a
// real `astro build` of the site (CI runs the site tests before the site build, so this suite builds
// into its own temp directory) against the collection's own sources: the contact email is a mailto
// link, and the title, description, lang, hreflang and sitemap entries match the frontmatter. The
// old app pages (PrivacyPage.tsx, TermsPage.tsx) and their word-for-word parity check were removed
// in 04-5b.
const SITE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SLUGS = ['privacy', 'terms'] as const;
type LegalSlug = (typeof SLUGS)[number];

const ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

const decodeEntities = (html: string): string =>
    html.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
        if (name.startsWith('#x') || name.startsWith('#X')) {
            return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
        }
        if (name.startsWith('#')) {
            return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
        }
        return ENTITIES[name.toLowerCase()] ?? entity;
    });

const attribute = (tag: string, name: string): string | undefined =>
    new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

const headTags = (html: string, name: string): string[] =>
    [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => match[0]);

let dist = '';

/** Longest `astro build` the suite waits for; the hook timeout is a little longer. */
const BUILD_TIMEOUT_MS = 110_000;

beforeAll(() => {
    dist = mkdtempSync(join(tmpdir(), 'chipin-site-legal-'));
    const astroBin = join(
        dirname(createRequire(import.meta.url).resolve('astro/package.json')),
        'bin/astro.mjs',
    );
    const result = spawnSync(
        process.execPath,
        [astroBin, 'build', '--root', SITE_ROOT, '--outDir', dist],
        {
            encoding: 'utf8',
            env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
            timeout: BUILD_TIMEOUT_MS,
        },
    );

    if (result.error !== undefined || result.signal !== null || result.status !== 0) {
        throw new Error(
            `astro build failed (status ${result.status}, signal ${result.signal}, ` +
                `${result.error?.message ?? 'no spawn error'}; timeout ${BUILD_TIMEOUT_MS} ms)\n` +
                `${result.stdout}\n${result.stderr}`,
        );
    }
}, 120_000);

afterAll(() => {
    if (dist !== '') {
        rmSync(dist, { recursive: true, force: true });
    }
});

const builtPage = (locale: SupportedLocale, slug: LegalSlug): string => {
    const file = join(dist, localizedPath(locale, slug), 'index.html');

    expect(existsSync(file), `${file} is not in the build`).toBe(true);
    return readFileSync(file, 'utf8');
};

const CASES = SUPPORTED_LOCALES.flatMap(locale => SLUGS.map(slug => [locale, slug] as const));

/** The source of a legal entry (`src/content/legal/<locale>/<slug>.md`). */
const legalSource = (locale: SupportedLocale, slug: LegalSlug): string =>
    readFileSync(join(SITE_ROOT, `src/content/legal/${locale}/${slug}.md`), 'utf8');

/** A JSON string field of a legal entry's frontmatter. */
const frontmatter = (locale: SupportedLocale, slug: LegalSlug, field: string): unknown => {
    const value = new RegExp(`^${field}: (".*")$`, 'm').exec(legalSource(locale, slug))?.[1];

    return value === undefined ? undefined : JSON.parse(value);
};

describe('legal page content', () => {
    test.each(SUPPORTED_LOCALES)('%s privacy: the contact email is a mailto link', locale => {
        const email = /\]\(mailto:([^)\s]+)\)/.exec(legalSource(locale, 'privacy'))?.[1];

        expect(email).toMatch(/@/);
        expect(builtPage(locale, 'privacy')).toContain(`href="mailto:${email}"`);
    });
});

describe('legal page metadata', () => {
    test.each(CASES)('%s %s: title, description, lang and hreflang', (locale, slug) => {
        const html = builtPage(locale, slug);
        const description = headTags(html, 'meta').find(
            tag => attribute(tag, 'name') === 'description',
        );
        const alternates = Object.fromEntries(
            headTags(html, 'link')
                .filter(tag => attribute(tag, 'rel') === 'alternate')
                .map(tag => [attribute(tag, 'hreflang'), attribute(tag, 'href')]),
        );
        const absolute = (target: SupportedLocale): string =>
            new URL(localizedPath(target, slug), 'https://chipin.one').href;

        expect(attribute(headTags(html, 'html')[0] ?? '', 'lang')).toBe(locale);
        expect(decodeEntities(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '')).toBe(
            frontmatter(locale, slug, 'title'),
        );
        const builtDescription = decodeEntities(attribute(description ?? '', 'content') ?? '');

        expect(builtDescription).toBe(frontmatter(locale, slug, 'description'));
        expect(builtDescription.length).toBeGreaterThanOrEqual(50);
        expect(alternates).toEqual({
            ...Object.fromEntries(SUPPORTED_LOCALES.map(target => [target, absolute(target)])),
            'x-default': absolute(DEFAULT_LOCALE),
        });
    });

    test('the sitemap lists every legal page by its canonical URL', () => {
        const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
        const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);

        for (const [locale, slug] of CASES) {
            expect(locs).toContain(new URL(localizedPath(locale, slug), 'https://chipin.one').href);
        }
    });
});
