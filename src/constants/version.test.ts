import { expect, test } from 'vitest';

import { resolveAppVersion } from '../../scripts/version-resolver.mjs';

import { APP_VERSION } from './version';

test('uses the resolver-computed runtime version in the test environment', () => {
    expect(APP_VERSION).toBe(resolveAppVersion());
    expect(APP_VERSION).not.toBe('0.0.0-test');
});
