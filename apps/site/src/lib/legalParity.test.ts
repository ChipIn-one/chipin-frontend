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

// Review C2-35, spec 04 row 04-3b2: the legal texts moved from the app pages to the `legal`
// collection word for word. The expected text is read from the old sources (the app pages and the
// i18n JSON they render), the actual text from a real `astro build` of the site: CI runs the site
// tests before the site build, so this suite builds into its own temp directory.
//
// It reads app files: apps/app/src/pages/PrivacyPage.tsx, TermsPage.tsx and
// apps/app/src/i18n/locales/<locale>/meta.json. An app-only change does not trigger the site CI
// step, so a change there is caught on the next site run. 04-5a removes these app pages and must
// remove or rework this test with them.
const SITE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = join(SITE_ROOT, '../..');
const SLUGS = ['privacy', 'terms'] as const;
type LegalSlug = (typeof SLUGS)[number];
const PAGES: Record<LegalSlug, string> = {
    privacy: join(REPO_ROOT, 'apps/app/src/pages/PrivacyPage.tsx'),
    terms: join(REPO_ROOT, 'apps/app/src/pages/TermsPage.tsx'),
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** The value at a dotted key, or `undefined` if it is not a string. */
const lookup = (tree: unknown, key: string): string | undefined => {
    let node = tree;

    for (const part of key.split('.')) {
        node = isRecord(node) ? node[part] : undefined;
    }
    return typeof node === 'string' ? node : undefined;
};

/** The string items of `const NAME = [...]` in a source file. */
const constArray = (source: string, name: string): string[] => {
    const body = new RegExp(`const ${name} = \\[([^\\]]*)\\]`).exec(source)?.[1] ?? '';

    return [...body.matchAll(/'([^']+)'/g)].map(match => match[1] ?? '');
};

type Token =
    | { kind: 'key'; key: string }
    | { kind: 'template'; key: string }
    | { kind: 'const'; name: string };

/** Every `const NAME = '…';` of a source file. */
const stringConstants = (source: string): Map<string, string> =>
    new Map(
        [...source.matchAll(/const ([A-Z_]+) = '([^']+)';/g)].map(match => [
            match[1] ?? '',
            match[2] ?? '',
        ]),
    );

/**
 * The texts an old page renders, in order: every `t('…')`, every `` t(`…${section}…`) `` expanded
 * over `PRIVACY_SECTIONS` (consecutive template calls form one `.map` item), and every JSX
 * `{CONSTANT}` that names a string constant (the contact email).
 */
const oldTexts = (source: string, dictionary: unknown): string[] => {
    const sections = constArray(source, 'PRIVACY_SECTIONS');
    const constants = stringConstants(source);
    const tokens: Token[] = [
        ...source.matchAll(/\bt\('([^']+)'\)|\bt\(`([^`]+)`\)|(?<![$\w])\{([A-Z_]+)\}/g),
    ].map(match =>
        match[1] !== undefined
            ? { kind: 'key', key: match[1] }
            : match[2] !== undefined
              ? { kind: 'template', key: match[2] }
              : { kind: 'const', name: match[3] ?? '' },
    );
    const texts: string[] = [];
    const resolve = (key: string): string => {
        const value = lookup(dictionary, key);

        if (value === undefined || value.trim() === '') {
            throw new Error(`old source key ${key} has no text`);
        }
        return value;
    };

    for (let index = 0; index < tokens.length;) {
        const token = tokens[index];

        if (token?.kind === 'template') {
            const group: string[] = [];

            for (let next = tokens[index]; next?.kind === 'template'; next = tokens[index]) {
                group.push(next.key);
                index += 1;
            }
            if (sections.length === 0) {
                throw new Error('a template key without PRIVACY_SECTIONS');
            }
            for (const section of sections) {
                texts.push(...group.map(key => resolve(key.replace('${sectionKey}', section))));
            }
            continue;
        }
        if (token?.kind === 'key') {
            texts.push(resolve(token.key));
        } else if (token?.kind === 'const') {
            const value = constants.get(token.name);

            if (value === undefined) {
                throw new Error(`{${token.name}} is not a string constant`);
            }
            texts.push(value);
        }
        index += 1;
    }
    return texts;
};

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

const normalize = (text: string): string => text.normalize('NFC').replace(/\s+/g, ' ').trim();

/** The visible text of `<main>`: tags become spaces, entities are decoded. */
const mainText = (html: string): string => {
    const main = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(html)?.[1];

    if (main === undefined) {
        throw new Error('the page has no <main>');
    }
    return normalize(
        decodeEntities(
            main.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]*>/g, ' '),
        ),
    );
};

/** Sentences: split after `.`, `!`, `?` or `:` followed by a space. */
const sentences = (text: string): string[] =>
    normalize(text)
        .split(/(?<=[.!?:])\s+/)
        .filter(sentence => sentence !== '');

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

describe('legal text parity with the old app pages (C2-35)', () => {
    test.each(CASES)('%s %s: every old sentence is in the built HTML, in order', (locale, slug) => {
        const dictionary = readJson(join(REPO_ROOT, `packages/i18n-content/common/${locale}.json`));
        const expected = oldTexts(readFileSync(PAGES[slug], 'utf8'), dictionary);
        const expectedSentences = expected.flatMap(sentences);
        const actual = mainText(builtPage(locale, slug));

        // Not vacuous: the old page renders a title, an intro and sections.
        expect(expected.length).toBeGreaterThanOrEqual(5);
        expect(expectedSentences.length).toBeGreaterThanOrEqual(expected.length);

        const missing = expectedSentences.filter(sentence => !actual.includes(sentence));

        expect(missing).toEqual([]);
        // Whole texts in the old order, and nothing else in <main>.
        expect(actual).toBe(normalize(expected.join(' ')));
    });

    test.each(SUPPORTED_LOCALES)('%s privacy: the contact email is a mailto link', locale => {
        const email = stringConstants(readFileSync(PAGES.privacy, 'utf8')).get(
            'PRIVACY_CONTACT_EMAIL',
        );

        expect(email).toMatch(/@/);
        expect(builtPage(locale, 'privacy')).toContain(`href="mailto:${email}"`);
    });
});

/** The `description` of a legal entry's frontmatter (a JSON string in the .md files). */
const frontmatterDescription = (locale: SupportedLocale, slug: LegalSlug): unknown => {
    const markdown = readFileSync(
        join(SITE_ROOT, `src/content/legal/${locale}/${slug}.md`),
        'utf8',
    );
    const value = /^description: (".*")$/m.exec(markdown)?.[1];

    return value === undefined ? undefined : JSON.parse(value);
};

describe('legal page metadata', () => {
    test.each(CASES)('%s %s: title, description, lang and hreflang', (locale, slug) => {
        const html = builtPage(locale, slug);
        const oldMeta = readJson(join(REPO_ROOT, `apps/app/src/i18n/locales/${locale}/meta.json`));
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
        expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(lookup(oldMeta, `${slug}.title`));
        const builtDescription = decodeEntities(attribute(description ?? '', 'content') ?? '');

        // Deliberate deviation: the old en terms description ("Read the interim terms for using
        // ChipIn", 39 characters) is below the schema minimum of 50, so en/terms.md has a longer
        // one. Every other page keeps the old app description.
        expect(builtDescription).toBe(
            locale === 'en' && slug === 'terms'
                ? frontmatterDescription(locale, slug)
                : lookup(oldMeta, `${slug}.description`),
        );
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
