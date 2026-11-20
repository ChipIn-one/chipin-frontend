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
