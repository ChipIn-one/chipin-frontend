#!/usr/bin/env bash
# PR 04-0a (spec 04 §1.6 items 1-5 and 7): moves the SPA into the npm workspace `apps/app`
# (`@chipin/app`) without a behavior change. Review = run this script on a clean checkout of the
# base commit and compare the tree with the PR (`git add -A && git diff --stat <PR commit>`).
#
# Usage (repository root, clean tree of base 69b2cbde with its node_modules, network for npm
# registry metadata):
#   npm ci && bash scripts/move-to-workspace.sh
# (the script does not exist at the base: copy it into the checkout first)
#
# Hand edits on top of the script output (the only expected difference in the rerun diff):
#   - scripts/version-resolver.mjs, scripts/version-resolver.test.mjs: the repository root from
#     `import.meta.dirname`, not `process.cwd()`, and a test that apps/app resolves the same version;
#   - scripts/check-baseline.mjs, scripts/check-baseline.test.mjs: base-commit suppression keys of
#     the moved folders are read under `apps/app/`, so the move itself is not baseline growth;
#   - scripts/release-qa/ui-paths.mjs, scripts/release-qa/runtime.mjs and their tests: the
#     dependency evidence reads the root and the app `package.json` together.
#
# Classification of the former `scripts/` and of the root folders (who consumes them decides):
#   repo-level, stay in /scripts (release, CI and lint tooling; none reads app sources at runtime):
#     version-resolver* (imported by apps/app/vite.config.ts, but it is the product version of the
#       whole repository and is read by release tooling), ci-gate-policy* (CI mode for the whole
#       repository), create-pr* (PR tooling), release-qa-*.mjs and release-qa/ (release QA of the
#       repository), release-on-production.test.mjs, forward-production-deployment*,
#       redeploy-tagged-production* (deployment workflows), check-baseline* (eslint-suppressions.json
#       ratchet), check-file-layout* (repository check; lists apps/app/src), check-rule-registry*
#       (root ESLint config), generate-layers-doc* (config/eslint -> docs), eslint-fix-staged.mjs
#       (root lint-staged), move-to-workspace.sh (this script).
#   app, move to apps/app/scripts (they read or write app sources or the app build):
#     prerender-public.mjs, prerender-before-workbox.* (Vite/Workbox build steps),
#     verify-public-precache.mjs (checks apps/app/dist), private-spa-navigation.* (SW allowlist
#     imported by vite.config.ts), sentry-sourcemaps.* and sw-app-plugin.* (imported by
#     vite.config.ts), sw-kill.test.mjs (reads public/sw-kill.js), sw-registration-sites.test.mjs
#     (scans src/), run-task-tests.mjs and taskTestArgs.* (the app test runner), api/ (generates
#     src/shared/api/generated from openapi/), offline/ (writes src/shared/offline).
#   other folders and files:
#     openapi/ -> apps/app/openapi (read and written only by apps/app/scripts/api and its tests);
#     contract-tests/ -> apps/app (run by apps/app/vitest.contract.config.ts);
#     ds-gallery/ -> apps/app (renders app components through the app tsconfig aliases);
#     eslint-suppressions.json stays at the root (`eslint .` runs at the root), keys rewritten;
#     config/ stays at the root (ESLint presets; file-layout-baseline.json is read by the
#       repo-level check-file-layout, its paths stay relative to apps/app so `--base` against a
#       pre-move commit compares like with like);
#     tsconfig.base.json, prettier.config.js, eslint.config.js, .husky/ stay at the root.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ -e apps/app ]; then
    echo "apps/app already exists: run this script on a clean checkout of the base commit" >&2
    exit 1
fi

APP=apps/app
mkdir -p "$APP/scripts"

# 1. Renames (spec 04 §1.6 item 1).
git mv src public index.html app.html contract-tests ds-gallery openapi \
    vite.config.ts vitest.config.ts vitest.contract.config.ts \
    tsconfig.json tsconfig.app.json tsconfig.node.json pwa-assets.config.ts \
    vercel.json vercel.config.test.js \
    "$APP/"

git mv scripts/api scripts/offline "$APP/scripts/"
git mv \
    scripts/prerender-before-workbox.d.mts \
    scripts/prerender-before-workbox.mjs \
    scripts/prerender-before-workbox.test.mjs \
    scripts/prerender-public.mjs \
    scripts/private-spa-navigation.test.ts \
    scripts/private-spa-navigation.ts \
    scripts/run-task-tests.mjs \
    scripts/sentry-sourcemaps.test.ts \
    scripts/sentry-sourcemaps.ts \
    scripts/sw-app-plugin.test.ts \
    scripts/sw-app-plugin.ts \
    scripts/sw-kill.test.mjs \
    scripts/sw-registration-sites.test.mjs \
    scripts/taskTestArgs.mjs \
    scripts/taskTestArgs.test.mjs \
    scripts/verify-public-precache.mjs \
    "$APP/scripts/"

