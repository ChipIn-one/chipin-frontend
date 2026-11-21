import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { type DefaultTreeAdapterTypes, parse } from 'parse5';
import { describe, expect, test } from 'vitest';

import GroupPage from '../pages/join/group.astro';

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
