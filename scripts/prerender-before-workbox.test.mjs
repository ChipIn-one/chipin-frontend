import { expect, test } from 'vitest';

import { addPublicDirectoryAliases } from './prerender-before-workbox.mjs';

test('canonical and slash-form public routes share final HTML revisions', () => {
    const entries = [
        { url: 'index.html', revision: 'en-home' },
        { url: 'privacy/index.html', revision: 'en-privacy' },
        { url: 'ru/index.html', revision: 'ru-home' },
        { url: 'ru/privacy/index.html', revision: 'ru-privacy' },
        { url: 'pt-br/terms/index.html', revision: 'br-terms' },
        { url: 'app.html', revision: 'spa' },
    ];

    return addPublicDirectoryAliases(entries).then(({ manifest, warnings }) => {
        expect(warnings).toEqual([]);
        expect(manifest).toContainEqual({ url: 'privacy', revision: 'en-privacy' });
        expect(manifest).toContainEqual({ url: 'ru', revision: 'ru-home' });
        expect(manifest).toContainEqual({ url: 'ru/privacy', revision: 'ru-privacy' });
        expect(manifest).toContainEqual({ url: 'pt-br/terms', revision: 'br-terms' });
        expect(manifest).toContainEqual({ url: 'ru/privacy/index.html', revision: 'ru-privacy' });
        expect(manifest).not.toContainEqual({ url: 'app', revision: 'spa' });
        expect(manifest).not.toContainEqual({ url: '', revision: 'en-home' });
    });
});

test('does not generate duplicate aliases', () => {
    const original = [
        { url: 'privacy/index.html', revision: 'abc' },
        { url: 'privacy', revision: 'abc' },
    ];

    return addPublicDirectoryAliases(original).then(({ manifest }) => {
        expect(manifest).toEqual(original);
    });
});
