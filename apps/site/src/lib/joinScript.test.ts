import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { describe, expect, test } from 'vitest';

import { cspScriptHashes, scriptHash } from '../../integrations/seoGuard';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../i18n/locales';

import type { InviteKind } from './inviteToken';
import { JOIN_SCRIPT } from './joinScript';

// The invite landing script (spec 04 §3.5, KB USR-080..USR-083) against a fake DOM with the
// markup of JoinPage.astro; the built pages are checked against the same markup at the end.

const APP_ORIGIN = 'https://app-dev.chipin.one';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';

class FakeElement {
    readonly attributes: Record<string, string>;
    readonly children: FakeElement[];
    hidden: boolean;
    href: string | undefined = undefined;

    constructor(attributes: Record<string, string>, children: FakeElement[] = []) {
        this.attributes = attributes;
        this.children = children;
        this.hidden = 'hidden' in attributes;
    }

    getAttribute(name: string): string | null {
        return this.attributes[name] ?? null;
    }

    querySelectorAll(selector: string): FakeElement[] {
        const [, name = '', value] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector) ?? [];
        const matches = (element: FakeElement) =>
            name in element.attributes &&
            (value === undefined || element.attributes[name] === value);

        return this.children.flatMap(child => [
            ...(matches(child) ? [child] : []),
            ...child.querySelectorAll(selector),
        ]);
    }

    querySelector(selector: string): FakeElement | null {
        return this.querySelectorAll(selector)[0] ?? null;
    }
}

/** The markup of JoinPage.astro: one block per locale, only the default one visible. */
const page = (kind: string) => {
    const blocks = SUPPORTED_LOCALES.map(locale => {
        const link = new FakeElement({ 'data-open-invite': '' });
        const valid = new FakeElement({ 'data-state': 'valid', hidden: '' }, [link]);
        const invalid = new FakeElement({ 'data-state': 'invalid', hidden: '' });
        const block = new FakeElement(
            { 'data-locale': locale, ...(locale === DEFAULT_LOCALE ? {} : { hidden: '' }) },
            [valid, invalid],
        );

        return { locale, block, link, valid, invalid };
    });
    const root = new FakeElement(
        { 'data-join': '', 'data-kind': kind, 'data-app-origin': APP_ORIGIN },
        blocks.map(({ block }) => block),
    );

    return { document: new FakeElement({}, [root]), blocks };
};

const run = ({
    kind = 'group',
    pathname,
    languages = ['en-US'],
}: {
    kind?: InviteKind;
    pathname: string;
    languages?: string[];
}) => {
    const { document, blocks } = page(kind);
    const location = { pathname };

    runInNewContext(JOIN_SCRIPT, {
        document,
        location,
        navigator: { languages, language: languages[0] },
    });
    const shown = blocks.filter(({ block }) => !block.hidden);

    expect(shown).toHaveLength(1);
    // USR-082: the script never navigates by itself.
    expect(location).toEqual({ pathname });
    const [current] = shown;

    if (current === undefined) {
        throw new Error('no visible block');
    }
    return {
        locale: current.locale,
        href: current.link.href,
        valid: !current.valid.hidden,
        broken: !current.invalid.hidden,
    };
};

