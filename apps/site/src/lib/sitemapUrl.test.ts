import { describe, expect, test } from 'vitest';

import { canonicalSitemapUrl } from './sitemapUrl';

describe('canonicalSitemapUrl', () => {
    test.each([
        ['https://chipin.one/', 'https://chipin.one/'],
        ['https://chipin.one/ru/', 'https://chipin.one/ru/'],
        ['https://chipin.one/privacy/', 'https://chipin.one/privacy'],
        ['https://chipin.one/ru/terms/', 'https://chipin.one/ru/terms'],
        ['https://chipin.one/ru/terms', 'https://chipin.one/ru/terms'],
    ])('%s is %s', (href, expected) => {
        expect(canonicalSitemapUrl(href)).toBe(expected);
    });
});
