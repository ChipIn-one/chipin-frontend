// Guard for the layer rules (spec 02 §D5, 02-C9): lints import snippets as if they were real files
// under src/ and expects the boundary errors. A plugin or resolver upgrade that silently stops
// resolving the aliases (boundaries then checks nothing) turns this test red.
import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');

// The rules this guard is about; every other rule (unused vars, sorting) is ignored.
const LAYER_RULES = new Set([
    'boundaries/dependencies',
    'boundaries/no-unknown-files',
    'import-x/no-internal-modules',
]);

let eslint;

beforeAll(() => {
    // FAST mode (as in pre-commit): no TS program, so the files do not need to type-check.
    process.env.CHIPIN_ESLINT_FAST = '1';
    eslint = new ESLint({ cwd: repoRoot });
});

/** Layer-rule ids reported for `code` linted as the file `file` (relative to the repo root). */
const layerErrors = async (file, code) => {
    const [result] = await eslint.lintText(code, { filePath: resolve(repoRoot, file) });

    return result.messages
        .filter(message => message.severity === 2 && LAYER_RULES.has(message.ruleId))
        .map(message => message.ruleId);
};

describe('layer boundaries (config/eslint/layers.js)', () => {
    test('basics cannot import store', async () => {
        const errors = await layerErrors(
            'src/basics/AmountInput.tsx',
            "import { useAuthStore } from 'store/authStore';\nexport const x = useAuthStore;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('helpers cannot import api', async () => {
        const errors = await layerErrors(
            'src/helpers/clipboard.ts',
            "import { encodePathSegment } from 'api/apiPath';\nexport const x = encodePathSegment;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('a features slice cannot import the internals of another slice', async () => {
        const errors = await layerErrors(
            'src/features/landing/hero-section/HeroSection.tsx',
            "import { getDailyExpenseSummary } from 'features/activity/internal/selectors';\n" +
                'export const x = getDailyExpenseSummary;\n',
        );

        expect(errors).toContain('boundaries/dependencies');
        expect(errors).toContain('import-x/no-internal-modules');
    });

    test('a features slice may import another slice through its index', async () => {
        const errors = await layerErrors(
            'src/features/landing/hero-section/HeroSection.tsx',
            "import { ActivityList } from 'features/activity';\nexport const x = ActivityList;\n",
        );

        expect(errors).toEqual([]);
    });

    test('production code cannot import test support', async () => {
        const errors = await layerErrors(
            'src/basics/AmountInput.tsx',
            "import { getOrThrow } from 'test/getOrThrow';\nexport const x = getOrThrow;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('a test file may import test support', async () => {
        const errors = await layerErrors(
            'src/basics/AmountInput.test.tsx',
            "import { getOrThrow } from 'test/getOrThrow';\nexport const x = getOrThrow;\n",
        );

        expect(errors).toEqual([]);
    });

    test('a file outside every element is reported', async () => {
        const errors = await layerErrors('src/unclassified/thing.ts', 'export const x = 1;\n');

        expect(errors).toContain('boundaries/no-unknown-files');
    });
});
