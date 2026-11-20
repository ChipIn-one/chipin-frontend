// Spec 05 §6 (05-2b, D23 as amended by D31): the brand marks and colours come from
// `@chipin/tokens`. `favicon.svg` lives in `packages/tokens/assets/` (not in `public/`), so this
// plugin serves it at `/favicon.svg` in dev and emits it to the `dist` root in a build (where the
// Workbox `globPatterns` precache it). `<meta name="theme-color">` is injected from `BRAND_COLORS`
// into the SPA shell `app.html` only (spec 05 §6; the public `index.html` and its prerendered pages
// are not touched until spec 04), so the HTML and the Vite config hold no colour literal.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename } from 'node:path';

import { BRAND_COLORS } from '@chipin/tokens/theme';
import { THEME_INIT_SCRIPT } from '@chipin/tokens/theme-init';
import type { HtmlTagDescriptor, Plugin } from 'vite';

export const FAVICON_FILE = 'favicon.svg';

/** The HTML entry that gets `<meta name="theme-color">`: the SPA shell. */
export const THEME_COLOR_ENTRY = 'app.html';

/** The absolute path of the favicon source in the tokens package. */
export const FAVICON_SOURCE = createRequire(import.meta.url).resolve(
    `@chipin/tokens/assets/${FAVICON_FILE}`,
);

/** The `<meta name="theme-color">` of the HTML entries: the PWA theme colour of the manifest. */
export const THEME_COLOR_META: HtmlTagDescriptor = {
    tag: 'meta',
    attrs: { name: 'theme-color', content: BRAND_COLORS.pwaThemeColor },
    injectTo: 'head',
};

export const brandPlugin = (): Plugin => ({
    name: 'chipin-brand',
    configureServer(server) {
        server.middlewares.use((request, response, next) => {
            if (request.url?.split('?')[0] !== `/${FAVICON_FILE}`) {
                next();
                return;
            }
            response.setHeader('Content-Type', 'image/svg+xml');
            response.end(readFileSync(FAVICON_SOURCE));
        });
    },
    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: FAVICON_FILE,
            source: readFileSync(FAVICON_SOURCE),
        });
    },
    transformIndexHtml: (_html, { filename }) =>
        basename(filename) === THEME_COLOR_ENTRY ? [THEME_COLOR_META] : [],
});

// Spec 05 §2 (05-3): the anti-FOUC theme script runs as the first element of `<head>` of the SPA
// shell `app.html`, before any CSS or app code, so a dark reload never shows a light frame. The
// public `index.html` (and its prerendered pages) is not touched until spec 04: `PublicApp` sets its
// own theme there. The script text is inserted as is (Vite serialises string `children` verbatim
// and does not rewrite an inline classic script), so its CSP hash THEME_INIT_SCRIPT_SHA256 matches
// the `script-src` of vercel.json (theme-init.test.ts checks it).
/** The HTML entry that gets the theme script: the SPA shell. */
export const THEME_INIT_ENTRY = 'app.html';

export const THEME_INIT_TAG: HtmlTagDescriptor = {
    tag: 'script',
    children: THEME_INIT_SCRIPT,
    injectTo: 'head-prepend',
};

export const themeInitPlugin = (): Plugin => ({
    name: 'chipin-theme-init',
    transformIndexHtml: {
        // Last of all: a `head-prepend` tag of a later hook would otherwise go before this one.
        order: 'post',
        handler: (_html, { filename }) =>
            basename(filename) === THEME_INIT_ENTRY ? [THEME_INIT_TAG] : [],
    },
});
