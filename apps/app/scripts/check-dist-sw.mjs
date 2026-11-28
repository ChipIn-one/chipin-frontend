// Spec 04 §2.11 (04-5b): the app worker is `dist/sw.js`, served at `/sw.js` from the filesystem.
// Runs after `vite build` (`build`, `vercel-build`) and fails the build when VitePWA wrote no
// worker, so a deploy never ships without one (the guard the removed rename plugin used to give).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** The error text when `<distDir>/sw.js` is missing, or null when it is there. */
export const missingServiceWorker = distDir => {
    const worker = path.join(distDir, 'sw.js');

    return existsSync(worker) ? null : `Expected VitePWA to write ${worker} (spec 04 §2.11).`;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const error = missingServiceWorker(path.resolve(import.meta.dirname, '..', 'dist'));

    if (error) {
        console.error(error);
        process.exit(1);
    }
}
