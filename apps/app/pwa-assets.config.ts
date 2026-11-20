import { resolve } from 'node:path';

import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

/** The brand mark the icons are drawn from: it lives in @chipin/tokens (spec 05 §6). */
export const PWA_ICON_SOURCE = resolve(
    import.meta.dirname,
    '../../packages/tokens/assets/favicon.svg',
);

/**
 * Where the generated PNG/ICO icons go: the app `public/` (served at `/pwa-*.png` etc.). The
 * `pwa-assets-generator` CLI would write them next to the source image, i.e. into the tokens
 * package, so `npm run icons:generate` runs `scripts/generate-pwa-icons.mjs` with this folder.
 */
export const PWA_ICONS_OUT_DIR = resolve(import.meta.dirname, 'public');

export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset,
    images: [PWA_ICON_SOURCE],
});