# 2-4. Generated files and mechanical path edits. Every replacement must match, or the script fails.
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const write = (path, text) => writeFileSync(path, text);

const sub = (path, from, to, { all = false } = {}) => {
    const text = read(path);
    const hits = typeof from === 'string' ? text.split(from).length - 1 : (text.match(from) ?? []).length;

    if (hits === 0 || (!all && hits !== 1)) {
        throw new Error(`${path}: expected ${all ? 'matches' : 'one match'} of ${from}, found ${hits}`);
    }
    write(path, all && typeof from === 'string' ? text.replaceAll(from, to) : text.replace(from, to));
};

const APP = 'apps/app';
const json = value => `${JSON.stringify(value, null, 4)}\n`;

// --- package.json: root workspace + @chipin/app (spec 04 §1.2) ---------------------------------
const pkg = JSON.parse(read('package.json'));

// Tooling the root scripts and configs load (eslint.config.js, config/eslint/*, prettier, husky,
// lint-staged, the repository tests in scripts/ and config/). Everything else belongs to the app.
const ROOT_DEV = new Set([
    '@eslint/js',
    '@tanstack/eslint-plugin-query',
    '@types/node',
    'eslint-config-prettier',
    'eslint-import-resolver-typescript',
    'eslint-plugin-boundaries',
    'eslint-plugin-import-x',
    'eslint-plugin-jsx-a11y',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    'eslint-plugin-react-refresh',
    'eslint-plugin-simple-import-sort',
    'eslint-plugin-unused-imports',
    'globals',
    'husky',
    'lint-staged',
    'prettier',
    'typescript',
    'typescript-eslint',
    'vitest',
    'yaml',
]);
const pick = (deps, keep) => Object.fromEntries(Object.entries(deps).filter(([name]) => keep(name)));

for (const name of ROOT_DEV) {
    if (!(name in pkg.devDependencies)) {
        throw new Error(`root devDependency ${name} is not in package.json`);
    }
}

const APP_SCRIPTS = [
    'dev',
    'build',
    'test',
    'test:task',
    'test:full',
    'typecheck',
    'vercel-build',
    'preview',
    'icons:generate',
    'test:contract',
    'test:contract:smoke',
    'test:contract:full',
    'prerender:public',
    'verify:public-precache',
    'build:ds-gallery',
    'api:fetch',
    'api:fetch:staging',
    'api:gen',
    'api:check',
];
const proxy = name => `npm run ${name} -w @chipin/app --`;
const rootScripts = {};

for (const [name, command] of Object.entries(pkg.scripts)) {
    rootScripts[name] = APP_SCRIPTS.includes(name) ? proxy(name) : command;
}
// The repository tests (scripts/, config/) run at the root; `test:full` runs both suites.
rootScripts['test:full'] = 'npm run test:full -w @chipin/app && npm run test:repo';
rootScripts['test:repo'] = 'vitest run';

// The app also declares the root tooling it runs itself (tsc -b, vitest, the yaml/typescript imports
// of its scripts, Node types of its tsconfig.node.json), with the root ranges: npm dedupes them, so
// a workspace-scoped install still has them and the resolved package set does not change.
const APP_ALSO = ['@types/node', 'typescript', 'vitest', 'yaml'];
const sortKeys = deps => Object.fromEntries(Object.entries(deps).sort(([a], [b]) => (a < b ? -1 : 1)));

const appPackage = {
    name: '@chipin/app',
    private: true,
    type: 'module',
    scripts: Object.fromEntries(APP_SCRIPTS.map(name => [name, pkg.scripts[name]])),
    dependencies: pkg.dependencies,
    devDependencies: sortKeys(
        pick(pkg.devDependencies, name => !ROOT_DEV.has(name) || APP_ALSO.includes(name)),
    ),
    // Vercel reads the Node.js version from the package.json of the Root Directory.
    engines: pkg.engines,
};
const rootPackage = {
    name: pkg.name,
    private: true,
    version: pkg.version,
    type: 'module',
    workspaces: ['apps/*', 'packages/*'],
    scripts: rootScripts,
    'lint-staged': pkg['lint-staged'],
    devDependencies: pick(pkg.devDependencies, name => ROOT_DEV.has(name)),
    allowScripts: pkg.allowScripts,
    engines: pkg.engines,
};
const known = new Set([...Object.keys(rootPackage), 'dependencies', 'description']);
const dropped = Object.keys(pkg).filter(key => !known.has(key));

