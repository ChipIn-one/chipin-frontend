import { expect, test } from 'vitest';

import { shouldRegisterServiceWorker } from './serviceWorkerHost';

// 04-4a1 (spec 04 §2.11): the legacy hosts serve the kill-switch at /sw.js and register nothing.
test.each(['chipin.one', 'dev.chipin.one', 'CHIPIN.ONE', 'chipin.one.'])(
    'does not register a worker on the legacy host %s',
    hostname => {
        expect(shouldRegisterServiceWorker(hostname)).toBe(false);
    },
);

test.each([
    'app.chipin.one',
    'app-dev.chipin.one',
    'chipin-git-feature-123.vercel.app',
    'chipin-frontend.vercel.app',
    'localhost',
    '127.0.0.1',
    'www.chipin.one',
    'issue-199.dev.chipin.one',
    'chipin.one.example.com',
])('keeps registering on %s', hostname => {
    expect(shouldRegisterServiceWorker(hostname)).toBe(true);
});
