// Playwright global setup (docs/e2e-tests.md): checks the credentials and the staging API, then
// opens one run. Every worker reads the run id from the environment; the returned function is the
// global teardown, which Playwright runs after all tests, also after a failure, and which purges
// the run, verifies it is empty and only then writes the purge marker that CI requires before it
// uploads any artifact.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FullConfig } from '@playwright/test';

import {
    E2E_PURGE_MARKER_FILE,
    E2E_RUN_ID_VARIABLE,
    readE2eEnvironment,
    resolveE2eBasicAuth,
} from './config';
import {
    assertStagingApiReachable,
    createProvisioningClient,
    createRunId,
    formatPurgeCounts,
    isRunId,
    purgeAndVerify,
} from './provisioning';

const log = (message: string): void => {
    process.stdout.write(`[e2e] ${message}\n`);
};

/** The run id CI created (so it can purge after a cancel or crash), else a fresh one. */
const resolveRunId = (): string => {
    const preset = process.env[E2E_RUN_ID_VARIABLE]?.trim();

    if (preset && isRunId(preset)) {
        return preset;
    }

    if (preset) {
        log(`ignoring the malformed ${E2E_RUN_ID_VARIABLE}; a new run id is created`);
    }

    return createRunId();
};

const globalSetup = async (config: FullConfig): Promise<() => Promise<void>> => {
    const basicAuth = resolveE2eBasicAuth(readE2eEnvironment());
    const outputDir = config.projects[0]?.outputDir;

    if (!outputDir) {
        throw new Error('playwright.config.ts must define a project with an output folder');
    }

    const markerPath = path.join(outputDir, E2E_PURGE_MARKER_FILE);
    // A marker of an earlier run must never vouch for this one.
    await rm(markerPath, { force: true });

    await assertStagingApiReachable();

    const runId = resolveRunId();
    process.env[E2E_RUN_ID_VARIABLE] = runId;
    log(`provisioning run ${runId}`);

    return async () => {
        const counts = await purgeAndVerify(createProvisioningClient(basicAuth, runId));
        log(`purged ${formatPurgeCounts(counts)}`);
        log(`verified run ${runId} is empty`);

        await mkdir(outputDir, { recursive: true });
        await writeFile(markerPath, `${runId}\n`, 'utf8');
    };
};

// eslint-disable-next-line import-x/no-default-export -- Playwright loads globalSetup by its default export.
export default globalSetup;
