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
    projectSyntax,
    restrictedImports,
    restrictedSyntax,
} from './config/eslint/project.js';
import { reactConfig, reactSyntax } from './config/eslint/react.js';

// App directory relative to the repository root: '.' now, 'apps/app' after the monorepo move.
const APP_DIR = '.';

export default [
    ...baseConfig({ appDir: APP_DIR }),
    ...typeAwareConfig({ appDir: APP_DIR }),
    ...reactConfig({ appDir: APP_DIR }),
    ...projectConfig({ appDir: APP_DIR }),
    ...layersConfig({ appDir: APP_DIR }),
    // Each helper is called once with every entry of its rule (see config/eslint/project.js).
    ...restrictedImports([...layerImports({ appDir: APP_DIR }), ...projectImports()]),
    ...restrictedSyntax([
        ...projectSyntax({ appDir: APP_DIR }),
        ...reactSyntax({ appDir: APP_DIR }),
    ]),
    ...formattingConfig(),
    // CHIPIN_ESLINT_FAST=1 (pre-commit): no type-aware rules, no TS program.
    ...fastModeConfig(),
];
