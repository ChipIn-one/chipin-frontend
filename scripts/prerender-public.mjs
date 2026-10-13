// Static, deterministic React HTML generation for explicitly indexable public routes.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import react from '@vitejs/plugin-react-swc';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createServer } from 'vite';

const escapeHtml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const replaceHead = (template, route, meta) => {
    const title = escapeHtml(meta.title);
    const description = escapeHtml(meta.description);
    const canonical = escapeHtml(meta.canonical);
    return template
        .replace(/<html lang="[^"]*">/, `<html lang="${escapeHtml(route.locale)}">`)
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
        .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`)
        .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`)
        .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}" />`)
        .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${canonical}" />`);
};

// Rendering is request-free, but legacy API modules resolve their environment at import time.
if (!process.env.VITE_CHIPIN_ENV) {
    process.env.VITE_CHIPIN_ENV = 'dev';
}

const main = () => createServer({
    configFile: false,
    root: process.cwd(),
    plugins: [svgr(), react(), tsconfigPaths()],
    // styled-components' CJS default export is not callable under the external SSR loader.
    // Transform its ESM entry in Vite's server pipeline, matching the browser build.
    ssr: { noExternal: ['styled-components'] },
    // Only the explicit entry is rendered; scanning the SPA would attempt to resolve
    // virtual:pwa-register without the PWA plugin in this build-only server.
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'warn',
}).then(server => {
    return Promise.all([
        server.ssrLoadModule('/src/public-routes/entry-server.tsx'),
        server.ssrLoadModule('/src/constants/publicRoutes.ts'),
        server.ssrLoadModule('/src/i18n/resources.ts'),
        readFile('dist/index.html', 'utf8'),
    ]).then(([renderer, routes, translations, template]) => {
        const tasks = routes.PUBLIC_ROUTE_ENTRIES.map(route => {
            const content = translations.resources[route.locale]?.meta?.[route.metaKey];
            if (!content?.title || !content?.description) {
                throw new Error('Missing public SEO translations: ' + route.path);
            }
            const rendered = renderer.renderPublicRoute(route);
            if (!rendered.html || !rendered.html.includes('<')) {
                throw new Error('Empty public React render: ' + route.path);
            }
            const forbidden = [
                /(?:refreshToken|accessToken|inviteToken|sessionStorage)/i,
                /<meta[^>]*noindex/i,
            ];
            if (forbidden.some(pattern => pattern.test(rendered.html))) {
                throw new Error('Protected/session content in public HTML: ' + route.path);
            }
            const canonical = routes.getPublicCanonical(route);
            const html = replaceHead(template, route, {
                ...content,
                canonical,
            })
                .replace('</head>', rendered.styles + '\n</head>')
                .replace(
                    '<div id="root"></div>',
                    `<div id="root" data-public-ssg="true" data-public-locale="${escapeHtml(route.locale)}">${rendered.html}</div>`,
                );
            const destination = route.page === 'home' && route.locale === 'en'
                ? 'dist/index.html'
                : path.join('dist', route.path.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
            return mkdir(path.dirname(destination), { recursive: true })
                .then(() => writeFile(destination, html, 'utf8'));
        });

        const urls = routes.PUBLIC_ROUTE_ENTRIES.map(route =>
            `  <url><loc>${escapeHtml(routes.getPublicCanonical(route))}</loc></url>`,
        );
        const sitemap = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            '</urlset>',
            '',
        ].join('\n');
        tasks.push(writeFile('dist/sitemap.xml', sitemap, 'utf8'));
        return Promise.all(tasks).then(() => {
            process.stdout.write(`Prerendered ${routes.PUBLIC_ROUTE_ENTRIES.length} public URLs\n`);
        });
    }).finally(() => server.close());
});

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
