import { resolve } from 'node:path';

import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import boundaries from 'eslint-plugin-boundaries';
import importX from 'eslint-plugin-import-x';

import { appGlob, isFastMode } from './base.js';

// Layer boundaries (spec 02 §D5, invariant 1). This module is the only source of the layer
// graph: `boundaries/elements` and the `boundaries/dependencies` policies are built from
// LAYER_ELEMENTS and LAYER_GRAPH, and docs/engineering/rules/10-architecture.md gets its table
// from them through scripts/generate-layers-doc.mjs. The runtime `api/` and Axios boundaries stay
// `no-restricted-imports` entries (layerImports below): they allow type imports.
//
// Aliases: boundaries and import-x see a layer only through the `paths` aliases of
// tsconfig.app.json; an import they cannot resolve is silently skipped, not reported. Every new
// layer folder (e.g. `src/shared`, `src/entities`, `src/app` from specs 03/04) must add its `paths`
// alias in the same PR as its first file, otherwise its imports are unchecked. A file outside every
// element below is a `boundaries/no-unknown-files` error.

/** Rulebook section every boundary message points to. */
export const LAYERS_DOC = 'docs/engineering/rules/10-architecture.md';

// Element types describe the current folders (the code is not moved). Every pattern has an explicit
// `mode` (A-35): `file` for single files, `folder` for directories. Patterns are relative to `src/`;
// the first matching element wins, so `app` files come before `pages`/`features`, and `shared-api`
// before `shared-lib`.
export const LAYER_ELEMENTS = [
    {
        type: 'app',
        description: 'composition root: entry points, bootstrap, router, public routes',
        patterns: [
            { pattern: 'main.tsx', mode: 'file' },
            { pattern: 'root.tsx', mode: 'file' },
            { pattern: 'pages/GlobalHooks.tsx', mode: 'file' },
            { pattern: 'app', mode: 'folder' },
            { pattern: 'bootstrap', mode: 'folder' },
            { pattern: 'features/routing', mode: 'folder' },
            { pattern: 'public-routes', mode: 'folder' },
        ],
    },
    {
        type: 'pages',
        description: 'route screens',
        patterns: [
            { pattern: 'pages/*', mode: 'folder', capture: ['slice'] },
            { pattern: 'pages/*', mode: 'file', capture: ['slice'] },
        ],
    },
    {
        type: 'features',
        description: 'user capabilities',
        patterns: [
            { pattern: 'features/*', mode: 'folder', capture: ['slice'] },
            { pattern: 'features/*', mode: 'file', capture: ['slice'] },
        ],
    },
    {
        type: 'entities',
        description: 'queries, mappers, domain models (spec 03)',
        patterns: [
            { pattern: 'entities/*', mode: 'folder', capture: ['slice'] },
            { pattern: 'entities/*', mode: 'file', capture: ['slice'] },
        ],
    },
    {
        type: 'store',
        description: 'UI stores (spec 03 §6)',
        patterns: [{ pattern: 'store', mode: 'folder' }],
    },
    {
        type: 'components',
        description: 'project components',
        patterns: [{ pattern: 'components', mode: 'folder' }],
    },
    {
        type: 'basics',
        description: 'UI primitives and the design system',
        patterns: [
            { pattern: 'basics', mode: 'folder' },
            { pattern: 'design-system', mode: 'folder' },
        ],
    },
    {
        type: 'hooks',
        description: 'shared hooks',
        patterns: [{ pattern: 'hooks', mode: 'folder' }],
    },
    {
        type: 'helpers',
        description: 'pure helpers',
        patterns: [{ pattern: 'helpers', mode: 'folder' }],
    },
    {
        type: 'shared-api',
        description: 'the api() client, query client, persister, outbox',
        patterns: [
            { pattern: 'shared/api', mode: 'folder' },
            { pattern: 'shared/offline', mode: 'folder' },
        ],
    },
    {
        type: 'shared-lib',
        description: 'the rest of shared/ (money, lib)',
        patterns: [{ pattern: 'shared', mode: 'folder' }],
    },
    {
        type: 'api',
        description: 'runtime API modules and DTO types',
        patterns: [{ pattern: 'api', mode: 'folder' }],
    },
    {
        type: 'test',
        description: 'test support: setup, fixtures, helpers (only test files import it)',
        patterns: [{ pattern: 'test', mode: 'folder' }],
    },
    {
        type: 'base',
        description: 'constants, types, i18n, styles, assets',
        patterns: [
            { pattern: 'constants', mode: 'folder' },
            { pattern: 'types', mode: 'folder' },
            { pattern: 'i18n', mode: 'folder' },
            { pattern: 'styles', mode: 'folder' },
            { pattern: 'assets', mode: 'folder' },
        ],
    },
];

export const LAYER_TYPES = LAYER_ELEMENTS.map(element => element.type);

/** Test support (`src/test/`): it may import any layer; only TEST_FILES may import it. */
export const TEST_TYPE = 'test';

