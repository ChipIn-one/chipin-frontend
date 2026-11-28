// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { readScreenManifest } from './captureFiles';
import { autoRows, computeRecipeCoverage, recipeCoverageProblems } from './captureModel';
import { RECIPES } from './recipes';
import { SCENARIOS } from './scenarios';

// The real manifest against the real registry (#998): a row added to
// docs/design-system/screens.manifest.json without a recipe fails here, in CI's unit tests, before
// the capture workflow fails on it by name.
const manifest = readScreenManifest();

describe('capture recipes', () => {
    it('cover every non-manual manifest row and nothing else', () => {
        expect(
            recipeCoverageProblems(computeRecipeCoverage(manifest, Object.keys(RECIPES))),
        ).toEqual([]);
    });

    it('can provision the scenario of every non-manual row', () => {
        const unprovisioned = autoRows(manifest)
            .map(row => row.setup.scenario)
            .filter(
                (scenario): scenario is string =>
                    scenario !== undefined && SCENARIOS[scenario] === undefined,
            );

        expect(unprovisioned).toEqual([]);
    });

    it('provision only scenarios the manifest names', () => {
        const known = new Set(manifest.scenarios.map(scenario => scenario.id));

        expect(Object.keys(SCENARIOS).filter(id => !known.has(id))).toEqual([]);
    });
});
