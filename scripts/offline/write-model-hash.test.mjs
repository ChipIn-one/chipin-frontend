import { describe, expect, test } from 'vitest';

import { modelShapeHash } from './write-model-hash.mjs';

const path = 'src/entities/group/model/types.ts';
const base = 'export interface Group {\n    id: string;\n    name: string;\n}\n';
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
        expect(hashOf(base.replace('}', '    currency: string;\n}'))).not.toBe(hashOf(base));
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
