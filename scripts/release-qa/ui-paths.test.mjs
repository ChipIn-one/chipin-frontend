import { describe, expect, test } from 'vitest';
import { buildAffectingFiles, isUiAffecting, packageBuildChanges, uiAffectingFiles } from './ui-paths.mjs';

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

    test('a lock-only change of a runtime (non-dev) transitive package is build-affecting', () => {
        const head = { pkg: basePkg, lock: lock({ ...baseLock.packages, 'node_modules/@babel/runtime': { version: '7.28.4' } }) };
        expect(packageBuildChanges({ files: ['package-lock.json'], base: { pkg: basePkg, lock: baseLock }, head })).toEqual(['package-lock.json: @babel/runtime']);
    });

    test('package files outside the compare are not inspected', () => {
        const head = { pkg: pkg({ i18next: '^27.0.0' }), lock: baseLock };
        expect(packageBuildChanges({ files: ['src/App.tsx'], base: { pkg: basePkg, lock: baseLock }, head })).toEqual([]);
    });
});
