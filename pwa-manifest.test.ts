import { describe, expect, test } from 'vitest';

import {
    createPwaManifest,
    DEV_PWA_APP_NAME,
    PROD_PWA_APP_NAME,
} from './pwa-manifest';

describe('PWA manifest names', () => {
    test('keeps the production app name clean', () => {
        const manifest = createPwaManifest(PROD_PWA_APP_NAME);

        expect(manifest.name).toBe('ChipIn');
        expect(manifest.short_name).toBe('ChipIn');
    });

    test('marks development installs explicitly', () => {
        const manifest = createPwaManifest(DEV_PWA_APP_NAME);

        expect(manifest.name).toBe('ChipIn DEV');
        expect(manifest.short_name).toBe('ChipIn DEV');
    });
});
