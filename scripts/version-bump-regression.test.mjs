import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expect, test } from 'vitest';

import { bumpVersion, runVersionBump, updateManifestVersions } from './version-bump.mjs';

const makeLock = (indent = 4, newline = '\n', entries = 3) => {
    const packages = { '': { name: 'chipin-frontend', version: '1.0.7', dependencies: { axios: '^1.20.0' } } };
    for (let index = 0; index < entries; index += 1) {
        packages['node_modules/dep-' + index] = {
            version: index + '.0.7',
            resolved: 'https://example.invalid/dep-' + index,
        };
    }
    return (JSON.stringify({
        name: 'chipin-frontend', version: '1.0.7', lockfileVersion: 3, requires: true, packages,
    }, null, indent) + '\n').replaceAll('\n', newline);
};
const makePackage = (newline = '\n') => (JSON.stringify({
    name: 'chipin-frontend', version: '1.0.7',
    scripts: { check: 'echo keep-formatting' }, metadata: { version: 'nested-version' },
}, null, 4) + '\n').replaceAll('\n', newline);

const withManifests = (packageSource, lockSource, exercise) => {
    const directory = mkdtempSync(join(tmpdir(), 'chipin-lock-regression-'));
    const packagePath = join(directory, 'package.json');
    const lockfilePath = join(directory, 'package-lock.json');
    writeFileSync(packagePath, packageSource);
    writeFileSync(lockfilePath, lockSource);
    const options = { packagePath, lockfilePath };
    const read = () => [readFileSync(packagePath, 'utf8'), readFileSync(lockfilePath, 'utf8')];
    try { exercise(options, read); }
    finally { rmSync(directory, { recursive: true, force: true }); }
};

test('four-space lockfile matching #431 cannot reformat 887 package entries', () => {
    const before = makeLock(4, '\n', 887);
    withManifests(makePackage(), before, (options, read) => {
        expect(runVersionBump('patch', options)).toBe('1.0.8');
        const [packageSource, lockSource] = read();
        const expected = before.replace('"version": "1.0.7"', '"version": "1.0.8"')
            .replace('"version": "1.0.7"', '"version": "1.0.8"');
        expect(lockSource).toBe(expected);
        expect(JSON.parse(lockSource).packages['node_modules/dep-1'].version).toBe('1.0.7');
        expect(lockSource.split('\n').filter((line, index) => line !== before.split('\n')[index])).toHaveLength(2);
        expect(packageSource).toBe(makePackage().replace('"version": "1.0.7"', '"version": "1.0.8"'));
    });
});

test('two-space lockfile preserves CRLF, unrelated whitespace and dependency entries', () => {
    const before = makeLock(2, '\r\n').replace('  "requires": true,', '  "requires" :  true ,');
    withManifests(makePackage('\r\n'), before, (options, read) => {
        runVersionBump('patch', options);
        expect(read()[1]).toBe(before.replace('"version": "1.0.7"', '"version": "1.0.8"')
            .replace('"version": "1.0.7"', '"version": "1.0.8"'));
        expect(read()[0]).toBe(makePackage('\r\n').replace('"version": "1.0.7"', '"version": "1.0.8"'));
    });
});

test('root ordering and nested versions anywhere else remain byte-for-byte unchanged', () => {
    const before = ' {\r\n\t"packages": {"node_modules/d": {"version":"1.0.7"}, ' +
        '"": {"optional": {"version": "1.0.7"}, "version"  :  "1.0.7" }},\r\n' +
        '\t"version" : "1.0.7", "meta": {"version":"1.0.7"} }\r\n';
    withManifests(makePackage(), before, (options, read) => {
        updateManifestVersions('1.0.8', options);
        expect(read()[1]).toBe(before.replace('"version"  :  "1.0.7"', '"version"  :  "1.0.8"')
            .replace('"version" : "1.0.7"', '"version" : "1.0.8"'));
    });
});

test('none is a no-op and consecutive bumps preserve synchronization', () => {
    withManifests(makePackage(), makeLock(), (options, read) => {
        const before = read();
        expect(runVersionBump('none', options)).toBe('1.0.7');
        expect(read()).toEqual(before);
        expect(runVersionBump('patch', options)).toBe('1.0.8');
        expect(runVersionBump('minor', options)).toBe('1.1.0');
        expect(JSON.parse(read()[0]).version).toBe('1.1.0');
        expect(JSON.parse(read()[1]).packages[''].version).toBe('1.1.0');
    });
});

test('missing, invalid, duplicate or malformed lockfile fields fail without partial writes', () => {
    const invalid = [
        '{}',
        '{"version":"1.0.7","packages":{}}',
        '{"version":null,"packages":{"":{"version":"1.0.7"}}}',
        '{"version":"1.0.7","packages":{"":{"version":null}}}',
        '{"version":"1.0.7","packages":{"":{"version":"1.0.7"}}',
        '{"version":"1.0.7","version":"1.0.7","packages":{"":{"version":"1.0.7"}}}',
    ];
    for (const lockSource of invalid) {
        withManifests(makePackage(), lockSource, (options, read) => {
            const before = read();
            expect(() => updateManifestVersions('1.0.8', options)).toThrow();
            expect(read()).toEqual(before);
        });
    }
});

test('package.json root version is validated and remains formatting-safe', () => {
    for (const packageSource of ['{}', '{"version":null}', '{"version":"1.0.7","version":"1.0.7"}']) {
        withManifests(packageSource, makeLock(), (options, read) => {
            const before = read();
            expect(() => updateManifestVersions('1.0.8', options)).toThrow();
            expect(read()).toEqual(before);
        });
    }
});

test('existing SemVer safeguards still reject unauthorized changes', () => {
    expect(() => bumpVersion('0.9.9', 'major')).toThrow('explicit release decision');
    expect(() => runVersionBump('hotfix')).toThrow('Unsupported version impact');
});
