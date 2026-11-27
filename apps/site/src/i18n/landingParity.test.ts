import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { PREVIEW_MEMBERS } from '../lib/landingPreview';

import { SUPPORTED_LOCALES, type SupportedLocale } from './locales';

// Spec 04 row 04-3b1: the site home has the `<title>`, description and landing texts of the app
// landing (apps/app/src/pages/HomePage.tsx with features/landing/*), checked against the app's
// current JSON on disk. It reads app files: apps/app/src/i18n/locales/<locale>/{meta,landing,
// dashboard,group,activity}.json and packages/i18n-content/common/<locale>.json. An app-only change
// does not trigger the site CI step, so a change there is caught on the next site run. 04-5a removes
// the app landing and must remove or rework this test with it.
const REPO = new URL('../../../../', import.meta.url);
const SITE_LOCALES = new URL('./locales/', import.meta.url);

const readJson = (url: URL): unknown => JSON.parse(readFileSync(url, 'utf8'));
const appJson = (locale: SupportedLocale, namespace: string): unknown =>
    namespace === 'common'
        ? readJson(new URL(`packages/i18n-content/common/${locale}.json`, REPO))
        : readJson(new URL(`apps/app/src/i18n/locales/${locale}/${namespace}.json`, REPO));
const siteJson = (locale: SupportedLocale, file: string): unknown =>
    readJson(new URL(`${locale}/${file}.json`, SITE_LOCALES));

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Every string leaf as `[a.b.c, text]`. */
const leaves = (value: unknown, prefix = ''): [string, unknown][] =>
    isRecord(value)
        ? Object.entries(value).flatMap(([key, child]) =>
              leaves(child, prefix ? `${prefix}.${key}` : key),
          )
        : [[prefix, value]];

/** The value at a dotted key. */
const lookup = (tree: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (isRecord(node) ? node[part] : undefined), tree);

// App `landing` keys the app landing does not render, so the site does not copy them. A new app
// key fails "the site copies every rendered app landing text" until it is ported or listed here.
const NOT_RENDERED: Record<string, string> = {
    'features.soloBudget': 'FeaturesSection lists five cards without it',
    'sections.groups.cta': 'ShowcaseSection has no button',
    'sections.expenses': 'ShowcaseSections renders only the groups showcase',
    'cta.openApp': 'CtaSection does not render it',
    promo: 'the early-supporter modal of the app, not the landing',
};

const isNotRendered = (key: string): boolean =>
    Object.keys(NOT_RENDERED).some(prefix => key === prefix || key.startsWith(`${prefix}.`));

/**
 * `shared.json`: texts of other app namespaces the landing renders, by site key. `count` resolves
 * an i18next plural key the way the app does (`<key>_<Intl.PluralRules form>`, `{{count}}`).
 */
const SHARED_SOURCES: Record<string, { namespace: string; key: string; count?: number }> = {
    'buttons.getStarted': { namespace: 'common', key: 'buttons.getStarted' },
    'buttons.invitePeople': { namespace: 'common', key: 'buttons.invitePeople' },
    'buttons.settleUp': { namespace: 'common', key: 'buttons.settleUp' },
    'footer.copyright': { namespace: 'common', key: 'footer.copyright' },
    'footer.mediaTitle': { namespace: 'common', key: 'footer.mediaTitle' },
    'footer.privacy': { namespace: 'common', key: 'footer.privacy' },
    'footer.terms': { namespace: 'common', key: 'footer.terms' },
    'preview.members': {
        namespace: 'dashboard',
        key: 'groupsCard.members',
        count: PREVIEW_MEMBERS.length,
    },
    'preview.owedToYou': { namespace: 'dashboard', key: 'summary.owedToYou' },
    'preview.youAreOwed': { namespace: 'common', key: 'balances.youAreOwed' },
    'preview.tabs.expenses': { namespace: 'group', key: 'page.tabs.expenses' },
    'preview.tabs.balances': { namespace: 'group', key: 'page.tabs.balances' },
    'preview.tabs.settings': { namespace: 'group', key: 'page.tabs.settings' },
    'preview.today': { namespace: 'activity', key: 'dateDivider.today' },
    'preview.paidAmount': { namespace: 'activity', key: 'event.paidAmount' },
    'preview.you': { namespace: 'activity', key: 'event.you' },
    'preview.youLent': { namespace: 'activity', key: 'event.youLent' },
    'preview.youBorrowed': { namespace: 'activity', key: 'event.youBorrowed' },
};

const appText = (locale: SupportedLocale, source: (typeof SHARED_SOURCES)[string]): unknown => {
    const tree = appJson(locale, source.namespace);

    if (source.count === undefined) {
        return lookup(tree, source.key);
    }
    const form = new Intl.PluralRules(locale).select(source.count);
    const template = lookup(tree, `${source.key}_${form}`);

    return typeof template === 'string'
        ? template.replace('{{count}}', String(source.count))
        : undefined;
};

describe.each(SUPPORTED_LOCALES)('%s home page parity with the app landing', locale => {
    test('the title and description are the app meta home ones', () => {
        const site = lookup(siteJson(locale, 'meta'), 'home');
        const app = lookup(appJson(locale, 'meta'), 'home');

        expect(lookup(app, 'title')).toEqual(expect.any(String));
        expect(lookup(app, 'description')).toEqual(expect.any(String));
        expect(site).toEqual({
            title: lookup(app, 'title'),
            description: lookup(app, 'description'),
        });
    });

    test('every site landing text is the app text of the same key', () => {
        const app = appJson(locale, 'landing');
        const site = leaves(siteJson(locale, 'landing'));

        expect(site.length).toBeGreaterThan(50);
        for (const [key, text] of site) {
            expect([key, text]).toEqual([key, lookup(app, key)]);
        }
    });

    test('the site copies every rendered app landing text', () => {
        const site = new Set(leaves(siteJson(locale, 'landing')).map(([key]) => key));
        const missing = leaves(appJson(locale, 'landing'))
            .map(([key]) => key)
            .filter(key => !site.has(key) && !isNotRendered(key));

        expect(missing).toEqual([]);
        // Every exclusion still names an app key, and none is copied after all.
        for (const prefix of Object.keys(NOT_RENDERED)) {
            expect([prefix, lookup(appJson(locale, 'landing'), prefix)]).not.toEqual([
                prefix,
                undefined,
            ]);
            expect([...site].filter(key => isNotRendered(key))).toEqual([]);
        }
    });

    test('every shared text is the app text it names', () => {
        const site = leaves(siteJson(locale, 'shared'));

        expect(site.map(([key]) => key).sort()).toEqual(Object.keys(SHARED_SOURCES).sort());
        for (const [key, text] of site) {
            const source = SHARED_SOURCES[key];

            expect(source).toBeDefined();
            if (source !== undefined) {
                expect(appText(locale, source)).toEqual(expect.any(String));
                expect([key, text]).toEqual([key, appText(locale, source)]);
            }
        }
    });

    test('#977: site and app landing texts make no receipt or attachment claim', () => {
        const texts = [siteJson(locale, 'landing'), appJson(locale, 'landing')].flatMap(tree =>
            leaves(tree).map(([, text]) => text),
        );

        expect(texts.filter(text => /receipt|attach|чек|прикреп/i.test(String(text)))).toEqual([]);
    });
});
