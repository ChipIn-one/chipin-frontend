import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { type DefaultTreeAdapterTypes, parse } from 'parse5';
import { describe, expect, test } from 'vitest';

import HomePage from '../components/landing/HomePage.astro';
import { SUPPORTED_LOCALES } from '../i18n/locales';
import NotFoundPage from '../pages/404.astro';
import FriendPage from '../pages/join/friend.astro';
import GroupPage from '../pages/join/group.astro';

import BaseLayout from './BaseLayout.astro';

// Issue 852 (spec 04 A-28): every site page links the ChipIn favicon, emitted by Astro as a
// hashed file (`import ... ?url`), so the root domain shows an icon once chipin.one is the site.
type Node = DefaultTreeAdapterTypes.ChildNode | DefaultTreeAdapterTypes.Document;
type Element = DefaultTreeAdapterTypes.Element;

const elements = (node: Node): Element[] => [
    ...('tagName' in node ? [node] : []),
    ...('childNodes' in node ? node.childNodes : []).flatMap(child => elements(child)),
];

describe('BaseLayout favicon', () => {
    test('links the SVG favicon from the tokens asset', async () => {
        const container = await AstroContainer.create();
        const html = await container.renderToString(GroupPage);
        const icons = elements(parse(html)).filter(
            element =>
                element.tagName === 'link' &&
                element.attrs.some(({ name, value }) => name === 'rel' && value === 'icon'),
        );

        expect(icons).toHaveLength(1);

        const attr = (name: string) => icons[0]?.attrs.find(a => a.name === name)?.value;

        expect(attr('type')).toBe('image/svg+xml');
        // Not a `data:` URI: astro.config.ts keeps the favicon out of the inline limit, so a build
        // emits a hashed file under `/_astro/` (the dev transform serves it from its source path).
        expect(attr('href')).not.toMatch(/^data:/);
        expect(attr('href')).toMatch(
            /(?:^\/_astro\/favicon\.[\w-]+|\/tokens\/assets\/favicon)\.svg$/,
        );
    });
});

// #940: every page shares one social preview, absolute on https://chipin.one.
describe('BaseLayout social preview', () => {
    test('renders the og:image and twitter tags', async () => {
        const container = await AstroContainer.create();
        const html = await container.renderToString(GroupPage);
        const meta = (key: 'property' | 'name', value: string) =>
            elements(parse(html))
                .find(
                    element =>
                        element.tagName === 'meta' &&
                        element.attrs.some(attr => attr.name === key && attr.value === value),
                )
                ?.attrs.find(attr => attr.name === 'content')?.value;

        expect(meta('property', 'og:image')).toBe('https://chipin.one/og-image.png');
        expect(meta('property', 'og:image:width')).toBe('1200');
        expect(meta('property', 'og:image:height')).toBe('630');
        expect(meta('property', 'og:image:type')).toBe('image/png');
        expect(meta('property', 'og:image:alt')).toMatch(/ChipIn/);
        expect(meta('name', 'twitter:card')).toBe('summary_large_image');
        expect(meta('name', 'twitter:title')).toBe(meta('property', 'og:title'));
        expect(meta('name', 'twitter:description')).toBe(meta('property', 'og:description'));
        expect(meta('name', 'twitter:image')).toBe('https://chipin.one/og-image.png');
        expect(meta('name', 'twitter:image:alt')).toBe(meta('property', 'og:image:alt'));
    });
});

// #941: the home page of each locale carries one JSON-LD block; no other page has one.
describe('BaseLayout structured data', () => {
    const jsonLd = (html: string): string[] =>
        elements(parse(html))
            .filter(
                element =>
                    element.tagName === 'script' &&
                    element.attrs.some(
                        ({ name, value }) => name === 'type' && value === 'application/ld+json',
                    ),
            )
            .map(element =>
                element.childNodes.map(child => ('value' in child ? child.value : '')).join(''),
            );

    test.each(SUPPORTED_LOCALES)('the %s home page has the JSON-LD and it parses', async locale => {
        const container = await AstroContainer.create();
        const blocks = jsonLd(await container.renderToString(HomePage, { props: { locale } }));

        expect(blocks).toHaveLength(1);
        const data: unknown = JSON.parse(blocks[0] ?? '');

        expect(data).toMatchObject({
            '@context': 'https://schema.org',
            '@graph': [
                { '@type': 'Organization' },
                { '@type': 'WebSite', inLanguage: ['en', 'ru'] },
                { '@type': 'WebApplication', applicationCategory: 'FinanceApplication' },
            ],
        });
    });

    test.each([
        ['404', NotFoundPage],
        ['join/group', GroupPage],
        ['join/friend', FriendPage],
    ])('the %s page has no JSON-LD', async (_name, page) => {
        const container = await AstroContainer.create();

        expect(jsonLd(await container.renderToString(page))).toEqual([]);
    });

    test('a content page (privacy) has no JSON-LD', async () => {
        const container = await AstroContainer.create();
        const html = await container.renderToString(BaseLayout, {
            props: { locale: 'en', slug: 'privacy', title: 'Privacy', description: 'Privacy' },
        });

        expect(jsonLd(html)).toEqual([]);
    });
});
