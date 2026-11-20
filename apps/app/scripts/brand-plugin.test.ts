// 05-2b (spec 05 §6, D23/D31): the favicon comes from @chipin/tokens and theme-color from BRAND_COLORS.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BRAND_COLORS } from '@chipin/tokens/theme';
import { expect, test, vi } from 'vitest';

import {
    brandPlugin,
    FAVICON_FILE,
    FAVICON_SOURCE,
    THEME_COLOR_ENTRY,
    THEME_COLOR_META,
} from './brand-plugin';

const callHook = (hook: unknown, context: unknown, ...args: unknown[]): unknown => {
    const handler =
        typeof hook === 'object' && hook !== null && 'handler' in hook ? hook.handler : hook;
    if (typeof handler !== 'function') {
        throw new TypeError('expected a plugin hook');
    }
    return handler.call(context, ...args);
};

test('the favicon source is packages/tokens/assets/favicon.svg', () => {
    expect(FAVICON_FILE).toBe('favicon.svg');
    expect(FAVICON_SOURCE.split(path.sep).slice(-3)).toEqual(['tokens', 'assets', 'favicon.svg']);
});

const APP_DIR = path.resolve(import.meta.dirname, '..');
const transformHtml = (filename: string): unknown =>
    callHook(brandPlugin().transformIndexHtml, undefined, '<html></html>', {
        filename: path.join(APP_DIR, filename),
        path: `/${filename}`,
    });

test('<meta name="theme-color"> equals the manifest theme colour token', () => {
    expect(THEME_COLOR_META).toEqual({
        tag: 'meta',
        attrs: { name: 'theme-color', content: BRAND_COLORS.pwaThemeColor },
        injectTo: 'head',
    });
});

test('only the SPA shell app.html gets <meta name="theme-color">, exactly once', () => {
    expect(THEME_COLOR_ENTRY).toBe('app.html');
    expect(transformHtml('app.html')).toEqual([THEME_COLOR_META]);
    expect(transformHtml('index.html')).toEqual([]);
    expect(transformHtml('privacy/index.html')).toEqual([]);
});

test.each(['app.html', 'index.html'])(
    'the source %s has no colour literal and no hand-written theme-color meta',
    file => {
        const html = readFileSync(path.join(APP_DIR, file), 'utf8');
        expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        expect(html).not.toMatch(/name=["']theme-color["']/);
    },
);

test('a build emits favicon.svg at the dist root', () => {
    const emitFile = vi.fn();

    callHook(brandPlugin().generateBundle, { emitFile });

    expect(emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'favicon.svg',
        source: readFileSync(FAVICON_SOURCE),
    });
});

test('the dev server serves /favicon.svg and passes other requests on', () => {
    let middleware: ((...args: unknown[]) => void) | undefined;
    const server = { middlewares: { use: (fn: typeof middleware) => (middleware = fn) } };
    callHook(brandPlugin().configureServer, undefined, server);

    const response = { setHeader: vi.fn(), end: vi.fn() };
    const next = vi.fn();
    middleware?.({ url: '/favicon.svg?v=1' }, response, next);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'image/svg+xml');
    expect(response.end).toHaveBeenCalledWith(readFileSync(FAVICON_SOURCE));
    expect(next).not.toHaveBeenCalled();

    middleware?.({ url: '/other.svg' }, response, next);
    expect(next).toHaveBeenCalledOnce();
});
