import { baseConfig, formattingConfig } from './config/eslint/base.js';
import { layerImports } from './config/eslint/layers.js';
import {
    projectConfig,
    projectImports,
    projectSyntax,
    restrictedImports,
    restrictedSyntax,
} from './config/eslint/project.js';
import { reactConfig } from './config/eslint/react.js';

// App directory relative to the repository root: '.' now, 'apps/app' after the monorepo move.
const APP_DIR = '.';

export default [
    ...baseConfig({ appDir: APP_DIR }),
    ...reactConfig(),
    ...projectConfig({ appDir: APP_DIR }),
    // Each helper is called once with every entry of its rule (see config/eslint/project.js).
    ...restrictedImports([...layerImports({ appDir: APP_DIR }), ...projectImports()]),
    ...restrictedSyntax(projectSyntax()),
    ...formattingConfig(),
];
