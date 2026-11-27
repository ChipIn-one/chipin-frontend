// Validate the final public HTML was actually scanned by Workbox after SSG.
// Also checks the worker files of 04-4a1 (spec 04 §2.11 option (a)): the app worker is
// `sw-app.js` and no file sits at `sw.js` (vercel.json rewrites `/sw.js` to `/sw-app.js`). The Workbox runtime is inlined (04-2d,
// `inlineWorkboxRuntime`): no `workbox-*.js` next to the worker and no `importScripts` in it.
import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve(import.meta.dirname, '../dist');

const verifyWorkerFiles = serviceWorker =>
    Promise.all([
        access(path.join(outputRoot, 'sw.js')).then(
            () => {
                throw new Error('dist/sw.js must not exist: /sw.js is rewritten to /sw-app.js.');
            },
            () => undefined,
        ),
        readdir(outputRoot).then(files => {
            const runtimeFiles = files.filter(file => /^workbox-.*\.js$/.test(file));

            if (runtimeFiles.length > 0) {
                throw new Error(
                    `The Workbox runtime must be inlined, found: ${runtimeFiles.join(', ')}.`,
                );
            }
        }),
    ]).then(() => {
        if (/\bimportScripts\s*\(/.test(serviceWorker)) {
            throw new Error('sw-app.js must not importScripts: the Workbox runtime is inlined.');
        }
    });

// The single registration (`useRegisterSW` of `virtual:pwa-register/react`, through workbox-window,
// spec 04 §2.11) must register `/sw.js` with scope `/` in the built bundle; the quote style is the
// minifier's. The source scan `scripts/sw-registration-sites.test.mjs` forbids any other call site.
const QUOTE = '["\'`]';
const SW_ARGUMENTS = `${QUOTE}/sw\\.js${QUOTE},\\{scope:${QUOTE}/${QUOTE}`;
const REQUIRED_REGISTRATIONS = [
    ['virtual:pwa-register', new RegExp(`new [\\w$]+\\(${SW_ARGUMENTS}`)],
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

// Spec 04 §2.10: every locale namespace is a lazy chunk. Each locale JSON (app namespaces and the
// `common` of @chipin/i18n-content) is found in the bundle by one of its own strings: it must sit
// in exactly one chunk, outside the scripts the HTML entries load, and that chunk must be
// precached (offline after the first visit). `common` is exactly one chunk per locale; rolldown
// names those `<locale>-*.js`, so they are found by content, not by name.
const appRoot = path.resolve(import.meta.dirname, '..');
const LOCALE_SOURCES = [
    { dir: path.join(appRoot, 'src/i18n/locales'), nested: true },
    { dir: path.join(appRoot, '../../packages/i18n-content/common'), nested: false },
];
// Only text the minifier keeps verbatim inside any string literal.
const VERBATIM = /^[^"'`\\$\n]{12,}$/;

const leafStrings = value =>
    typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(leafStrings)
          : [];

const readLocaleFiles = () =>
    Promise.all(
        LOCALE_SOURCES.map(({ dir, nested }) =>
            nested
                ? readdir(dir).then(locales =>
                      Promise.all(
                          locales.map(locale =>
                              readdir(path.join(dir, locale)).then(files =>
                                  files.map(file => path.join(dir, locale, file)),
                              ),
                          ),
                      ).then(lists => lists.flat()),
                  )
                : readdir(dir).then(files => files.map(file => path.join(dir, file))),
        ),
    )
        .then(lists => lists.flat().filter(file => file.endsWith('.json')))
        .then(files =>
            Promise.all(
                files.map(file =>
                    readFile(file, 'utf8').then(text => ({
                        file: path.relative(appRoot, file),
                        common: !file.startsWith(LOCALE_SOURCES[0].dir),
                        strings: leafStrings(JSON.parse(text)),
                    })),
                ),
            ),
        );

const htmlEntryScripts = () =>
    Promise.all(
        ['app.html', 'index.html'].map(file => readFile(path.join(outputRoot, file), 'utf8')),
    ).then(pages => {
        const scripts = new Set();

        for (const page of pages) {
            for (const match of page.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)) {
                scripts.add(match[1]);
            }
        }
        if (!pages.every(page => /<script type="module"[^>]*src="\/assets\/root-/.test(page))) {
            throw new Error('Expected the root entry script in app.html and index.html.');
        }
        return scripts;
    });

const verifyLocaleChunks = serviceWorker =>
    Promise.all([readLocaleFiles(), htmlEntryScripts(), readdir(path.join(outputRoot, 'assets'))])
        .then(([locales, entryScripts, assets]) =>
            Promise.all(
                assets
                    .filter(file => file.endsWith('.js'))
                    .map(file =>
                        readFile(path.join(outputRoot, 'assets', file), 'utf8').then(code => ({
                            file: `assets/${file}`,
                            code,
                        })),
                    ),
            ).then(chunks => ({ locales, entryScripts, chunks })),
        )
        .then(({ locales, entryScripts, chunks }) => {
            const counts = new Map();

            for (const { strings } of locales) {
                for (const text of new Set(strings)) {
                    counts.set(text, (counts.get(text) ?? 0) + 1);
                }
            }
            const commonChunks = new Set();

            for (const { file, common, strings } of locales) {
                // The longest string of this file that no other locale file has.
                const marker = strings
                    .filter(text => VERBATIM.test(text) && counts.get(text) === 1)
                    .sort((left, right) => right.length - left.length)[0];

                if (!marker) {
                    throw new Error('No distinctive string to find in the bundle: ' + file);
                }
                const holders = chunks.filter(chunk => chunk.code.includes(marker));

                if (holders.length !== 1) {
                    throw new Error(
                        `${file} must be in exactly one chunk, found in: ${holders.map(chunk => chunk.file).join(', ') || 'none'}`,
                    );
                }
                const [holder] = holders;

                if (entryScripts.has(holder.file)) {
                    throw new Error(`${file} is in ${holder.file}, loaded by the entry HTML.`);
                }
                if (!serviceWorker.includes(`"${holder.file}"`)) {
                    throw new Error(`The locale chunk ${holder.file} (${file}) is not precached.`);
                }
                if (common) {
                    commonChunks.add(holder.file);
                }
            }
            const commonFiles = locales.filter(locale => locale.common).length;

            if (commonFiles < 2 || commonChunks.size !== commonFiles) {
                throw new Error(
                    `Expected one common chunk per locale (${commonFiles}), found ${commonChunks.size}.`,
                );
            }
        });

const verifyPublicPrecache = () => {
    return Promise.all([
        readFile(path.join(outputRoot, 'sitemap.xml'), 'utf8'),
        readFile(path.join(outputRoot, 'sw-app.js'), 'utf8'),
    ])
        .then(([sitemap, serviceWorker]) =>
            Promise.all([
                verifyWorkerFiles(serviceWorker),
                verifyRegistrationUrls(),
                verifyLocaleChunks(serviceWorker),
            ]).then(() => [sitemap, serviceWorker]),
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
