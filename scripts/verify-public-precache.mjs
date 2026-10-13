// Validate the final public HTML was actually scanned by Workbox after SSG.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const outputRoot = path.resolve('dist');

const verifyPublicPrecache = () => {
    return Promise.all([
        readFile(path.join(outputRoot, 'sitemap.xml'), 'utf8'),
        readFile(path.join(outputRoot, 'sw.js'), 'utf8'),
    ]).then(([sitemap, serviceWorker]) => {
        const publicPaths = Array.from(
            sitemap.matchAll(/<loc>https:\/\/chipin\.one([^<]*)<\/loc>/g),
            match => match[1],
        );

        if (publicPaths.length === 0 || new Set(publicPaths).size !== publicPaths.length) {
            throw new Error('Expected nonempty, unique indexable URLs in sitemap.');
        }

        return Promise.all(publicPaths.map(publicPath => {
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
            });
        }));
    }).then(() => {
        process.stdout.write('Verified final Workbox public HTML precache\\n');
    });
};

verifyPublicPrecache().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
