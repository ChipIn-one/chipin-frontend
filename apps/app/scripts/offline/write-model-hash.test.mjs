import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { modelShapeHash, modelTypeFiles } from './write-model-hash.mjs';

const path = 'src/entities/group/model/types.ts';
const base = 'export interface Group {\n    id: string;\n    name: string;\n}\n';
const withCurrency =
    'export interface Group {\n    id: string;\n    name: string;\n    currency: string;\n}\n';
const hashOf = text => modelShapeHash([{ path, text }]);

describe('MODEL_SHAPE_HASH', () => {
    test('is 12 hex characters and deterministic', () => {
        expect(hashOf(base)).toMatch(/^[0-9a-f]{12}$/);
        expect(hashOf(base)).toBe(hashOf(base));
    });

    test('a comment or formatting change does not change it', () => {
        const commented =
            '// The group.\nexport interface Group {\n    /** Id. */ id: string;\n\n    name:   string\n}\n';

        expect(hashOf(commented)).toBe(hashOf(base));
    });

    test('a new field changes it', () => {
        expect(hashOf(withCurrency)).not.toBe(hashOf(base));
    });

    test('does not depend on the order of the files', () => {
        const other = {
            path: 'src/entities/user/model/types.ts',
            text: 'export type UserId = string;\n',
        };

        expect(modelShapeHash([{ path, text: base }, other])).toBe(
            modelShapeHash([other, { path, text: base }]),
        );
    });
});

describe('modelTypeFiles', () => {
    let root;
    const file = (relative, text = '') => {
        mkdirSync(dirname(join(root, relative)), { recursive: true });
        writeFileSync(join(root, relative), text);
    };

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('finds every slice types.ts, sorted, and skips slices without model/', () => {
        root = mkdtempSync(join(tmpdir(), 'model-hash-'));
        file('src/entities/user/model/types.ts', 'export type A = 1;\n');
        file('src/entities/group/model/types.ts', base);
        file('src/entities/group/model/other.ts');
        file('src/entities/session/index.ts');

        expect(modelTypeFiles(root)).toEqual([
            { path: 'src/entities/group/model/types.ts', text: base },
            { path: 'src/entities/user/model/types.ts', text: 'export type A = 1;\n' },
        ]);
    });

    test('fails when no types.ts exists at all', () => {
        root = mkdtempSync(join(tmpdir(), 'model-hash-'));
        mkdirSync(join(root, 'src/entities'), { recursive: true });

        expect(() => modelTypeFiles(root)).toThrow(/would hash nothing/);
    });

    test('fails when a model/ folder has no types.ts', () => {
        root = mkdtempSync(join(tmpdir(), 'model-hash-'));
        file('src/entities/group/model/types.ts', base);
        file('src/entities/balance/model/balance.ts');

        expect(() => modelTypeFiles(root)).toThrow(
            /missing: src\/entities\/balance\/model\/types\.ts/,
        );
    });
});
