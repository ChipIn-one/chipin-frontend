import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, test } from 'vitest';

const prepare = parse(readFileSync('.github/workflows/prepare-release-qa.yml', 'utf8'));
const result = parse(readFileSync('.github/workflows/release-qa-result.yml', 'utf8'));

test('candidate preparation can only start manually from owner-controlled master code', () => {
    expect(Object.keys(prepare.on)).toEqual(['workflow_dispatch']);
    expect(prepare.jobs.prepare.if).toContain("github.actor == 'syllik'");
    expect(prepare.jobs.prepare.if).toContain("github.ref == 'refs/heads/master'");
    const checkouts = prepare.jobs.prepare.steps.filter(step =>
        step.uses?.startsWith('actions/checkout@'),
    );
    expect(checkouts).toHaveLength(2);
    expect(checkouts[0].with.ref).toBe('${{ github.sha }}');
    expect(checkouts[1].with).toMatchObject({
        repository: 'ChipIn-one/.github',
        ref: '7dbcfb2b72fca2d477c14f4d242261d72a103dbd',
        'persist-credentials': false,
    });
    expect(prepare.concurrency['cancel-in-progress']).toBe(false);
});

test('result reader has no Issue-write or deployment authority', () => {
    expect(Object.keys(result.on)).toEqual(['issue_comment']);
    expect(result.on.issue_comment.types).toEqual(['created', 'edited', 'deleted']);
    expect(result.jobs['read-result'].if).not.toContain('startsWith');
    expect(result.permissions).toEqual({ contents: 'read', issues: 'read' });
    expect(result.jobs['read-result'].steps[0].with.ref).toBe('${{ github.sha }}');
});

test('preparation dispatches with zero required inputs and documented defaults', () => {
    const inputs = prepare.on.workflow_dispatch.inputs;
    for (const [name, input] of Object.entries(inputs)) expect(input.required, name).toBe(false);
    expect(inputs.priority).toMatchObject({
        type: 'choice',
        default: 'P2',
        options: ['P0', 'P1', 'P2', 'P3'],
    });
    expect(inputs.qa_login.default).toBe('SoRawSteak');
    expect(inputs.reassign_qa).toMatchObject({ type: 'boolean', default: false });
    expect(prepare['run-name']).toBe("QA prepare ${{ inputs.candidate_sha || 'auto' }}");
    expect(prepare.concurrency.group).not.toContain('inputs.');
});

test('result reader posts to Slack only through env and never interpolates comment text into shell', () => {
    const steps = result.jobs['read-result'].steps;
    const validate = steps.find(step => step.run?.includes('release-qa-result.mjs'));
    expect(validate.env).toMatchObject({
        SLACK_WEBHOOK_CI: '${{ secrets.SLACK_WEBHOOK_CI }}',
        SLACK_USER_MAP: '${{ vars.SLACK_USER_MAP }}',
    });
    for (const step of steps) expect(step.run ?? '').not.toContain('${{');
    expect(JSON.stringify(result)).not.toContain('github.event.comment.body');
});

// Release browser matrix (#666, docs/e2e-tests.md#release-browser-matrix).
const smoke = parse(readFileSync('.github/workflows/e2e-smoke.yml', 'utf8'));
const OWNER_GUARD =
    "github.actor == 'syllik' && github.triggering_actor == 'syllik' && github.ref == 'refs/heads/master'";
const secretsOf = job =>
    [...JSON.stringify(job).matchAll(/secrets\.([A-Z0-9_]+)/g)].map(match => match[1]);
const PLAYWRIGHT_IMAGE = '"mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"';
const STRICT_VERSION_CHECK = '[[ ! "$PLAYWRIGHT_VERSION" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]';

/**
 * Asserts the job gets its browsers only from the pinned Playwright image (#750): no apt, no browser
 * install, no cache; a separate pull step; the test step runs `command` in the image under the
 * runner's Node (mounted read-only, first on PATH) as the runner user, with the workspace and
 * RUNNER_TEMP at their own paths, and passes exactly `names` (by name) plus CI into it. The container
 * is named after the run id and removed by an always-run step before the purge.
 */