if (dropped.length > 0) {
    throw new Error(`package.json fields not carried over: ${dropped.join(', ')}`);
}
write('package.json', json(rootPackage));
write(`${APP}/package.json`, json(appPackage));

// --- root vitest config for the repository tests ------------------------------------------------
write(
    'vitest.config.mjs',
    `import { defineConfig } from 'vitest/config';

// Repository-level tests (scripts/, config/); the app tests run in apps/app (\`npm run test:full\`
// runs both).
export default defineConfig({
    test: {
        include: ['scripts/**/*.test.{mjs,ts}', 'config/**/*.test.mjs'],
        environment: 'node',
        // These suites start ESLint, tsc and git; the first ESLint lint of a file builds the
        // resolver and config (5-7 s on a busy machine, over the 5 s default).
        testTimeout: 20_000,
        clearMocks: true,
        restoreMocks: true,
    },
});
`,
);

// --- app configs --------------------------------------------------------------------------------
sub(
    `${APP}/vite.config.ts`,
    "import { resolveAppVersionInfo } from './scripts/version-resolver.mjs';\n",
    '',
);
sub(
    `${APP}/vite.config.ts`,
    'import {\n    addPublicDirectoryAliases,',
    "import { resolveAppVersionInfo } from '../../scripts/version-resolver.mjs';\n\nimport {\n    addPublicDirectoryAliases,",
);
sub(
    `${APP}/vitest.config.ts`,
    "from './scripts/version-resolver.mjs'",
    "from '../../scripts/version-resolver.mjs'",
);
sub(
    `${APP}/src/constants/version.test.ts`,
    "from '../../scripts/version-resolver.mjs'",
    "from '../../../../scripts/version-resolver.mjs'",
);
for (const name of ['tsconfig.app.json', 'tsconfig.node.json']) {
    sub(`${APP}/${name}`, '"extends": "./tsconfig.base.json"', '"extends": "../../tsconfig.base.json"');
}

sub(
    `${APP}/vercel.config.test.js`,
    "import { existsSync, readFileSync } from 'node:fs';\n",
    "import { existsSync, readFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\n",
);
sub(
    `${APP}/vercel.config.test.js`,
    "const config = JSON.parse(readFileSync('vercel.json', 'utf8'));\n",
    "const config = JSON.parse(readFileSync(resolve(import.meta.dirname, 'vercel.json'), 'utf8'));\nconst DIST = resolve(import.meta.dirname, 'dist');\n",
);
sub(`${APP}/vercel.config.test.js`, /existsSync\('dist\/([^']+)'\)/g, "existsSync(resolve(DIST, '$1'))", {
    all: true,
});

// Vercel (Root Directory apps/app) would otherwise install with cwd = apps/app: a workspace-scoped
// install without the root devDependencies that still runs the root `prepare` (husky, exit 127).
sub(
    `${APP}/vercel.json`,
    '    "buildCommand": "npm run vercel-build",\n',
    '    "buildCommand": "npm run vercel-build",\n    "installCommand": "cd ../.. && npm ci",\n',
);
{
    const path = `${APP}/vercel.config.test.js`;
    write(
        path,
        `${read(path)}
// 04-0a: Vercel builds with Root Directory apps/app; the install runs at the workspace root from
// the root lockfile, like CI (a workspace-scoped install misses the root tooling, husky fails).
test('installs from the workspace root lockfile', () => {
    expect(config.installCommand).toBe('cd ../.. && npm ci');
});
`,
    );
}

