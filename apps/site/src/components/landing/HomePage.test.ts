import { THEME_INIT_SCRIPT } from '@chipin/tokens/theme-init';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { type DefaultTreeAdapterTypes, parse } from 'parse5';
import { beforeAll, describe, expect, test } from 'vitest';

import { checkPage } from '../../../integrations/seoGuard';
import { SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n/locales';
import { interpolate, messages } from '../../i18n/ui';
import { PROD_APP_ORIGIN } from '../../lib/appOrigin';
import { STAT_FIELDS } from '../../lib/landingStats';

import HomePage from './HomePage.astro';

// Spec 04 row 04-3b1, §3.6, §4.4: the rendered home page (Astro Container API, no build). It
// shows every text of landing.json and shared.json (landingParity.test.ts ties them to the app),
// links its buttons to the app sign-in, starts with the theme-init script and keeps the statistics
// hidden until the script has data. The site build and seoGuard run in CI.
type Node = DefaultTreeAdapterTypes.ChildNode | DefaultTreeAdapterTypes.Document;
type Element = DefaultTreeAdapterTypes.Element;

const isElement = (node: Node): node is Element => 'tagName' in node;

const elements = (node: Node): Element[] => {
    const children = 'childNodes' in node ? node.childNodes : [];
    const self = isElement(node) ? [node] : [];

    return [...self, ...children.flatMap(child => elements(child))];
};

const attr = (element: Element, name: string): string | undefined =>
    element.attrs.find(attribute => attribute.name === name)?.value;

const text = (node: Node): string =>
    'value' in node && node.nodeName === '#text'
        ? node.value
        : ('childNodes' in node ? node.childNodes : []).map(text).join('');

/** Every text node and attribute value of the page: what a reader or a screen reader gets. */
const visibleStrings = (document: Node): string[] => {
    const strings: string[] = [];
    const visit = (node: Node) => {
        if (node.nodeName === '#text' && 'value' in node) {
            strings.push(node.value);
        }
        if (isElement(node)) {
            strings.push(...node.attrs.map(attribute => attribute.value));
            if (node.tagName === 'script') {
                return;
            }
        }
        for (const child of 'childNodes' in node ? node.childNodes : []) {
            visit(child);
        }
    };

    visit(document);
    return strings;
};

const leaves = (value: unknown): string[] =>
    typeof value === 'object' && value !== null
        ? Object.values(value).flatMap(leaves)
        : [String(value)];

const pages = new Map<SupportedLocale, string>();

beforeAll(async () => {
    const container = await AstroContainer.create();

    for (const locale of SUPPORTED_LOCALES) {
        pages.set(
            locale,

            await container.renderToString(HomePage, { props: { locale } }),
        );
    }
});

const page = (locale: SupportedLocale) => {
    const html = pages.get(locale) ?? '';

    return { html, document: parse(html) };
};

describe.each(SUPPORTED_LOCALES)('%s home page', locale => {
    const { meta, landing, shared } = messages(locale);

    test('has the home title and description', () => {
        const { document } = page(locale);
        const all = elements(document);

        expect(text(all.find(element => element.tagName === 'title') ?? document)).toBe(
            meta.home.title,
        );
        expect(
            all
                .filter(
                    element =>
                        element.tagName === 'meta' && attr(element, 'name') === 'description',
                )
                .map(element => attr(element, 'content')),
        ).toEqual([meta.home.description]);
    });

    test('renders every landing.json and shared.json text', () => {
        const strings = visibleStrings(page(locale).document);
        const year = new Date().getFullYear();
        const expected = [
            ...leaves(landing),
            ...leaves({ ...shared, footer: { ...shared.footer, copyright: undefined } }).filter(
                value => value !== 'undefined' && !value.includes('{{'),
            ),
            interpolate(shared.footer.copyright, { year }),
            interpolate(shared.preview.paidAmount, { payer: shared.preview.you }),
            interpolate(shared.preview.paidAmount, { payer: 'Aleh' }),
        ];
        const missing = expected.filter(value => !strings.some(string => string.includes(value)));

        expect(expected.length).toBeGreaterThan(60);
        expect(missing).toEqual([]);
    });

    // Astro drops the line break between an expression and an element: the app's `{' '}` stays.
    test('joins the split headings and the balance summary with spaces', () => {
        const { document } = page(locale);
        const texts = elements(document).map(element => text(element).replace(/\s+/g, ' ').trim());
        const { features, sections } = landing;

        expect(texts).toEqual(
            expect.arrayContaining([
                `${landing.heroTitle} ${landing.heroTitleHighlight}`,
                `${features.titlePart1} ${features.titleHighlight} ${features.titlePart2}`,
                `${sections.groups.titlePart1} ${sections.groups.titleHighlight}`,
                `${shared.preview.youAreOwed} 227 EUR`,
            ]),
        );
    });

    test('"Get started" and "Get started for free" open the app sign-in in the page language', () => {
        const signIn = `${PROD_APP_ORIGIN}/login?locale=${locale}`;
        const links = elements(page(locale).document).filter(
            element => element.tagName === 'a' && attr(element, 'href') === signIn,
        );

        expect(links.map(link => text(link).trim())).toEqual([
            shared.buttons.getStarted,
            landing.cta.getStartedFree,
        ]);
    });

    test('the header "Open ChipIn" opens the app sign-in', () => {
        const links = elements(page(locale).document).filter(
            element =>
                element.tagName === 'a' && attr(element, 'href') === `${PROD_APP_ORIGIN}/login`,
        );

        expect(links.map(link => text(link).trim())).toEqual([meta.header.openApp]);
    });

    test('the header anchors lead to the sections', () => {
        const ids = new Set(elements(page(locale).document).map(element => attr(element, 'id')));

        for (const anchor of ['features', 'how-it-works', 'pricing']) {
            expect(ids.has(anchor)).toBe(true);
            expect(page(locale).html).toContain(`href="#${anchor}"`);
        }
    });

    test('the statistics block is hidden until its script has data', () => {
        const all = elements(page(locale).document);
        const block = all.filter(element => attr(element, 'data-landing-stats') !== undefined);

        expect(block).toHaveLength(1);
        expect(block[0]?.attrs.some(attribute => attribute.name === 'hidden')).toBe(true);
        expect(block[0] && attr(block[0], 'aria-label')).toBe(landing.stats.regionLabel);
        expect(
            elements(block[0] ?? page(locale).document).flatMap(element => {
                const field = attr(element, 'data-stat');

                return field === undefined ? [] : [field];
            }),
        ).toEqual([...STAT_FIELDS]);
    });

    test('theme-init is the first script of <head>, before any stylesheet', () => {
        const head = elements(page(locale).document).find(element => element.tagName === 'head');
        const children = (head?.childNodes ?? []).filter(isElement);
        const firstScript = children.findIndex(element => element.tagName === 'script');
        const firstStylesheet = children.findIndex(
            element => element.tagName === 'link' && attr(element, 'rel') === 'stylesheet',
        );

        expect(firstScript).toBeGreaterThanOrEqual(0);
        expect(text(children[firstScript] ?? page(locale).document)).toBe(THEME_INIT_SCRIPT);
        expect(firstStylesheet === -1 || firstStylesheet > firstScript).toBe(true);
    });

    // §3.6: no redirect of a signed-in visitor, no app localStorage (only the theme key of 05-3).
    test('neither redirects nor reads app session state', () => {
        const { html, document } = page(locale);

        expect(html.replace(THEME_INIT_SCRIPT, '')).not.toMatch(
            /localStorage|sessionStorage|Chipin_|location\.(?:assign|replace|href\s*=)/,
        );
        expect(
            elements(document).some(
                element =>
                    element.tagName === 'meta' &&
                    attr(element, 'http-equiv')?.toLowerCase() === 'refresh',
            ),
        ).toBe(false);
    });

    test('passes the seoGuard page rules (no inline style or handler, no token-like text)', () => {
        const problems = checkPage({
            file: `${locale}/index.html`,
            html: page(locale).html,
            // Scripts are not built here; the JS budget is checked by seoGuard in the site build.
            script: () => ({ size: 0, imports: [] }),
        });

        expect(problems).toEqual([]);
    });
});