const expectTestsInPlaywrightImage = (job, testStepId, command, names) => {
    const { steps } = job;
    for (const step of steps) {
        expect(step.run ?? '', step.name).not.toMatch(/playwright install|apt(-get)? /);
        expect(step.uses ?? '', step.name).not.toMatch(/^actions\/cache/);
    }
    expect(JSON.stringify(job)).not.toContain('ms-playwright');
    expect(job.container).toBeUndefined();
    const version = steps.find(step => step.id === 'playwright');
    expect(version.run).toContain('^[0-9]+\\.[0-9]+\\.[0-9]+$');
    const pull = steps.find(step => step.name === 'Pull the Playwright image');
    expect(pull['timeout-minutes']).toBe(5);
    expect(pull.env).toEqual({ PLAYWRIGHT_VERSION: '${{ steps.playwright.outputs.version }}' });
    expect(pull.run).toContain(STRICT_VERSION_CHECK);
    expect(pull.run).toContain(`docker pull ${PLAYWRIGHT_IMAGE}`);
    expect(steps.indexOf(pull)).toBeLessThan(steps.findIndex(step => step.id === testStepId));
    const test = steps.find(step => step.id === testStepId);
    expect(test.env.PLAYWRIGHT_VERSION).toBe('${{ steps.playwright.outputs.version }}');
    expect(test.run).toContain(STRICT_VERSION_CHECK);
    expect(test.run).toContain('docker run --rm --ipc=host --init');
    expect(test.run).toContain('--user "$(id -u):$(id -g)"');
    expect(test.run).toContain('-v "$GITHUB_WORKSPACE:$GITHUB_WORKSPACE"');
    expect(test.run).toContain('-v "$RUNNER_TEMP:$RUNNER_TEMP"');
    expect(test.run).toContain('-w "$PWD"');
    expect(test.run).toContain('--name "$CHIPIN_E2E_RUN_ID"');
    expect(test.env.CHIPIN_E2E_RUN_ID).toBe('${{ steps.run.outputs.id }}');
    // The repository's Node 24 from setup-node, not the image's own Node, runs the tests.
    expect(test.run).toContain('node_home="$(dirname "$(dirname "$(command -v node)")")"');
    expect(test.run).toContain('-v "$node_home:/opt/host-node:ro"');
    expect(test.run).toContain(
        '-e PATH=/opt/host-node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \\',
    );
    expect(
        test.run
            .trimEnd()
            .endsWith(`${PLAYWRIGHT_IMAGE} \\\n  bash -c 'node --version && exec ${command}'`),
    ).toBe(true);
    // Every variable by name only (its value stays in the step's env), never `-e NAME=value`; only
    // the fixed HOME and PATH carry a value.
    const passed = [...test.run.matchAll(/-e ([A-Z0-9_]+)(=\S*)?/g)];
    expect(passed.filter(match => match[2] && !['HOME', 'PATH'].includes(match[1]))).toEqual([]);
    expect(passed.map(match => match[1]).sort()).toEqual(['CI', 'HOME', 'PATH', ...names].sort());
    expect(test.run).not.toMatch(/--env(-file)?\b/);
    // Each passed name has its value in this step's env (CI comes from the runner).
    for (const [, name] of passed.filter(match => !['HOME', 'PATH', 'CI'].includes(match[1])))
        expect(Object.keys(test.env), name).toContain(name);
    // A container orphaned by a killed docker client is removed right after the test step, before
    // the artifact steps and the purge.
    const stop = steps.find(step => step.name === 'Stop the test container');
    expect(steps.indexOf(stop)).toBe(steps.indexOf(test) + 1);
    expect(steps.indexOf(stop)).toBeLessThan(
        steps.findIndex(step => step.name === 'Purge the run on staging'),
    );
    expect(stop.if).toBe("always() && steps.run.outputs.id != ''");
    expect(stop['timeout-minutes']).toBe(1);
    expect(stop.env).toEqual({ RUN_ID: '${{ steps.run.outputs.id }}' });
    expect(stop.run).toBe('docker rm -f "$RUN_ID" >/dev/null 2>&1 || true');
    // Secrets stay in this step's env only (and in the later scan and purge steps), never job-wide.
    expect(job.env).toBeUndefined();
};

test('preparation runs resolve, then one e2e job per profile, then prepare, each behind the owner guard', () => {
    expect(Object.keys(prepare.jobs)).toEqual(['resolve', 'e2e', 'prepare']);
    expect(prepare.permissions).toEqual({});
    for (const job of Object.values(prepare.jobs)) expect(job.if).toContain(OWNER_GUARD);
    expect(prepare.jobs.e2e.needs).toBe('resolve');
    expect(prepare.jobs.prepare.needs).toEqual(['resolve', 'e2e']);
    // A failed or missing matrix still reaches the QA Issue; a cancelled run does not.
    expect(prepare.jobs.prepare.if).toMatch(
        /^!cancelled\(\) && needs\.resolve\.result == 'success' && /,
    );
    expect(prepare.concurrency).toEqual({
        group: 'release-qa-${{ github.repository }}',
        'cancel-in-progress': false,
    });
});