// App tests read app files from their own location, not from the working directory.
sub(
    `${APP}/scripts/sw-kill.test.mjs`,
    "import { readFileSync } from 'node:fs';\n",
    "import { readFileSync } from 'node:fs';\nimport { resolve } from 'node:path';\n",
);
sub(
    `${APP}/scripts/sw-kill.test.mjs`,
    "readFileSync('public/sw-kill.js', 'utf8')",
    "readFileSync(resolve(import.meta.dirname, '../public/sw-kill.js'), 'utf8')",
);
sub(
    `${APP}/scripts/sw-registration-sites.test.mjs`,
    "const SOURCE_ROOT = 'src';\n",
    "const APP_ROOT = path.resolve(import.meta.dirname, '..');\nconst SOURCE_ROOT = 'src';\n",
);
sub(
    `${APP}/scripts/sw-registration-sites.test.mjs`,
    'readdirSync(directory, { withFileTypes: true })',
    'readdirSync(path.join(APP_ROOT, directory), { withFileTypes: true })',
);
sub(
    `${APP}/scripts/sw-registration-sites.test.mjs`,
    "[file, readFileSync(file, 'utf8')]",
    "[file, readFileSync(path.join(APP_ROOT, file), 'utf8')]",
);
sub(
    `${APP}/scripts/sw-registration-sites.test.mjs`,
    "readFileSync('vite.config.ts', 'utf8')",
    "readFileSync(path.join(APP_ROOT, 'vite.config.ts'), 'utf8')",
);
sub(
    `${APP}/scripts/api/wire-fields.test.mjs`,
    "import { join } from 'node:path';\n",
    "import { join, resolve } from 'node:path';\n",
);
sub(
    `${APP}/scripts/api/wire-fields.test.mjs`,
    'const scaled = ',
    "const APP_ROOT = resolve(import.meta.dirname, '../..');\nconst scaled = ",
);
sub(
    `${APP}/scripts/api/wire-fields.test.mjs`,
    /readFileSync\('((?:openapi|src)\/[^']+)'/g,
    "readFileSync(resolve(APP_ROOT, '$1')",
    { all: true },
);
sub(
    `${APP}/scripts/api/wire-fields.test.mjs`,
    "['scripts/api/gen-types.mjs',",
    "[resolve(import.meta.dirname, 'gen-types.mjs'),",
);

// App scripts resolve their files from their own location, not from the working directory.
sub(
    `${APP}/scripts/prerender-before-workbox.mjs`,
    "import { execFile } from 'node:child_process';\n",
    "import { execFile } from 'node:child_process';\nimport { resolve } from 'node:path';\n",
);
sub(
    `${APP}/scripts/prerender-before-workbox.mjs`,
    "execFileAsync(process.execPath, ['scripts/prerender-public.mjs'], {\n        cwd: process.cwd(),",
    "execFileAsync(process.execPath, [resolve(import.meta.dirname, 'prerender-public.mjs')], {\n        cwd: resolve(import.meta.dirname, '..'),",
);
sub(
    `${APP}/scripts/verify-public-precache.mjs`,
    "const outputRoot = path.resolve('dist');",
    "const outputRoot = path.resolve(import.meta.dirname, '../dist');",
);
// vitest is hoisted to the workspace root node_modules.
sub(
    `${APP}/scripts/run-task-tests.mjs`,
    "new URL('../node_modules/vitest/vitest.mjs', import.meta.url)",
    "new URL('../../../node_modules/vitest/vitest.mjs', import.meta.url)",
);