describe('invite landing script', () => {
    test('USR-081 a valid group token gets the button to the app group join screen', () => {
        expect(run({ pathname: `/join/group/${TOKEN}` })).toEqual({
            locale: 'en',
            href: `${APP_ORIGIN}/group/join/${TOKEN}?locale=en`,
            valid: true,
            broken: false,
        });
    });

    test('USR-081 a valid friend token gets the button to the app friend invite screen', () => {
        expect(run({ kind: 'friend', pathname: `/join/friend/${TOKEN}/` }).href).toBe(
            `${APP_ORIGIN}/friends/join/${TOKEN}?locale=en`,
        );
    });

    test('USR-081 the token is checked decoded and passed URI-encoded', () => {
        const token = 'Ab-_CdEfGhIjKlMnOp';

        expect(run({ pathname: `/join/group/${encodeURIComponent(token)}` }).href).toBe(
            `${APP_ORIGIN}/group/join/${token}?locale=en`,
        );
    });

    test.each([
        ['too short', '/join/group/abc'],
        ['an encoded slash', `/join/group/${TOKEN}%2F`],
        ['a bad escape', `/join/group/${TOKEN}%E0%A4%A`],
        ['an extra segment', `/join/group/${TOKEN}/x`],
        ['no token', '/join/group'],
        ['no token, trailing slash', '/join/group/'],
        ['another kind than the page', `/join/friend/${TOKEN}`],
        ['a path outside /join', `/group/join/${TOKEN}`],
    ])('USR-082 %s shows the broken link without a button', (_, pathname) => {
        expect(run({ pathname })).toMatchObject({ valid: false, broken: true, href: undefined });
    });

    test.each([
        [['ru-RU', 'en'], 'ru'],
        [['RU'], 'ru'],
        [['de-DE', 'ru'], 'ru'],
        [['de-DE', 'fr'], 'en'],
        [[], 'en'],
    ])('USR-083 languages %j choose %s and pass it to the app', (languages, locale) => {
        const result = run({ pathname: `/join/group/${TOKEN}`, languages });

        expect(result.locale).toBe(locale);
        expect(result.href).toBe(`${APP_ORIGIN}/group/join/${TOKEN}?locale=${locale}`);
    });

    test('USR-081 the hash of the script is in the vercel.json CSP', () => {
        const config: unknown = JSON.parse(
            readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
        );

        expect(cspScriptHashes(config)).toContain(scriptHash(JOIN_SCRIPT));
    });
});

// The built pages (`npm run build -w @chipin/site`); CI builds the site before its tests, so there
// a missing dist fails instead of skipping.
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

describe.runIf(existsSync(join(DIST, 'index.html')) || process.env.CI === 'true')(
    'built invite pages',
    () => {
        test.each(['group', 'friend'])('USR-080 join/%s has the markup of the script', kind => {
            const html = readFileSync(join(DIST, `join/${kind}/index.html`), 'utf8');

            expect(html).toContain(`<script>${JOIN_SCRIPT}</script>`);
            expect(html).toContain(`data-kind="${kind}"`);
            expect(html).toMatch(/data-app-origin="https:\/\/[^"/]+"/);
            for (const locale of SUPPORTED_LOCALES) {
                expect(html).toContain(`data-locale="${locale}"`);
            }
            expect(html).toContain('data-state="valid"');
            expect(html).toContain('data-state="invalid"');
            expect(html).toContain('data-open-invite');
            // USR-084, USR-085.
            expect(html).not.toMatch(/_vercel\/(?:insights|speed-insights)/);
            expect(html).toMatch(/<meta name="robots" content="noindex"\s*\/?>/);
            expect(html).toMatch(/<meta name="referrer" content="no-referrer"\s*\/?>/);
        });

        test('USR-085 the sitemap lists no invite page', () => {
            const sitemaps = readdirSync(DIST).filter(file => /^sitemap.*\.xml$/.test(file));

            expect(sitemaps.length).toBeGreaterThan(0);
            for (const file of sitemaps) {
                expect(readFileSync(join(DIST, file), 'utf8')).not.toContain('/join/');
            }
        });

        test('USR-084 other pages load analytics after the redaction script', () => {
            const html = readFileSync(join(DIST, 'index.html'), 'utf8');
            const redaction = html.indexOf("w.va('beforeSend'");

            expect(redaction).toBeGreaterThan(0);
            expect(html.indexOf('/_vercel/insights/script.js')).toBeGreaterThan(redaction);
            expect(html.indexOf('/_vercel/speed-insights/script.js')).toBeGreaterThan(redaction);
        });
    },
);