test('only prepare holds the Issue, Slack and dev-read secrets; the e2e job holds only staging and bypass secrets', () => {
    const { resolve, e2e, prepare: job } = prepare.jobs;
    // The optional bypass secret reaches only the probe of the validated Preview URL.
    expect(secretsOf(resolve)).toEqual(['VERCEL_AUTOMATION_BYPASS_SECRET']);
    expect(resolve.steps.at(-1).env.GITHUB_TOKEN).toBe('${{ github.token }}');
    expect(resolve.permissions).toEqual({ contents: 'read', actions: 'read', deployments: 'read' });
    expect(new Set(secretsOf(e2e))).toEqual(
        new Set([
            'CHIPIN_CONTRACT_SWAGGER_USER',
            'CHIPIN_CONTRACT_SWAGGER_PASSWORD',
            'VERCEL_AUTOMATION_BYPASS_SECRET',
        ]),
    );
    expect(e2e.permissions).toEqual({ contents: 'read' });
    expect(new Set(secretsOf(job))).toEqual(
        new Set([
            'CHIPIN_DEV_READ_TOKEN',
            'CHIPIN_ISSUE_WRITE_TOKEN',
            'SLACK_WEBHOOK_CI',
            'VERCEL_AUTOMATION_BYPASS_SECRET',
        ]),
    );
    // Trusted jobs install nothing and run only this master SHA's code.
    for (const trusted of [resolve, job]) {
        expect(JSON.stringify(trusted.steps)).not.toMatch(/npm (ci|install)|npx /);
        expect(trusted.steps[0].with.ref).toBe('${{ github.sha }}');
    }
    // No workflow expression inside any shell script: values reach scripts through env.
    for (const each of Object.values(prepare.jobs))
        for (const step of each.steps) expect(step.run ?? '', step.name).not.toContain('${{');
    const run = job.steps.find(step => step.run?.includes('release-qa-prepare.mjs'));
    expect(run.env).toMatchObject({
        CANDIDATE_SHA: '${{ needs.resolve.outputs.sha }}',
        PREVIEW_DEPLOYMENT_ID: '${{ needs.resolve.outputs.deployment_id }}',
        E2E_MATRIX_DIR: '${{ runner.temp }}/e2e-results',
    });
    const download = job.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    expect(download.uses).toMatch(/@[0-9a-f]{40}$/);
    expect(download.with.pattern).toBe('e2e-result-*');
});

test('the matrix runs five profiles without fail-fast, installs only its own browser and targets the resolved Preview', () => {
    const { e2e } = prepare.jobs;
    expect(e2e.name).toBe('e2e ${{ matrix.profile }}');
    expect(e2e.strategy['fail-fast']).toBe(false);
    expect(e2e.strategy.matrix.include).toEqual([
        { profile: 'chromium' },
        { profile: 'firefox' },
        { profile: 'webkit' },
        { profile: 'pixel' },
        { profile: 'iphone' },
    ]);
    // Hard caps, not the wall-time target: a test step cut at 7 minutes still leaves room for the purge.
    expect(e2e['timeout-minutes']).toBe(15);
    const checkout = e2e.steps.find(step => step.uses?.startsWith('actions/checkout@'));
    expect(checkout.with).toEqual({
        ref: '${{ needs.resolve.outputs.sha }}',
        'persist-credentials': false,
    });
    expectTestsInPlaywrightImage(e2e, 'e2e', 'npx playwright test --project="$PROFILE"', [
        'PROFILE',
        'CHIPIN_CONTRACT_SWAGGER_USER',
        'CHIPIN_CONTRACT_SWAGGER_PASSWORD',
        'VERCEL_AUTOMATION_BYPASS_SECRET',
        'CHIPIN_E2E_RUN_ID',
        'CHIPIN_E2E_BASE_URL',
        'CHIPIN_E2E_JSON_REPORT',
    ]);
    const pull = e2e.steps.find(step => step.name === 'Pull the Playwright image');
    expect(pull.if).toBe("steps.project.outputs.available == 'true'");
    const test = e2e.steps.find(step => step.id === 'e2e');
    expect(test['working-directory']).toBe('apps/app');
    // The matrix never falls back to the local dev server: an empty Preview URL fails before docker.
    const guard = test.run.indexOf('if [[ -z "$CHIPIN_E2E_BASE_URL" ]]; then');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(test.run.indexOf('docker run'));
    expect(test.run.slice(guard)).toMatch(
        /^[^\n]*\n\s*echo "::error::[^"]*CHIPIN_E2E_BASE_URL[^"]*"\n\s*exit 1\n/,
    );
    // The result step reads the JSON report where the container wrote it.
    const write = e2e.steps.find(step => step.name === 'Write profile result');
    expect(test.env.CHIPIN_E2E_JSON_REPORT).toBe(write.env.REPORT);
    expect(test.env).toMatchObject({
        CHIPIN_E2E_BASE_URL: '${{ needs.resolve.outputs.url }}',
        CHIPIN_E2E_RUN_ID: '${{ steps.run.outputs.id }}',
        PROFILE: '${{ matrix.profile }}',
    });
    expect(test['timeout-minutes']).toBe(7);
    expect(test.if).toBe("steps.project.outputs.available == 'true'");
    // A candidate without the profile's project is reported, not run.
    const project = e2e.steps.find(step => step.id === 'project');
    expect(project.run).toContain('npx playwright test --list --project="$PROFILE"');
    expect(project.run).toContain('Project(s) \\"$PROFILE\\" not found');
    expect(project.run).toContain('echo "available=false"');
});