// --- ESLint: one root config, app blocks under apps/app (spec 04 §1.3) ------------------------
sub(
    'eslint.config.js',
    "// App directory relative to the repository root: '.' now, 'apps/app' after the monorepo move.\nconst APP_DIR = '.';",
    "// App directory relative to the repository root (the npm workspace @chipin/app, 04-0a).\nconst APP_DIR = 'apps/app';",
);
// The root tool configs (eslint.config.js, prettier.config.js) keep their default export.
sub(
    'config/eslint/project.js',
    'ignores: DEFAULT_EXPORT_EXCEPTIONS.map(glob => appGlob(appDir, glob)),',
    "ignores: [...DEFAULT_EXPORT_EXCEPTIONS.map(glob => appGlob(appDir, glob)), '*.config.{js,ts,mjs}'],",
);
sub('config/eslint/layers.test.mjs', /'src\//g, "'apps/app/src/", { all: true });
sub('scripts/check-rule-registry.mjs', /^    '(src|ds-gallery)\//gm, "    'apps/app/$1/", { all: true });

// ESLint runs at the root, so suppression keys are root-relative.
{
    const path = 'eslint-suppressions.json';
    const text = read(path);
    const suppressions = JSON.parse(text);
    const moved = Object.fromEntries(
        Object.entries(suppressions).map(([file, rules]) => {
            if (!/^(src|ds-gallery|contract-tests)\//.test(file)) {
                throw new Error(`${path}: unexpected key ${file}`);
            }
            return [`${APP}/${file}`, rules];
        }),
    );
    write(path, JSON.stringify(moved, null, 2) + (text.endsWith('\n') ? '\n' : ''));
}

// check-file-layout lists apps/app/src; the baseline paths stay relative to the app.
sub(
    'scripts/check-file-layout.mjs',
    "export const SOURCE_DIR = 'src';\n",
    "export const SOURCE_DIR = 'src';\n// The app workspace (04-0a). Baseline paths stay relative to it (`src/...`), so `--base` against a\n// commit from before the move compares the same paths.\nexport const APP_DIR = 'apps/app';\n",
);
sub(
    'scripts/check-file-layout.mjs',
    'files: listFiles(repoRoot),',
    'files: listFiles(resolve(repoRoot, APP_DIR)),',
);

// --- release QA paths: the app sources now live under apps/app/ -------------------------------
const APP_FILES = [
    'index.html',
    'app.html',
    'vercel.json',
    'vite.config.ts',
    'vitest.config.ts',
    'pwa-assets.config.ts',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
];
const APP_SCRIPT_FILES = [
    'prerender-before-workbox.mjs',
    'prerender-public.mjs',
    'private-spa-navigation.ts',
    'sw-app-plugin.ts',
    'sentry-sourcemaps.ts',
];
for (const path of [
    'scripts/release-qa/ui-paths.mjs',
    'scripts/release-qa/ui-paths.test.mjs',
    'scripts/release-qa/impact-rules.mjs',
    'scripts/release-qa/core.test.mjs',
    'scripts/release-qa/runtime.test.mjs',
]) {
    let text = read(path);

    text = text.replace(/'(src|public)\//g, `'${APP}/$1/`);
    for (const file of APP_FILES) {
        text = text.replaceAll(`'${file}'`, `'${APP}/${file}'`);
    }
    for (const file of APP_SCRIPT_FILES) {
        text = text.replaceAll(`'scripts/${file}'`, `'${APP}/scripts/${file}'`);
    }
    write(path, text);
}
sub(
    'scripts/release-qa/ui-paths.mjs',
    'const TSCONFIG = /^tsconfig[^/]*\\.json$/;',
    'const TSCONFIG = /^(?:apps\\/app\\/)?tsconfig[^/]*\\.json$/;',
);

// --- formatting and generated-file ignores ------------------------------------------------------
for (const line of [
    'src/shared/api/generated/**',
    'openapi/chipin.yaml',
    'ds-gallery/standalone.html',
    'src/i18n/locales/**',
]) {
    sub('.prettierignore', `\n${line}\n`, `\n${APP}/${line}\n`);
}

// --- workflows: repo-level `node scripts/...` stay; app paths get apps/app/ ---------------------
sub('.github/workflows/openapi-drift.yml', '      - scripts/api/**\n', `      - ${APP}/scripts/api/**\n`);
sub('.github/workflows/openapi-drift.yml', '      - openapi/**\n', `      - ${APP}/openapi/**\n`);
sub('.github/workflows/openapi-drift.yml', 'path: openapi/chipin.yaml', `path: ${APP}/openapi/chipin.yaml`);
sub(
    '.github/workflows/openapi-drift.yml',
    'paths=(openapi src/shared/api/generated src/shared/offline/modelHash.generated.ts)',
    `paths=(${APP}/openapi ${APP}/src/shared/api/generated ${APP}/src/shared/offline/modelHash.generated.ts)`,
);
sub(
    '.github/workflows/frontend-ci.yml',
    'regenerates from the committed openapi/chipin.yaml',
    `regenerates from the committed ${APP}/openapi/chipin.yaml`,
);
NODE

# Prettier on the edited files only (longer paths can rewrap a line; untouched files keep their bytes).
# Needs the base node_modules (`npm ci` before running this script).
npx --no-install prettier --write --log-level warn \
    package.json "$APP/package.json" vitest.config.mjs eslint.config.js \
    "$APP/vite.config.ts" "$APP/vitest.config.ts" "$APP/vercel.config.test.js" \
    "$APP/scripts/prerender-before-workbox.mjs" "$APP/scripts/verify-public-precache.mjs" \
    "$APP/scripts/run-task-tests.mjs" "$APP/scripts/sw-kill.test.mjs" \
    "$APP/scripts/sw-registration-sites.test.mjs" "$APP/scripts/api/wire-fields.test.mjs" \
    "$APP/package.json" config/eslint/project.js config/eslint/layers.test.mjs \
    scripts/check-rule-registry.mjs scripts/check-file-layout.mjs scripts/release-qa/ui-paths.mjs \
    scripts/release-qa/ui-paths.test.mjs scripts/release-qa/impact-rules.mjs \
    scripts/release-qa/core.test.mjs scripts/release-qa/runtime.test.mjs

# Lockfile: the same resolved package set plus the workspace link entries (no upgrades).
npm install --package-lock-only --ignore-scripts --no-audit --no-fund

echo "Moved the app into $APP. Next: npm ci && npm run verify:full"
