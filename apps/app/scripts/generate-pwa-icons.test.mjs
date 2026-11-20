// Spec 05 §6 (05-2b): the PWA icons are drawn from the @chipin/tokens favicon and land in the app
// public/, not next to the source image (where the pwa-assets-generator CLI would write them).
import path from 'node:path';

import { generateAssets } from '@vite-pwa/assets-generator/api/generate-assets';
import { expect, test, vi } from 'vitest';

import { PWA_ICON_SOURCE, PWA_ICONS_OUT_DIR } from '../pwa-assets.config.ts';

import { generatePwaIcons } from './generate-pwa-icons.mjs';

vi.mock('@vite-pwa/assets-generator/api/generate-assets', () => ({ generateAssets: vi.fn() }));

const APP_DIR = path.resolve(import.meta.dirname, '..');

test('the icon source is packages/tokens/assets/favicon.svg', () => {
    expect(PWA_ICON_SOURCE).toBe(path.resolve(APP_DIR, '../../packages/tokens/assets/favicon.svg'));
});

test('the icons are written to apps/app/public by default', async () => {
    expect(PWA_ICONS_OUT_DIR).toBe(path.join(APP_DIR, 'public'));

    await expect(generatePwaIcons()).resolves.toBe(PWA_ICONS_OUT_DIR);

    expect(generateAssets).toHaveBeenCalledOnce();
    const [instruction, override, folder] = vi.mocked(generateAssets).mock.calls[0] ?? [];
    expect(folder).toBe(PWA_ICONS_OUT_DIR);
    expect(override).toBe(true);
    expect(instruction?.image).toBe(PWA_ICON_SOURCE);
    expect(
        Object.values(instruction?.transparent ?? {})
            .map(icon => icon.name)
            .sort(),
    ).toEqual(['pwa-192x192.png', 'pwa-512x512.png', 'pwa-64x64.png']);
});
