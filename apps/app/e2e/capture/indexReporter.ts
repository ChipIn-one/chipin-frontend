// Playwright reporter of the screen capture: collects each row test's PNGs (its `screen-capture`
// attachments) and failure, and after the run writes `screen-captures/index.json`
// (captureModel.ts `buildCaptureIndex`, format in docs/design-system/screens.md). It also prints
// the missing rows, which the workflow repeats in the job summary.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type {
    FullConfig,
    FullResult,
    Reporter,
    TestCase,
    TestResult,
} from '@playwright/test/reporter';

import { CAPTURE_INDEX_FILE, CAPTURE_OUTPUT_DIR, readScreenManifest } from './captureFiles';
import {
    buildCaptureIndex,
    CAPTURE_ATTACHMENT,
    type CaptureFile,
    parseCaptureAttachment,
    type RowCaptureResult,
    SCREEN_ID_ANNOTATION,
} from './captureModel';
import { RECIPES } from './recipes';

const FULL_SHA = /^[0-9a-f]{40}$/;

const readEnvironment = (name: string): string => process.env[name]?.trim() ?? '';

class CaptureIndexReporter implements Reporter {
    private readonly results = new Map<string, RowCaptureResult>();
    private playwrightVersion = '';

    onBegin(config: FullConfig): void {
        this.playwrightVersion = config.version;
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const id = test.annotations.find(
            annotation => annotation.type === SCREEN_ID_ANNOTATION,
        )?.description;
        if (!id) {
            return;
        }

        const captures = result.attachments.flatMap((attachment): CaptureFile[] => {
            if (attachment.name !== CAPTURE_ATTACHMENT || !attachment.body) {
                return [];
            }
            const capture = parseCaptureAttachment(attachment.body.toString('utf8'));

            return capture ? [capture] : [];
        });
        const passed = result.status === 'passed';

        this.results.set(id, {
            captures,
            error: passed ? null : (result.error?.message ?? `the test ended as ${result.status}`),
        });
    }

    async onEnd(result: FullResult): Promise<void> {
        const commit = readEnvironment('CHIPIN_CAPTURE_COMMIT');
        const index = buildCaptureIndex({
            manifest: readScreenManifest(),
            results: this.results,
            recipeIds: Object.keys(RECIPES),
            commit: FULL_SHA.test(commit) ? commit : 'unknown',
            ref: readEnvironment('CHIPIN_CAPTURE_REF') || 'unknown',
            runId: readEnvironment('GITHUB_RUN_ID') || 'unknown',
            generatedAt: new Date().toISOString(),
            playwrightVersion: this.playwrightVersion,
        });

        await mkdir(CAPTURE_OUTPUT_DIR, { recursive: true });
        await writeFile(
            path.join(CAPTURE_OUTPUT_DIR, CAPTURE_INDEX_FILE),
            `${JSON.stringify(index, null, 2)}\n`,
            'utf8',
        );

        const taken = [...index.flows.flatMap(flow => flow.screens), ...index.ungrouped];
        const files = new Set(
            taken.flatMap(screen => screen.captures.map(capture => capture.file)),
        );
        process.stdout.write(
            `[capture] run ${result.status}; index.json: ${files.size} PNGs, ${index.manual.length} manual rows, ${index.missing.length} missing variants\n`,
        );
        for (const entry of index.missing) {
            const variant = entry.variant ? ` ${entry.variant.theme} ${entry.variant.width}` : '';
            process.stdout.write(`[capture] missing ${entry.id}${variant}: ${entry.reason}\n`);
        }
    }
}

// eslint-disable-next-line import-x/no-default-export -- Playwright loads a reporter by its default export.
export default CaptureIndexReporter;