/** Every element type except test support: what production code is made of. */
export const PRODUCTION_TYPES = LAYER_TYPES.filter(type => type !== TEST_TYPE);

/** Test files (patterns relative to `src/`): they keep their folder's element and may import `test`. */
export const TEST_FILES = ['**/*.{test,spec}.{ts,tsx}'];

// "from" → the element types it may import (spec 02 §D5). The graph is acyclic: `store → entities`
// is allowed, `entities → store` is not. A type listed in INDEX_ONLY may import another slice of
// its own type only through that slice's `index.ts`.
export const LAYER_GRAPH = {
    app: PRODUCTION_TYPES,
    pages: [
        'features',
        'components',
        'basics',
        'hooks',
        'store',
        'entities',
        'helpers',
        'shared-lib',
        'api',
        'base',
    ],
    features: [
        'features',
        'components',
        'basics',
        'hooks',
        'store',
        'entities',
        'helpers',
        'shared-lib',
        'api',
        'base',
    ],
    components: [
        'components',
        'basics',
        'hooks',
        'store',
        'entities',
        'helpers',
        'shared-lib',
        'api',
        'base',
    ],
    hooks: ['hooks', 'store', 'entities', 'helpers', 'shared-api', 'shared-lib', 'api', 'base'],
    store: ['store', 'entities', 'helpers', 'shared-api', 'shared-lib', 'api', 'base'],
    entities: ['entities', 'helpers', 'shared-api', 'shared-lib', 'api', 'base'],
    basics: ['basics', 'helpers', 'shared-lib', 'base'],
    helpers: ['helpers', 'shared-lib', 'base'],
    'shared-api': ['shared-api', 'shared-lib', 'api', 'base'],
    'shared-lib': ['shared-lib', 'base'],
    api: ['api', 'base'],
    test: LAYER_TYPES,
    base: ['base'],
};

/** Types that see another slice of their own type only through its `index.ts`. */
export const INDEX_ONLY = ['features', 'entities'];

const INDEX_FILE = 'index.{ts,tsx}';

/** The `[layers]` message of a disallowed dependency of `from`: what it may import instead. */
export const layerMessage = from => {
    const allowed = LAYER_GRAPH[from].filter(type => type !== from || !INDEX_ONLY.includes(from));
    const sameType = INDEX_ONLY.includes(from)
        ? `, another ${from} slice only via its index.ts`
        : '';

    return (
        `[layers] ${from} cannot import {{to.element.type}} (${LAYERS_DOC}). ` +
        `${from} may import: ${allowed.join(', ')}${sameType}. ` +
        'Move the shared code down to a layer both can import, or pass the value in from above.'
    );
};

/** `boundaries/elements` settings: one descriptor per pattern, in LAYER_ELEMENTS order. */
export const boundaryElements = ({ appDir }) =>
    LAYER_ELEMENTS.flatMap(({ type, patterns }) =>
        patterns.map(({ pattern, mode, capture }) => ({
            type,
            pattern: appGlob(appDir, `src/${pattern}`),
            mode,
            ...(capture ? { capture } : {}),
        })),
    );

/** `boundaries/dependencies` policies: per "from" type, a disallow with its fix hint, then allows. */
export const boundaryPolicies = () =>
    LAYER_TYPES.flatMap(from => {
        const allowed = LAYER_GRAPH[from];
        const policies = [
            {
                from: { element: { type: from } },
                disallow: { to: { element: { types: LAYER_TYPES } } },
                message: layerMessage(from),
            },
        ];
        const others = allowed.filter(type => type !== from || !INDEX_ONLY.includes(from));

        if (others.length > 0) {
            policies.push({
                from: { element: { type: from } },
                allow: { to: { element: { types: others } } },
            });
        }
        if (INDEX_ONLY.includes(from) && allowed.includes(from)) {
            policies.push({
                from: { element: { type: from } },
                allow: { to: { element: { type: from, fileInternalPath: INDEX_FILE } } },
            });
        }
        return policies;
    }).concat({
        // Test files may import test support whatever their layer; production files may not.
        from: { file: { categories: TEST_TYPE } },
        allow: { to: { element: { type: TEST_TYPE } } },
    });

/** `boundaries/files` settings: TEST_FILES get the `test` file category. */
export const boundaryFiles = ({ appDir }) =>
    TEST_FILES.map(pattern => ({
        pattern: appGlob(appDir, `src/${pattern}`),
        category: TEST_TYPE,
    }));

// FAST mode (pre-commit) never runs the whole-project `no-cycle`, even if FULL is also set.
const FULL_MODE = process.env.CHIPIN_ESLINT_FULL === '1' && !isFastMode;

/**
 * The layer graph and slice entry (`boundaries/dependencies`: another `features`/`entities` slice
 * only through its `index.ts`; D27: file imports inside a slice and in plain layers are allowed)
 * and, in the full mode only (`lint:full`, CI), `import-x/no-cycle`.
 */
