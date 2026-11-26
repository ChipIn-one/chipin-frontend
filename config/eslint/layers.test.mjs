// Guard for the layer rules (spec 02 §D5, 02-C9): lints import snippets as if they were real files
// under src/ and expects the boundary errors. A plugin or resolver upgrade that silently stops
// resolving the aliases (boundaries then checks nothing) turns this test red.
import { resolve } from 'node:path';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, test } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');

// The rules this guard is about; every other rule (unused vars, sorting) is ignored.
const LAYER_RULES = new Set(['boundaries/dependencies', 'boundaries/no-unknown-files']);

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
            'apps/app/src/basics/AmountInput.tsx',
            "import { useAuthStore } from 'store/authStore';\nexport const x = useAuthStore;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('helpers cannot import api', async () => {
        const errors = await layerErrors(
            'apps/app/src/helpers/clipboard.ts',
            "import { encodePathSegment } from 'api/apiPath';\nexport const x = encodePathSegment;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('shared-api cannot import api', async () => {
        const errors = await layerErrors(
            'apps/app/src/shared/api/errors.ts',
            "import { probeBackendHealth } from 'api/healthApi';\nexport const x = probeBackendHealth;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('shared-api cannot re-export api', async () => {
        const errors = await layerErrors(
            'apps/app/src/shared/offline/network.ts',
            "export { probeBackendHealth } from 'api/healthApi';\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('api may import shared-api (its re-exports for legacy callers)', async () => {
        const errors = await layerErrors(
            'apps/app/src/api/healthApi.ts',
            "import { probeBackendHealth } from 'shared/api/health';\nexport const x = probeBackendHealth;\n",
        );

        expect(errors).toEqual([]);
    });

    test('a features slice cannot import the internals of another slice', async () => {
        const errors = await layerErrors(
            'apps/app/src/features/landing/hero-section/HeroSection.tsx',
            "import { getDailyExpenseSummary } from 'features/activity/internal/selectors';\n" +
                'export const x = getDailyExpenseSummary;\n',
        );

        // D27: `boundaries` is the only slice-entry check (import-x/no-internal-modules is removed).
        expect(errors).toEqual(['boundaries/dependencies']);
    });

    test('a file inside a slice may import its own nested files directly (D27)', async () => {
        const errors = await layerErrors(
            'apps/app/src/features/activity/ActivityList.tsx',
            "import { ActivityEvent } from './components/activity-event/ActivityEvent';\n" +
                'export const x = ActivityEvent;\n',
        );

        expect(errors).toEqual([]);
    });

    test('a features slice may import another slice through its index', async () => {
        const errors = await layerErrors(
            'apps/app/src/features/landing/hero-section/HeroSection.tsx',
            "import { ActivityList } from 'features/activity';\nexport const x = ActivityList;\n",
        );

        expect(errors).toEqual([]);
    });

    test('a flat page file may import its own CSS Module', async () => {
        const errors = await layerErrors(
            'apps/app/src/pages/DashboardPage.tsx',
            "import styles from './DashboardPage.module.css';\nexport const x = styles;\n",
        );

        expect(errors).toEqual([]);
    });

    test('a flat page file cannot import another flat page file', async () => {
        const errors = await layerErrors(
            'apps/app/src/pages/DashboardPage.tsx',
            "import HomePage from './HomePage';\nexport const x = HomePage;\n",
        );

        expect(errors).toEqual(['boundaries/dependencies']);
    });

    test('a folder page cannot import a flat page file', async () => {
        const errors = await layerErrors(
            'apps/app/src/pages/group-page/GroupPage.tsx',
            "import { DashboardPage } from '../DashboardPage';\nexport const x = DashboardPage;\n",
        );

        expect(errors).toEqual(['boundaries/dependencies']);
    });

    test('a folder page cannot import another folder page', async () => {
        const errors = await layerErrors(
            'apps/app/src/pages/group-page/GroupPage.tsx',
            "import SoloPage from '../solo-page/SoloPage';\nexport const x = SoloPage;\n",
        );

        expect(errors).toEqual(['boundaries/dependencies']);
    });

    test('a flat page file cannot import its own test file', async () => {
        const errors = await layerErrors(
            'apps/app/src/pages/DashboardPage.tsx',
            "import * as spec from './DashboardPage.test';\nexport const x = spec;\n",
        );

        expect(errors).toEqual(['boundaries/dependencies']);
    });

    test('a flat page test may import its page', async () => {
        const errors = await layerErrors(
            'apps/app/src/pages/DashboardPage.test.tsx',
            "import { DashboardPage } from './DashboardPage';\nexport const x = DashboardPage;\n",
        );

        expect(errors).toEqual([]);
    });

    test('production code cannot import test support', async () => {
        const errors = await layerErrors(
            'apps/app/src/basics/AmountInput.tsx',
            "import { getOrThrow } from 'test/getOrThrow';\nexport const x = getOrThrow;\n",
        );

        expect(errors).toContain('boundaries/dependencies');
    });

    test('a test file may import test support', async () => {
        const errors = await layerErrors(
            'apps/app/src/basics/AmountInput.test.tsx',
            "import { getOrThrow } from 'test/getOrThrow';\nexport const x = getOrThrow;\n",
        );

        expect(errors).toEqual([]);
    });

    test('a file outside every element is reported', async () => {
        const errors = await layerErrors(
            'apps/app/src/unclassified/thing.ts',
            'export const x = 1;\n',
        );

        expect(errors).toContain('boundaries/no-unknown-files');
    });
});

