// 05-2b (spec 05 §6, D23/D31): the favicon comes from @chipin/tokens and theme-color from BRAND_COLORS.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BRAND_COLORS } from '@chipin/tokens/theme';
import { THEME_INIT_SCRIPT } from '@chipin/tokens/theme-init';
import { createServer } from 'vite';
import { expect, test, vi } from 'vitest';

import {
    brandPlugin,
    FAVICON_FILE,
    FAVICON_SOURCE,
    THEME_COLOR_ENTRY,
    THEME_COLOR_META,
    THEME_INIT_ENTRY,
    THEME_INIT_TAG,
    themeInitPlugin,
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

test('only the SPA shell index.html gets <meta name="theme-color">, exactly once', () => {
    expect(THEME_COLOR_ENTRY).toBe('index.html');
    expect(transformHtml('index.html')).toEqual([THEME_COLOR_META]);
    expect(transformHtml('other.html')).toEqual([]);
});

test('the source index.html has no colour literal and no hand-written theme-color meta', () => {
    const html = readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toMatch(/name=["']theme-color["']/);
});

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

// 05-3 (spec 05 §2): the anti-FOUC script is the first element of `<head>` in index.html, and
// its text is THEME_INIT_SCRIPT byte for byte (the CSP hash input).
/** Runs the HTML through Vite's own transform pipeline (a dev server, no build). */
const transform = async (file: string): Promise<string> => {
    const server = await createServer({
        configFile: false,
        root: APP_DIR,
        logLevel: 'silent',
        server: { middlewareMode: true, hmr: false, ws: false },
        appType: 'custom',
        plugins: [themeInitPlugin()],
    });
    try {
        return await server.transformIndexHtml(
            `/${file}`,
            readFileSync(path.join(APP_DIR, file), 'utf8'),
        );
    } finally {
        await server.close();
    }
};

test('the tag is an inline classic script prepended to <head>', () => {
    expect(THEME_INIT_ENTRY).toBe('index.html');
    expect(THEME_INIT_TAG).toEqual({
        tag: 'script',
        children: THEME_INIT_SCRIPT,
        injectTo: 'head-prepend',
    });
});

test('index.html gets the script as the first element of <head>, byte for byte', async () => {
    const html = await transform('index.html');
    const head = /<head>\s*([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';

    expect(head.startsWith(`<script>${THEME_INIT_SCRIPT}</script>`)).toBe(true);
    expect(html.split(THEME_INIT_SCRIPT)).toHaveLength(2);
});

test('another HTML file does not get the script', () => {
    const transformInit = (filename: string): unknown =>
        callHook(themeInitPlugin().transformIndexHtml, undefined, '<html></html>', {
            filename: path.join(APP_DIR, filename),
        });

    expect(transformInit('other.html')).toEqual([]);
    expect(transformInit('index.html')).toEqual([THEME_INIT_TAG]);
});
