import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildAffectingFiles, isBuildToolchainPackage, isUiAffecting, packageBuildChanges, uiAffectingFiles } from './ui-paths.mjs';

test('application code, static assets, entry HTML, locales, Vercel, PWA and Vite config are UI-affecting', () => {
    for (const path of [
        'src/App.tsx', 'src/i18n/locales/en/common.json', 'src/helpers/serviceWorkerRecovery.ts',
        'public/favicon.svg', 'index.html', 'app.html', 'vercel.json', 'vite.config.ts', 'pwa-assets.config.ts',
        'scripts/prerender-before-workbox.mjs', 'scripts/private-spa-navigation.ts',
    ]) expect(isUiAffecting(path), path).toBe(true);
});

test('tests, test setup, CI, workflows, tooling, packages and docs are not UI-affecting', () => {
    for (const path of [
        'src/App.test.tsx', 'src/helpers/theme.test.ts', 'src/test/setup.ts', '.github/workflows/frontend-ci.yml',
        '.github/dependabot.yml', 'scripts/release-qa/core.mjs', 'package.json', 'package-lock.json',
        'docs/engineering/release-qa.md', 'README.md', 'AGENTS.md', 'vitest.config.ts', 'eslint.config.js',
    ]) expect(isUiAffecting(path), path).toBe(false);
});

test('uiAffectingFiles keeps only UI-affecting paths in order', () => {
    expect(uiAffectingFiles(['docs/a.md', 'src/App.tsx', 'src/App.test.tsx', 'vercel.json'])).toEqual(['src/App.tsx', 'vercel.json']);
});

