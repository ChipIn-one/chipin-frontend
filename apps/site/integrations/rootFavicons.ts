import { copyFileSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

// Issue 859 (spec 04 §3.6, A-28): browsers and crawlers ask for `/favicon.ico` and `/favicon.svg`
// at the site root whatever the page links. BaseLayout keeps its hashed `<link rel="icon">`; this
// integration serves both root files from their existing sources (no copies are committed): the
// SVG from `@chipin/tokens` (as apps/app/scripts/brand-plugin.ts does) and the ICO from the app.

/** The SVG favicon source in the tokens package. */
const FAVICON_SVG_SOURCE = createRequire(import.meta.url).resolve(
    '@chipin/tokens/assets/favicon.svg',
);

/** The ICO favicon source: the app's public file. */
const FAVICON_ICO_SOURCE = fileURLToPath(new URL('../../app/public/favicon.ico', import.meta.url));

/** The root files: URL path, source and Content-Type. */
const ROOT_FAVICONS = [
    { file: 'favicon.svg', source: FAVICON_SVG_SOURCE, contentType: 'image/svg+xml' },
    { file: 'favicon.ico', source: FAVICON_ICO_SOURCE, contentType: 'image/x-icon' },
] as const;

/** Writes `favicon.svg` and `favicon.ico` into `dir` (the build output root), byte for byte. */
const emitRootFavicons = (dir: string): void => {
    for (const { file, source } of ROOT_FAVICONS) {
        copyFileSync(source, join(dir, file));
    }
};

/** Dev server middleware: answers `/favicon.svg` and `/favicon.ico`, passes other URLs on. */
const rootFaviconsMiddleware = (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
): void => {
    const path = request.url?.split('?')[0];
    const favicon = ROOT_FAVICONS.find(({ file }) => path === `/${file}`);

    if (favicon === undefined) {
        next();
        return;
    }
    response.setHeader('Content-Type', favicon.contentType);
    response.end(readFileSync(favicon.source));
};

const rootFavicons = (): AstroIntegration => ({
    name: 'chipin:root-favicons',
    hooks: {
        'astro:server:setup': ({ server }) => {
            server.middlewares.use(rootFaviconsMiddleware);
        },
        'astro:build:done': ({ dir, logger }) => {
            emitRootFavicons(fileURLToPath(dir));
            logger.info('emitted /favicon.svg and /favicon.ico');
        },
    },
});

export {
    emitRootFavicons,
    FAVICON_ICO_SOURCE,
    FAVICON_SVG_SOURCE,
    ROOT_FAVICONS,
    rootFavicons,
    rootFaviconsMiddleware,
};
