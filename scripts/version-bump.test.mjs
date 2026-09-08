import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expect, test } from 'vitest';

import {
    bumpVersion,
    isVersionImpact,
    parseSemVer,
    updateManifestVersions,
} from './version-bump.mjs';

test('bumps a patch version', () => {
    expect(bumpVersion('0.9.0', 'patch')).toBe('0.9.1');
});

test('bumps a minor version and resets patch', () => {
    expect(bumpVersion('0.9.1', 'minor')).toBe('0.10.0');
});

test('leaves the version unchanged for none impact', () => {
    expect(bumpVersion('0.9.0', 'none')).toBe('0.9.0');
});

test('rejects an automatic major bump during the pre-1.0 period', () => {
    expect(() => bumpVersion('0.9.9', 'major'))
        .toThrow('1.0.0 requires an explicit release decision');
});

test('bumps a normal major version', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
});

test('rejects invalid impacts and versions', () => {
    expect(isVersionImpact('hotfix')).toBe(false);
    expect(() => bumpVersion('0.9.0', 'hotfix')).toThrow('Unsupported version impact');
    expect(() => parseSemVer('0.9')).toThrow('Invalid SemVer');
});

test('updates package and lockfile versions together', () => {
    const directory = mkdtempSync(join(tmpdir(), 'chipin-version-bump-'));
    const packagePath = join(directory, 'package.json');
    const lockfilePath = join(directory, 'package-lock.json');

    writeFileSync(packagePath, JSON.stringify({ name: 'chipin-frontend', version: '0.9.0' }));
    writeFileSync(lockfilePath, JSON.stringify({
        name: 'chipin-frontend',
        version: '0.9.0',
        packages: { '': { name: 'chipin-frontend', version: '0.9.0' } },
    }));

    try {
        updateManifestVersions('0.9.1', { packagePath, lockfilePath });

        expect(JSON.parse(readFileSync(packagePath, 'utf8')).version).toBe('0.9.1');
        const updatedLockfile = JSON.parse(readFileSync(lockfilePath, 'utf8'));
        expect(updatedLockfile.version).toBe('0.9.1');
        expect(updatedLockfile.packages[''].version).toBe('0.9.1');
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
