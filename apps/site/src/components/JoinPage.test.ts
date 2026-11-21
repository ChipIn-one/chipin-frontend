import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { type DefaultTreeAdapterTypes, parse } from 'parse5';
import { beforeAll, describe, expect, test } from 'vitest';

import FriendPage from '../pages/join/friend.astro';
import GroupPage from '../pages/join/group.astro';

// Review I1 of 04-3b1: the invite landing keeps its own chrome (spec 04 §3.5, KB USR-081, USR-083).
// The site header's "Open ChipIn" (`/login`, no `returnTo`) would lose the invite, and the header
// and footer render in one fixed language while the page follows the browser language.
type Node = DefaultTreeAdapterTypes.ChildNode | DefaultTreeAdapterTypes.Document;
type Element = DefaultTreeAdapterTypes.Element;

const elements = (node: Node): Element[] => [
    ...('tagName' in node ? [node] : []),
    ...('childNodes' in node ? node.childNodes : []).flatMap(child => elements(child)),
];

const pages = new Map<string, string>();

beforeAll(async () => {
    const container = await AstroContainer.create();

    pages.set('group', await container.renderToString(GroupPage));

    pages.set('friend', await container.renderToString(FriendPage));
});

describe.each(['group', 'friend'])('the %s invite landing', kind => {
    const all = () => elements(parse(pages.get(kind) ?? ''));

    test('USR-081 has no link to the app sign-in that would lose the invite', () => {
        const hrefs = all().flatMap(element =>
            element.attrs.filter(({ name }) => name === 'href').map(({ value }) => value),
        );

        expect(all().some(element => element.tagName === 'main')).toBe(true);
        expect(hrefs.filter(href => /\/login(?:[?#/]|$)/.test(href))).toEqual([]);
    });

    test('USR-083 has no footer and only the language links in its header', () => {
        const tags = all().map(element => element.tagName);
        const header = all().find(element => element.tagName === 'header');

        expect(tags).not.toContain('footer');
        expect(header && elements(header).some(element => element.tagName === 'a')).toBe(true);
        expect(
            header &&
                elements(header)
                    .filter(element => element.tagName === 'a')
                    .every(element => element.attrs.some(({ name }) => name === 'hreflang')),
        ).toBe(true);
    });
});
