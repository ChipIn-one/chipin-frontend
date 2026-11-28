// Node side of the screen capture: where the artifact is written and how the manifest is read. The
// spec, the index reporter and the coverage test share these.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    parseScreenManifest,
    SCREEN_MANIFEST_URL,
    type ScreenManifest,
} from '../../src/test/screenManifest';

/**
 * The `screen-captures` artifact folder: `index.json` and `png/`. Gitignored; written only by the CI
 * capture (playwright.capture.config.ts refuses to run outside CI).
 */
// A variable, not a literal: Vite (the Vitest run of recipes.test.ts) rewrites
// `new URL('<literal>', import.meta.url)` into an asset import.
const FROM_MODULE_TO_OUTPUT = '../../screen-captures/';

export const CAPTURE_OUTPUT_DIR = fileURLToPath(new URL(FROM_MODULE_TO_OUTPUT, import.meta.url));

export const CAPTURE_INDEX_FILE = 'index.json';

/** The validated screen manifest (docs/design-system/screens.manifest.json). */
export const readScreenManifest = (): ScreenManifest =>
    parseScreenManifest(JSON.parse(readFileSync(SCREEN_MANIFEST_URL, 'utf8')) as unknown);
