// Validate the final public HTML was actually scanned by Workbox after SSG.
// Also checks the worker files of 04-4a1 (spec 04 §2.11 option (a)): the app worker is
// `sw-app.js`, the legacy-host kill-switch `sw-kill.js` is not precached, and no file sits at
// `sw.js` (vercel.json serves `/sw.js` by host).
import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve('dist');

const verifyWorkerFiles = serviceWorker =>
    Promise.all([
        access(path.join(outputRoot, 'sw-kill.js')),
        access(path.join(outputRoot, 'sw.js')).then(
            () => {
                throw new Error('dist/sw.js must not exist: /sw.js is rewritten by host.');
            },
            () => undefined,
        ),
    ]).then(() => {
        if (serviceWorker.includes('sw-kill.js')) {
            throw new Error('The kill-switch sw-kill.js must not be precached by the app worker.');
        }
    });

// Both registrations (`virtual:pwa-register` through workbox-window, and the manual one) must
// register `/sw.js` with scope `/` in the built bundle; the quote style is the minifier's. The
// source scan `scripts/sw-registration-sites.test.mjs` forbids any other call site.
const QUOTE = '["\'`]';
const SW_ARGUMENTS = `${QUOTE}/sw\\.js${QUOTE},\\{scope:${QUOTE}/${QUOTE}`;
const REQUIRED_REGISTRATIONS = [
    ['virtual:pwa-register', new RegExp(`new [\\w$]+\\(${SW_ARGUMENTS}`)],
    ['the manual registration', new RegExp(`serviceWorker\\.register\\(${SW_ARGUMENTS}\\}\\)`)],
];

const verifyRegistrationUrls = () => {
    const assetsRoot = path.join(outputRoot, 'assets');

    return readdir(assetsRoot)
        .then(files =>
            Promise.all(
                files
                    .filter(file => file.endsWith('.js'))
                    .map(file => readFile(path.join(assetsRoot, file), 'utf8')),
            ),
        )
        .then(bundles => {
            const code = bundles.join('\n');

            for (const [name, pattern] of REQUIRED_REGISTRATIONS) {
                if (!pattern.test(code)) {
                    throw new Error(name + ' must register /sw.js with scope / in the bundle.');
                }
            }
        });
};

const verifyPublicPrecache = () => {
    return Promise.all([
        readFile(path.join(outputRoot, 'sitemap.xml'), 'utf8'),
        readFile(path.join(outputRoot, 'sw-app.js'), 'utf8'),
    ])
        .then(([sitemap, serviceWorker]) =>
            Promise.all([verifyWorkerFiles(serviceWorker), verifyRegistrationUrls()]).then(() => [
                sitemap,
                serviceWorker,
            ]),
        )
        .then(([sitemap, serviceWorker]) => {
            const publicPaths = Array.from(
                sitemap.matchAll(/<loc>https:\/\/chipin\.one([^<]*)<\/loc>/g),
                match => match[1],
            );

            if (publicPaths.length === 0 || new Set(publicPaths).size !== publicPaths.length) {
                throw new Error('Expected nonempty, unique indexable URLs in sitemap.');
            }

            return Promise.all(
                publicPaths.map(publicPath => {
                    const relativePath = publicPath.replace(/^\/|\/$/g, '');
                    const htmlPath = relativePath
                        ? path.posix.join(relativePath, 'index.html')
                        : 'index.html';

                    return readFile(path.join(outputRoot, htmlPath)).then(contents => {
                        const expectedRevision = createHash('md5').update(contents).digest('hex');

                        if (!serviceWorker.includes(htmlPath)) {
                            throw new Error('Missing public page in Workbox precache: ' + htmlPath);
                        }

                        if (!serviceWorker.includes(expectedRevision)) {
                            throw new Error('Stale Workbox precache revision for: ' + htmlPath);
                        }

                        if (relativePath) {
                            // Workbox's directoryIndex does not match slashless URLs.
                            // Verify a URL entry, not a substring of /index.html.
                            const acceptedKeys = [
                                'url:"' + relativePath + '"',
                                '"url":"' + relativePath + '"',
                                "url:'" + relativePath + "'",
                            ];
                            if (!acceptedKeys.some(key => serviceWorker.includes(key))) {
                                throw new Error(
                                    'Missing canonical offline precache URL: ' + relativePath,
                                );
                            }
                        }
                    });
                }),
            );
        })
        .then(() => {
            process.stdout.write('Verified final Workbox public HTML precache\\n');
        });
};

verifyPublicPrecache().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
