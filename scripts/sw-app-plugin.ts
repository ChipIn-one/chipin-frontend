// Spec 04 §2.11 option (a) (04-4a1, D30): the app and the legacy hosts share one `dist`, and the
// filesystem wins over Vercel rewrites, so no file may sit at `/sw.js`. VitePWA keeps
// `filename: 'sw.js'` (the registration URL of `virtual:pwa-register` and of the manual
// `register('/sw.js')` stays `/sw.js`); this plugin renames the generated worker to `sw-app.js`,
// and `vercel.json` rewrites `/sw.js` by host to `/sw-app.js` or to the kill-switch `/sw-kill.js`.
// 04-5a removes the plugin, the kill-switch and the rewrites.
import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Plugin } from 'vite';

export const SW_REGISTRATION_FILE = 'sw.js';
export const SW_APP_FILE = 'sw-app.js';

const fileExists = (filePath: string): Promise<boolean> =>
    access(filePath).then(
        () => true,
        () => false,
    );

/**
 * Moves `<outDir>/sw.js` to `<outDir>/sw-app.js` and fails when VitePWA wrote no `sw.js`.
 * A `sw.js.map`, if one was emitted, moves to `sw-app.js.map` and the `sourceMappingURL` comment
 * follows it (the browser resolves it against `/sw.js`, so `sw-app.js.map` is found next to it).
 */
export const renameAppServiceWorker = async (outDir: string): Promise<void> => {
    const source = path.join(outDir, SW_REGISTRATION_FILE);
    const target = path.join(outDir, SW_APP_FILE);

    if (!(await fileExists(source))) {
        throw new Error(
            `Expected VitePWA to write ${source} before the rename to ${SW_APP_FILE} (04-4a1).`,
        );
    }

    await rename(source, target);

    const sourceMap = `${source}.map`;

    if (!(await fileExists(sourceMap))) {
        return;
    }

    await rename(sourceMap, `${target}.map`);

    const code = await readFile(target, 'utf8');

    await writeFile(
        target,
        code.replace(
            `sourceMappingURL=${SW_REGISTRATION_FILE}.map`,
            `sourceMappingURL=${SW_APP_FILE}.map`,
        ),
    );
};

/**
 * Must come after `VitePWA()` in `plugins`: VitePWA's build plugin is `enforce: 'post'` and writes
 * the worker in a `sequential` `closeBundle` without an order (vite-plugin-pwa 1.3.0
 * `dist/index.js:397,416`), so this `order: 'post'` hook runs after it.
 */
export const swAppPlugin = (): Plugin => {
    let outDir = '';
    let isSsrBuild = false;

    return {
        name: 'chipin:sw-app',
        enforce: 'post',
        configResolved(config) {
            outDir = path.resolve(config.root, config.build.outDir);
            isSsrBuild = Boolean(config.build.ssr);
        },
        closeBundle: {
            sequential: true,
            order: 'post',
            async handler() {
                if (isSsrBuild) {
                    return;
                }

                await renameAppServiceWorker(outDir);
            },
        },
        // `vite preview` has no Vercel rewrites: serve the app worker at its registration URL.
        configurePreviewServer(server) {
            server.middlewares.use((request, response, next) => {
                const pathname = (request.url ?? '').split('?')[0];

                if (pathname !== `/${SW_REGISTRATION_FILE}`) {
                    next();
                    return;
                }

                readFile(path.join(outDir, SW_APP_FILE)).then(
                    code => {
                        response.statusCode = 200;
                        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
                        response.setHeader('Cache-Control', 'no-cache');
                        response.end(code);
                    },
                    (error: unknown) => {
                        next(error);
                    },
                );
            });
        },
    };
};