/** Whether `money-legacy-bridge` reports `code` linted as the file `file`. */
const legacyBridgeErrors = async (file, code) => {
    const [result] = await eslint.lintText(code, { filePath: resolve(repoRoot, file) });

    return result.messages.filter(
        message =>
            message.ruleId === 'no-restricted-imports' &&
            message.message.includes('[money-legacy-bridge]'),
    ).length;
};

describe('money-legacy-bridge (spec 03 §4.1 item 5)', () => {
    test.each([
        ['another entity, alias', 'apps/app/src/entities/ledger/model/x.ts', "'entities/balance'"],
        ['another entity, relative slice', 'apps/app/src/entities/ledger/index.ts', "'../balance'"],
        [
            'another entity, relative index',
            'apps/app/src/entities/ledger/model/x.ts',
            "'../../balance/index'",
        ],
        [
            'shared, relative deep path',
            'apps/app/src/shared/lib/x.ts',
            "'../../entities/balance/model/legacy'",
        ],
        ['app, alias deep path', 'apps/app/src/app/x.ts', "'entities/balance/model/legacy'"],
    ])('reports a legacy* import: %s', async (_name, file, source) => {
        const code = `import { legacyAmountFromMoney } from ${source};\nexport const x = legacyAmountFromMoney;\n`;

        expect(await legacyBridgeErrors(file, code)).toBe(1);
    });

    test('reports a namespace import that could reach legacy* names', async () => {
        const code = "import * as balance from '../balance';\nexport const x = balance;\n";

        expect(await legacyBridgeErrors('apps/app/src/entities/ledger/index.ts', code)).toBe(1);
    });

    test.each([
        [
            'a non-legacy name from another entity',
            'apps/app/src/entities/ledger/index.ts',
            "import { balanceDirection } from '../balance';\nexport const x = balanceDirection;\n",
        ],
        [
            'the balance entity itself',
            'apps/app/src/entities/balance/model/x.ts',
            "import { legacyAmountFromMoney } from './legacy';\nexport const x = legacyAmountFromMoney;\n",
        ],
        [
            'a legacy store',
            'apps/app/src/store/x.ts',
            "import { legacyAmountFromMoney } from 'entities/balance';\nexport const x = legacyAmountFromMoney;\n",
        ],
    ])('allows %s', async (_name, file, code) => {
        expect(await legacyBridgeErrors(file, code)).toBe(0);
    });
});
