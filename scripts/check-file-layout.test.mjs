import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { checkFileLayout, findViolations, listFiles, parseBase } from './check-file-layout.mjs';

const FILES = [
    'src/features/activity/index.ts',
    'src/features/activity/ActivityList.tsx',
    'src/components/group-card/index.ts',
    'src/shared/money/index.ts',
    'src/basics/index.ts',
    'src/components/modals/settle-up-modal/index.ts',
    'src/components/header/internal/useConnect.ts',
    'src/components/header/Header.tsx',
];
const BASELINE = {
    'index-depth': ['src/basics/index.ts', 'src/components/modals/settle-up-modal/index.ts'],
    'use-connect': ['src/components/header/internal/useConnect.ts'],
};

describe('findViolations', () => {
    test('allows an index.ts only at a slice root and no useConnect files', () => {
        expect(findViolations(FILES)).toEqual(BASELINE);
    });
});

describe('checkFileLayout', () => {
    test('passes when every violation is in the baseline', () => {
        expect(checkFileLayout({ files: FILES, baseline: BASELINE })).toEqual([]);
    });

    test('fails on a new nested index.ts', () => {
        const errors = checkFileLayout({
            files: [...FILES, 'src/features/activity/components/activity-event/index.ts'],
            baseline: BASELINE,
        });

        expect(errors).toEqual([
            expect.stringMatching(
                /^src\/features\/activity\/components\/activity-event\/index\.ts: .*\[index-depth\]$/,
            ),
        ]);
    });

    test('fails on a new layer-root index.ts', () => {
        expect(
            checkFileLayout({ files: [...FILES, 'src/helpers/index.ts'], baseline: BASELINE }),
        ).toEqual([expect.stringMatching(/^src\/helpers\/index\.ts: .*\[index-depth\]$/)]);
    });

    test('fails on a new useConnect.ts and useConnect.tsx', () => {
        const errors = checkFileLayout({
            files: [
                ...FILES,
                'src/pages/group-page/internal/useConnect.ts',
                'src/components/x/useConnect.tsx',
            ],
            baseline: BASELINE,
        });

        expect(errors).toHaveLength(2);
        expect(errors.every(error => error.endsWith('[use-connect]'))).toBe(true);
    });

    test('fails on a baseline entry that no longer breaks the check (the baseline only shrinks)', () => {
        const errors = checkFileLayout({
            files: FILES.filter(path => !path.endsWith('useConnect.ts')),
            baseline: BASELINE,
        });

        expect(errors).toEqual([
            expect.stringMatching(/use-connect lists .*useConnect\.ts.*remove/),
        ]);
    });

    test('with a base baseline, fails on a path added to the baseline', () => {
        const files = [...FILES, 'src/pages/a/internal/useConnect.ts'];
        const baseline = {
            ...BASELINE,
            'use-connect': [...BASELINE['use-connect'], 'src/pages/a/internal/useConnect.ts'],
        };

        expect(checkFileLayout({ files, baseline })).toEqual([]);
        expect(checkFileLayout({ files, baseline, baseBaseline: BASELINE })).toEqual([
            expect.stringMatching(/use-connect adds src\/pages\/a\/internal\/useConnect\.ts/),
        ]);
    });

    test('with a base baseline, passes a removed entry', () => {
        const files = FILES.filter(path => !path.endsWith('useConnect.ts'));

        expect(
            checkFileLayout({
                files,
                baseline: { ...BASELINE, 'use-connect': [] },
                baseBaseline: BASELINE,
            }),
        ).toEqual([]);
    });

    test('rejects an unknown check in the baseline', () => {
        expect(checkFileLayout({ files: FILES, baseline: { ...BASELINE, other: [] } })).toEqual([
            expect.stringMatching(/unknown check "other"/),
        ]);
    });
});

describe('listFiles', () => {
    let root;

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('lists repository-relative POSIX paths under src/', () => {
        root = mkdtempSync(join(tmpdir(), 'file-layout-'));
        for (const path of ['src/a/b/index.ts', 'src/c.ts', 'other/index.ts']) {
            mkdirSync(dirname(join(root, path)), { recursive: true });
            writeFileSync(join(root, path), '');
        }

        expect(listFiles(root)).toEqual(['src/a/b/index.ts', 'src/c.ts']);
    });
});

describe('parseBase', () => {
    test.each([
        [[], undefined],
        [['--base', 'abc1234'], 'abc1234'],
        [['--base=abc1234'], 'abc1234'],
        [['--base'], ''],
    ])('%j -> %j', (argv, base) => {
        expect(parseBase(argv)).toBe(base);
    });
});
