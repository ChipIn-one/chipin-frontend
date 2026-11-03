import { expect, test } from 'vitest';

import { shouldUploadSourcemaps } from './sentry-sourcemaps';

test('uploads source maps for a Vercel production build', () => {
    expect(shouldUploadSourcemaps({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe(true);
});

test.each([
    ['Vercel preview', { VERCEL: '1', VERCEL_ENV: 'preview', SENTRY_AUTH_TOKEN: 'token' }],
    ['Vercel development', { VERCEL: '1', VERCEL_ENV: 'development' }],
    ['local', {}],
    ['CI', { CI: 'true', SENTRY_AUTH_TOKEN: 'token' }],
    ['production env outside Vercel', { VERCEL_ENV: 'production' }],
])('skips the source map upload for a %s build', (_name, env) => {
    expect(shouldUploadSourcemaps(env)).toBe(false);
});
