// `npm run icons:generate` (spec 05 §6): the PWA icons are drawn from the favicon of @chipin/tokens
// and written to the app `public/`. The `pwa-assets-generator` CLI always writes next to the source
// image (it would write into `packages/tokens/assets/`), so this script calls the generator API with
// an explicit output folder. It reads the preset and the source from `pwa-assets.config.ts`.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateAssets } from '@vite-pwa/assets-generator/api/generate-assets';
import { instructions } from '@vite-pwa/assets-generator/api/instructions';

import pwaAssetsConfig, { PWA_ICON_SOURCE, PWA_ICONS_OUT_DIR } from '../pwa-assets.config.ts';

/**
 * Generates the PWA icons; returns the folder they were written to.
 * @param {{ image?: string, outDir?: string }} [options] the source SVG and the output folder
 * @returns {Promise<string>}
 */
export const generatePwaIcons = async ({
    image = PWA_ICON_SOURCE,
    outDir = PWA_ICONS_OUT_DIR,
} = {}) => {
    const { preset } = pwaAssetsConfig;
    if (!preset) {
        throw new Error('pwa-assets.config.ts has no preset');
    }
    const instruction = await instructions({
        imageResolver: () => readFile(image),
        imageName: image,
        originalName: basename(image),
        preset,
        faviconPreset: pwaAssetsConfig.headLinkOptions?.preset,
        htmlLinks: { xhtml: false, includeId: false },
        basePath: '/',
        resolveSvgName: name => basename(name),
    });
    await generateAssets(instruction, true, outDir, message => console.log(message));
    return outDir;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const [outDir] = process.argv.slice(2);
    await generatePwaIcons(outDir ? { outDir } : {});
}
