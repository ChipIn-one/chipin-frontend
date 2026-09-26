import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expect, test } from 'vitest';

import { checkVersionConsistency } from './version-check.mjs';

const writeManifests = (packageVersion, lockVersion, rootLockVersion = lockVersion) => {
    const directory = mkdtempSync(join(tmpdir(), 'chipin-version-check-'));
    const packagePath = join(directory, 'package.json');
    const lockfilePath = join(directory, 'package-lock.json');

    writeFileSync(packagePath, JSON.stringify({ version: packageVersion }));
    writeFileSync(lockfilePath, JSON.stringify({
        version: rootLockVersion,
        packages: { '': { version: lockVersion } },
    }));

    return { directory, packagePath, lockfilePath };
};

test('accepts matching valid package and lockfile versions', () => {
    const manifests = writeManifests('0.9.0', '0.9.0');

    try {
        expect(checkVersionConsistency(manifests)).toBe('0.9.0');
    } finally {
        rmSync(manifests.directory, { recursive: true, force: true });
    }
});

test('rejects mismatched package and lockfile versions', () => {
    const manifests = writeManifests('0.9.0', '0.8.0');

    try {
        expect(() => checkVersionConsistency(manifests)).toThrow('must match');
    } finally {
        rmSync(manifests.directory, { recursive: true, force: true });
    }
});

test('rejects a mismatched lockfile root version', () => {
    const manifests = writeManifests('0.9.0', '0.9.0', '0.8.0');

    try {
        expect(() => checkVersionConsistency(manifests)).toThrow('must match');
    } finally {
        rmSync(manifests.directory, { recursive: true, force: true });
    }
});