export const layersConfig = ({ appDir }) => {
    const appRoot = resolve(import.meta.dirname, '../..', appDir);
    const project = resolve(appRoot, 'tsconfig.app.json');
    const sourceFiles = appGlob(appDir, 'src/**/*.{ts,tsx}');

    return [
        {
            name: 'chipin/layers',
            files: [sourceFiles],
            plugins: { boundaries, 'import-x': importX },
            settings: {
                // boundaries resolves through eslint-module-utils (`import/resolver`), import-x
                // through its own `resolver-next`; both use the tsconfig.app.json `paths`.
                'import/resolver': { typescript: { project } },
                'import-x/resolver-next': [createTypeScriptImportResolver({ project })],
                // `no-cycle` parses the imported TS modules itself; without these it skips them.
                'import-x/extensions':
                    importX.flatConfigs.typescript.settings['import-x/extensions'],
                'import-x/external-module-folders':
                    importX.flatConfigs.typescript.settings['import-x/external-module-folders'],
                'import-x/parsers': importX.flatConfigs.typescript.settings['import-x/parsers'],
                'boundaries/elements': boundaryElements({ appDir }),
                'boundaries/files': boundaryFiles({ appDir }),
                // Spec 02 §D5 (A-35) requires an explicit `mode` on every element, which v7 reports
                // as deprecated on every run; the graph is pinned to it until the plugin drops it.
                'boundaries/legacy-warnings': false,
            },
            rules: {
                'boundaries/dependencies': [
                    'error',
                    {
                        default: 'disallow',
                        message: `[layers] {{from.element.type}} cannot import {{to.element.type}} (${LAYERS_DOC}).`,
                        policies: boundaryPolicies(),
                    },
                ],
                // Every file under src/ belongs to an element: a new top-level folder must be
                // classified in LAYER_ELEMENTS (and get its tsconfig `paths` alias).
                'boundaries/no-unknown-files': 'error',
                ...(FULL_MODE
                    ? { 'import-x/no-cycle': ['error', { maxDepth: 3, ignoreExternal: true }] }
                    : {}),
            },
        },
    ];
};

const RUNTIME_API_MODULE =
    '^(?:api/|(?:\\.\\.?/)+(?:[^/]+/)*api/)(?!.*\\.types(?:\\.[cm]?[jt]sx?)?$)';

/** `no-restricted-imports` entries for the layer boundaries. */
export const layerImports = ({ appDir }) => {
    // These modules own the configured Axios instance and interceptors, and the `api()` wrapper
    // over it (its test drives the real Axios pipeline with a stub adapter).
    const axiosOwners = appGlob(
        appDir,
        'src/{api/chipin.{instance,interceptors}.ts,shared/api/client{,.test}.ts}',
    );
    const ui = appGlob(appDir, 'src/{pages,features,components,basics}/**/*.{ts,tsx}');
    const numbers = appGlob(appDir, 'src/{helpers/numbers.ts,basics/numbers/**/*.{ts,tsx}}');
    // Layers of the target architecture (specs 03/04): new code there reads money from the wire.
    const newLayers = appGlob(appDir, 'src/{app,shared,entities}/**/*.{ts,tsx}');
    const balanceEntity = appGlob(appDir, 'src/entities/balance/**');

    return [
        {
            id: 'axios',
            path: 'axios',
            ignores: [axiosOwners, ui, numbers],
            message: 'Use the configured Axios instance from src/api.',
        },
        {
            id: 'axios-in-ui',
            path: 'axios',
            files: [ui],
            ignores: [numbers],
            message: 'UI must call stores or hooks, not Axios.',
        },
        {
            id: 'axios-in-numbers',
            path: 'axios',
            files: [numbers],
            message: 'The number layer cannot call Axios.',
        },
        {
            id: 'runtime-api-in-ui',
            pattern: { regex: RUNTIME_API_MODULE, allowTypeImports: true },
            files: [ui],
            ignores: [numbers],
            message: 'UI must call a store action instead of a runtime API module.',
        },
        {
            id: 'runtime-api-in-numbers',
            pattern: { regex: RUNTIME_API_MODULE, allowTypeImports: true },
            files: [numbers],
            message: 'The number layer cannot call runtime API modules.',
        },
        {
            // spec 03 §4.1 item 5: the number → Money bridge serves only the legacy `src/api/*`
            // stores until they migrate; only entities/balance itself may use it in the new layers.
            id: 'money-legacy-bridge',
            // The alias `entities/balance[/...]` and any relative path through a `balance` folder
            // (`../balance`, `../../entities/balance/model/legacy`).
            pattern: {
                regex: '^(?:entities/balance|(?:\\.\\.?/)+(?:[^/]+/)*balance)(?:/.*)?$',
                importNamePattern: '^legacy',
            },
            files: [newLayers],
            ignores: [balanceEntity],
            message:
                'legacy* adapters are for not-yet-migrated stores; read amounts with moneyFromWire in an entities/*/model mapper.',
        },
    ];
};