describe('build-affecting changes', () => {
    const pkg = (dependencies, devDependencies = {}, version = '1.0.8') => ({ name: 'chipin-frontend', version, dependencies, devDependencies });
    const lock = (packages, version = '1.0.8') => ({ lockfileVersion: 3, version, packages: { '': { version }, ...packages } });
    const basePkg = pkg({ i18next: '^26.4.2' }, { eslint: '^9.0.0', vite: '^7.1.0' });
    const baseLock = lock({
        'node_modules/i18next': { version: '26.4.2' },
        'node_modules/eslint': { version: '9.0.0', dev: true },
        'node_modules/vite': { version: '7.1.0', dev: true },
        'node_modules/workbox-build': { version: '7.3.0', dev: true },
        'node_modules/@babel/runtime': { version: '7.28.0' },
    });

    test('tsconfig files and the version resolver are build-affecting by path', () => {
        expect(buildAffectingFiles(['tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json', 'scripts/version-resolver.mjs', 'docs/a.md', 'scripts/version-check.mjs']))
            .toEqual(['tsconfig.app.json', 'tsconfig.json', 'tsconfig.node.json', 'scripts/version-resolver.mjs']);
    });

    test('a dependencies bump in package.json and its lock is build-affecting', () => {
        const head = { pkg: pkg({ i18next: '^26.5.0' }, basePkg.devDependencies), lock: lock({ ...baseLock.packages, 'node_modules/i18next': { version: '26.5.0' } }) };
        expect(packageBuildChanges({ files: ['package.json', 'package-lock.json'], base: { pkg: basePkg, lock: baseLock }, head }))
            .toEqual(['package.json dependencies: i18next', 'package-lock.json: i18next']);
    });

    test('a build toolchain devDependency (vite, vite-plugin-pwa, workbox-*, @vitejs/*) is build-affecting', () => {
        const head = { pkg: pkg(basePkg.dependencies, { ...basePkg.devDependencies, vite: '^7.2.0', '@vitejs/plugin-react-swc': '^4.0.0' }), lock: baseLock };
        expect(packageBuildChanges({ files: ['package.json'], base: { pkg: basePkg, lock: baseLock }, head }))
            .toEqual(['package.json devDependencies: vite', 'package.json devDependencies: @vitejs/plugin-react-swc']);
        const workbox = { pkg: basePkg, lock: lock({ ...baseLock.packages, 'node_modules/workbox-build': { version: '7.4.0', dev: true } }) };
        expect(packageBuildChanges({ files: ['package-lock.json'], base: { pkg: basePkg, lock: baseLock }, head: workbox })).toEqual(['package-lock.json: workbox-build']);
    });

    test('a lint/test devDependency bump and our own version bump are not build-affecting', () => {
        const lint = { pkg: pkg(basePkg.dependencies, { ...basePkg.devDependencies, eslint: '^9.1.0' }),
            lock: lock({ ...baseLock.packages, 'node_modules/eslint': { version: '9.1.0', dev: true } }) };
        expect(packageBuildChanges({ files: ['package.json', 'package-lock.json'], base: { pkg: basePkg, lock: baseLock }, head: lint })).toEqual([]);
        const bump = { pkg: pkg(basePkg.dependencies, basePkg.devDependencies, '1.0.9'), lock: lock(baseLock.packages, '1.0.9') };
        expect(packageBuildChanges({ files: ['package.json', 'package-lock.json'], base: { pkg: basePkg, lock: baseLock }, head: bump })).toEqual([]);
    });

    test('devOptional packages (optional peers such as typescript or @types/react) are not runtime', () => {
        const before = lock({ ...baseLock.packages, 'node_modules/typescript': { version: '5.9.0', devOptional: true }, 'node_modules/@types/react': { version: '19.3.0', devOptional: true } });
        const after = lock({ ...baseLock.packages, 'node_modules/typescript': { version: '5.9.3', devOptional: true }, 'node_modules/@types/react': { version: '19.3.1', devOptional: true } });
        expect(packageBuildChanges({ files: ['package-lock.json'], base: { pkg: basePkg, lock: before }, head: { pkg: basePkg, lock: after } })).toEqual([]);
    });

    test('a lock-only change of a runtime (non-dev) transitive package is build-affecting', () => {
        const head = { pkg: basePkg, lock: lock({ ...baseLock.packages, 'node_modules/@babel/runtime': { version: '7.28.4' } }) };
        expect(packageBuildChanges({ files: ['package-lock.json'], base: { pkg: basePkg, lock: baseLock }, head })).toEqual(['package-lock.json: @babel/runtime']);
    });

    test('package files outside the compare are not inspected', () => {
        const head = { pkg: pkg({ i18next: '^27.0.0' }), lock: baseLock };
        expect(packageBuildChanges({ files: ['src/App.tsx'], base: { pkg: basePkg, lock: baseLock }, head })).toEqual([]);
    });

    test('every package imported by vite.config.ts and pwa-assets.config.ts is part of the build toolchain', () => {
        const imported = new Set();
        for (const file of ['vite.config.ts', 'pwa-assets.config.ts']) {
            for (const match of readFileSync(file, 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
                const specifier = match[1];
                if (specifier.startsWith('.') || specifier.startsWith('node:')) continue;
                const parts = specifier.split('/');
                imported.add(specifier.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
            }
        }
        expect([...imported]).toEqual(expect.arrayContaining(['vite', 'vite-plugin-pwa', 'vite-plugin-svgr', 'vite-tsconfig-paths',
            '@sentry/vite-plugin', '@vitejs/plugin-react-swc', '@vite-pwa/assets-generator']));
        for (const name of imported) expect(isBuildToolchainPackage(name), name).toBe(true);
        expect(isBuildToolchainPackage('eslint')).toBe(false);
        expect(isBuildToolchainPackage('vitest')).toBe(false);
    });

    test('a Dependabot bump of a Vite plugin is build-affecting', () => {
        const base = { pkg: pkg(basePkg.dependencies, { ...basePkg.devDependencies, 'vite-plugin-svgr': '^4.5.0' }),
            lock: lock({ ...baseLock.packages, 'node_modules/vite-plugin-svgr': { version: '4.5.0', dev: true } }) };
        const head = { pkg: pkg(basePkg.dependencies, { ...basePkg.devDependencies, 'vite-plugin-svgr': '^4.6.0' }),
            lock: lock({ ...baseLock.packages, 'node_modules/vite-plugin-svgr': { version: '4.6.0', dev: true } }) };
        expect(packageBuildChanges({ files: ['package.json', 'package-lock.json'], base, head }))
            .toEqual(['package.json devDependencies: vite-plugin-svgr', 'package-lock.json: vite-plugin-svgr']);
    });

    describe('dev packages reachable from a toolchain root', () => {
        const toolchainLock = (overrides = {}) => lock({
            'node_modules/vite': { version: '8.3.2', dev: true, dependencies: { rolldown: '1.2.12', postcss: '^8' },
                optionalDependencies: { lightningcss: '^1' }, peerDependencies: { '@types/node': '*', sass: '*', 'vite-dep-peer': '*' },
                peerDependenciesMeta: { '@types/node': { optional: true }, sass: { optional: true } } },
            'node_modules/rolldown': { version: '1.2.12', dev: true, dependencies: { '@oxc-project/types': '1' } },
            'node_modules/@oxc-project/types': { version: '1.0.0', dev: true },
            'node_modules/postcss': { version: '8.5.0', dev: true },
            'node_modules/lightningcss': { version: '1.30.0', dev: true },
            'node_modules/vite-dep-peer': { version: '1.0.0', dev: true },
            'node_modules/sass': { version: '1.90.0', dev: true },
            'node_modules/@types/node': { version: '24.0.0', dev: true },
            'node_modules/vite-plugin-svgr': { version: '4.5.0', dev: true, dependencies: { '@svgr/core': '^8' } },
            'node_modules/vite-plugin-svgr/node_modules/@svgr/core': { version: '8.1.0', dev: true },
            'node_modules/@svgr/core': { version: '7.0.0', dev: true },
            'node_modules/eslint': { version: '9.0.0', dev: true, dependencies: { espree: '^10' } },
            'node_modules/espree': { version: '10.0.0', dev: true },
            ...overrides,
        });
        const changes = overrides => packageBuildChanges({ files: ['package-lock.json'],
            base: { pkg: basePkg, lock: toolchainLock() }, head: { pkg: basePkg, lock: toolchainLock(overrides) } });

        test('a lock-only bump of a transitive build package (dependencies, optional, required peers, nested) counts', () => {
            expect(changes({ 'node_modules/rolldown': { version: '1.2.13', dev: true, dependencies: { '@oxc-project/types': '1' } } })).toEqual(['package-lock.json: rolldown']);
            expect(changes({ 'node_modules/@oxc-project/types': { version: '1.0.1', dev: true } })).toEqual(['package-lock.json: @oxc-project/types']);
            expect(changes({ 'node_modules/lightningcss': { version: '1.30.1', dev: true } })).toEqual(['package-lock.json: lightningcss']);
            expect(changes({ 'node_modules/vite-dep-peer': { version: '1.0.1', dev: true } })).toEqual(['package-lock.json: vite-dep-peer']);
            expect(changes({ 'node_modules/vite-plugin-svgr/node_modules/@svgr/core': { version: '8.1.1', dev: true } })).toEqual(['package-lock.json: @svgr/core']);
        });

        test('lint, test, types and optional-peer-only bumps stay outside the build', () => {
            expect(changes({ 'node_modules/espree': { version: '10.1.0', dev: true } })).toEqual([]);
            expect(changes({ 'node_modules/@types/node': { version: '24.1.0', dev: true } })).toEqual([]);
            expect(changes({ 'node_modules/sass': { version: '1.91.0', dev: true } })).toEqual([]);
            // The hoisted @svgr/core is shadowed by the nested copy vite-plugin-svgr resolves first.
            expect(changes({ 'node_modules/@svgr/core': { version: '7.0.1', dev: true } })).toEqual([]);
        });
    });
});

