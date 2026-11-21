import {
    baseConfig,
    fastModeConfig,
    formattingConfig,
    typeAwareConfig,
} from './config/eslint/base.js';
import { layerImports, layersConfig } from './config/eslint/layers.js';
import {
    projectConfig,
    projectImports,
    projectRules,
    projectSyntax,
    queryConfig,
    restrictedImports,
    restrictedSyntax,
} from './config/eslint/project.js';
import { reactConfig, reactSyntax } from './config/eslint/react.js';

// App directory relative to the repository root (the npm workspace @chipin/app, 04-0a).
const APP_DIR = 'apps/app';
// Framework-free workspace packages (spec 04 §1.3): linted by every preset except the React one.
const PACKAGES = 'packages/**';
// The Astro site (@chipin/site, spec 04 §3): its `.ts` files get every preset; `.astro` files are
// type-checked by `astro check` in the site CI step.
const SITE_DIR = 'apps/site';

export default [
    // Astro's generated types and the build output of the site and its test fixtures.
    { ignores: [`${SITE_DIR}/dist`, `${SITE_DIR}/**/.astro`, `${SITE_DIR}/test/fixtures/*/dist`] },
    ...baseConfig({ appDir: APP_DIR }),
    ...typeAwareConfig({ appDir: APP_DIR }),
    ...reactConfig().map(block => ({
        ...block,
        ignores: [...(block.ignores ?? []), PACKAGES],
    })),
    ...projectConfig({ appDir: APP_DIR }),
    ...queryConfig(),
    ...layersConfig({ appDir: APP_DIR }),
    // Each helper is called once with every entry of its rule (see config/eslint/project.js).
    ...restrictedImports([
        ...layerImports({ appDir: APP_DIR }),
        ...projectImports({ appDir: APP_DIR }),
    ]),
    ...restrictedSyntax([
        ...projectSyntax({ appDir: APP_DIR }),
        ...projectRules({ appDir: APP_DIR }),
        ...reactSyntax(),
    ]),
    {
        // Astro and Vitest load their config files through a default export.
        files: [`${SITE_DIR}/*.config.ts`],
        rules: { 'import-x/no-default-export': 'off' },
    },
    ...formattingConfig(),
    // CHIPIN_ESLINT_FAST=1 (pre-commit): no type-aware rules, no TS program.
    ...fastModeConfig(),
];