test('each profile job provisions and purges like the PR smoke: own run id first, purge always, artifacts after a verified purge', () => {
    const steps = prepare.jobs.e2e.steps;
    expect(steps[0].id).toBe('run');
    expect(steps[0].run).toContain('fe-e2e-$(date +%s%3N)-$(openssl rand -hex 6)');
    const purge = steps.at(-1);
    expect(purge.name).toBe('Purge the run on staging');
    expect(purge.if).toMatch(/^always\(\) && steps\.run\.outputs\.id != ''/);
    const report = steps.find(step => step.name === 'Upload Playwright report and traces');
    expect(report.if).toBe(
        "failure() && steps.purge-marker.outputs.verified == 'true' && steps.scan.outcome == 'success'",
    );
    const scan = steps.find(step => step.id === 'scan');
    expect(scan.env.VERCEL_BYPASS).toBe('${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}');
    // The small result file is the only artifact uploaded without the purge gate.
    const result = steps.find(step => step.name === 'Upload profile result');
    expect(result.with.name).toBe('e2e-result-${{ matrix.profile }}');
    expect(result.with.path).toBe('${{ runner.temp }}/e2e-result/result.json');
    // "Re-run failed jobs" replaces the earlier result of the same profile.
    expect(result.with.overwrite).toBe(true);
    const write = steps.find(step => step.name === 'Write profile result');
    expect(write.run).toContain('version: 1, profile: $profile, status: $status');
    expect(write.run).toContain('status=unsupported');
});

test('pull requests still run only the desktop Chromium project, in the Playwright image', () => {
    const job = smoke.jobs['e2e-smoke'];
    expectTestsInPlaywrightImage(job, 'smoke', 'npm run test:e2e -- --project=chromium', [
        'CHIPIN_CONTRACT_SWAGGER_USER',
        'CHIPIN_CONTRACT_SWAGGER_PASSWORD',
        'CHIPIN_E2E_RUN_ID',
    ]);
    expect(job['timeout-minutes']).toBe(15);
    const test = job.steps.find(step => step.id === 'smoke');
    expect(test['timeout-minutes']).toBe(10);
    for (const step of job.steps) expect(step.run ?? '', step.name).not.toContain('${{');
});

test('the Playwright projects are exactly the matrix profiles', async () => {
    const [{ default: config }, { MATRIX_PROFILES }] = await Promise.all([
        import('../../apps/app/playwright.config.ts'),
        import('./core.mjs'),
    ]);
    expect(config.projects.map(project => project.name)).toEqual(
        MATRIX_PROFILES.map(profile => profile.id),
    );
    expect(prepare.jobs.e2e.strategy.matrix.include.map(leg => leg.profile)).toEqual(
        MATRIX_PROFILES.map(profile => profile.id),
    );
    const byName = Object.fromEntries(config.projects.map(project => [project.name, project.use]));
    for (const phone of ['pixel', 'iphone']) {
        expect(byName[phone]).toMatchObject({ isMobile: true, hasTouch: true });
        expect(byName[phone].viewport.width).toBeLessThan(500);
    }
    expect(byName.iphone.defaultBrowserType).toBe('webkit');
    expect(byName.pixel.defaultBrowserType).toBe('chromium');
});
