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

test('result reader never holds the Slack webhook and never interpolates comment text into shell', () => {
    const steps = result.jobs['read-result'].steps;
    const validate = steps.find(step => step.run?.includes('release-qa-result.mjs'));
    expect(validate.env).toEqual({
        GITHUB_TOKEN: '${{ github.token }}',
        SLACK_USER_MAP: '${{ vars.SLACK_USER_MAP }}',
    });
    for (const step of steps) expect(step.run ?? '').not.toContain('${{');
    expect(JSON.stringify(result)).not.toContain('github.event.comment.body');
});

// chipin-frontend#876: every Slack post goes through the pinned shared org action; the webhook secret is
// only its `webhook-url` input, never in the env of a step that holds a GitHub token.
const SLACK_ACTION =
    'ChipIn-one/.github/automation/slack-notify-action@5a58d05dde71164eb97aba9f9717efa949266d9a';
const frontendCi = parse(readFileSync('.github/workflows/frontend-ci.yml', 'utf8'));

const expectSharedSlackSteps = (steps, scriptStep) => {
    const build = steps.find(step => step.id === scriptStep);
    const index = steps.indexOf(build);
    const [post, warn] = steps.slice(index + 1);
    expect(post).toEqual({
        name: 'Post to Slack',
        id: 'slack',
        if: `steps.${scriptStep}.outputs.slack_post == 'true'`,
        'continue-on-error': true,
        uses: SLACK_ACTION,
        with: {
            'webhook-url': '${{ secrets.SLACK_WEBHOOK_FE_RELEASES }}',
            text: `\${{ steps.${scriptStep}.outputs.slack_text }}`,
            'timeout-seconds': '10',
        },
    });
    expect(warn.if).toBe(
        `steps.${scriptStep}.outputs.slack_post == 'true' && steps.slack.outputs.result != 'sent'`,
    );
    expect(warn.env).toEqual({
        RESULT: '${{ steps.slack.outputs.result }}',
        FAILURE: `\${{ steps.${scriptStep}.outputs.slack_failure }}`,
    });
    expect(warn.run).toContain(
        'echo "::warning::SLACK_WEBHOOK_FE_RELEASES is not configured; nothing was posted."',
    );
    expect(warn.run).toContain('echo "::warning::$FAILURE"');
    expect(steps.at(-1)).toBe(warn);
};

test('both QA workflows post the script text through the shared Slack action and warn on non-delivery', () => {
    expectSharedSlackSteps(prepare.jobs.prepare.steps, 'prepare');
    expectSharedSlackSteps(result.jobs['read-result'].steps, 'result');
});

// #882: release QA posts to #fe-releases, red master CI to #ci; each workflow holds only its own webhook.
test('each Slack webhook is only the webhook-url input of the shared action, and nothing curls Slack', () => {
    const notify = frontendCi.jobs['notify-master-failure'];
    for (const [workflow, own, other] of [
        [prepare, 'SLACK_WEBHOOK_FE_RELEASES', 'SLACK_WEBHOOK_CI'],
        [result, 'SLACK_WEBHOOK_FE_RELEASES', 'SLACK_WEBHOOK_CI'],
        [frontendCi, 'SLACK_WEBHOOK_CI', 'SLACK_WEBHOOK_FE_RELEASES'],
    ]) {
        expect(JSON.stringify(workflow)).toContain(`secrets.${own} }}`);
        expect(JSON.stringify(workflow)).not.toContain(other);
        for (const job of Object.values(workflow.jobs)) {
            for (const step of job.steps ?? []) {
                const { with: inputs = {}, ...rest } = step;
                expect(JSON.stringify(rest), step.name).not.toContain(`secrets.${own}`);
                expect(JSON.stringify(step), step.name).not.toMatch(/hooks\.slack\.com|curl /);
                if (JSON.stringify(inputs).includes(own)) {
                    expect(step.uses, step.name).toBe(SLACK_ACTION);
                    expect(inputs['webhook-url']).toBe(`\${{ secrets.${own} }}`);
                }
            }
        }
    }
    expect(notify.name).toBe('Notify #ci on master failure');
    expect(notify.permissions).toEqual({});
    expect(notify.steps.map(step => step.uses ?? 'run')).toEqual(['run', SLACK_ACTION]);
    const [build, post] = notify.steps;
    expect(build['continue-on-error']).toBe(true);
    expect(build.run).not.toContain('${{');
    expect(post).toMatchObject({
        if: "steps.message.outputs.text != ''",
        'continue-on-error': true,
        with: {
            'webhook-url': '${{ secrets.SLACK_WEBHOOK_CI }}',
            text: '${{ steps.message.outputs.text }}',
            'timeout-seconds': '10',
        },
    });
});

// Release browser matrix (#666, docs/e2e-tests.md#release-browser-matrix) and the PR smoke: both
// call the reusable e2e-run.yml (#743), which holds every e2e step.
const smoke = parse(readFileSync('.github/workflows/e2e-smoke.yml', 'utf8'));
const run = parse(readFileSync('.github/workflows/e2e-run.yml', 'utf8'));
const runJob = run.jobs.run;
const runSteps = runJob.steps;
const OWNER_GUARD =
    "github.actor == 'syllik' && github.triggering_actor == 'syllik' && github.ref == 'refs/heads/master'";
const secretsOf = job =>
    [...JSON.stringify(job).matchAll(/secrets\.([A-Z0-9_]+)/g)].map(match => match[1]);
const PLAYWRIGHT_IMAGE = '"mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble"';
const STRICT_VERSION_CHECK = '[[ ! "$PLAYWRIGHT_VERSION" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]]';
const RUNS_WHEN_AVAILABLE =
    "inputs.target == 'dev-server' || steps.project.outputs.available == 'true'";
const testStep = runSteps.find(step => step.id === 'e2e');
const envNames = text => [...text.matchAll(/-e ([A-Z0-9_]+)(=\S*)?/g)];
// The `case` branch of one target in the test step's script.
const branchOf = target => {
    const start = testStep.run.indexOf(`\n  ${target})\n`);
    expect(start, target).toBeGreaterThan(-1);
    return testStep.run.slice(start, testStep.run.indexOf(';;', start));
};

test('both callers run the shared e2e-run.yml with explicit secrets and keep their job ids, names and artifacts', () => {
    expect(Object.keys(run.on)).toEqual(['workflow_call']);
    expect(Object.keys(run.on.workflow_call.secrets)).toEqual([
        'CHIPIN_CONTRACT_SWAGGER_USER',
        'CHIPIN_CONTRACT_SWAGGER_PASSWORD',
        'VERCEL_AUTOMATION_BYPASS_SECRET',
    ]);
    // Not required by GitHub; "Check the inputs" fails clearly when a Basic secret is empty.
    for (const secret of Object.values(run.on.workflow_call.secrets))
        expect(secret.required).toBe(false);
    expect(run.permissions).toEqual({});
    expect(Object.keys(run.jobs)).toEqual(['run']);
    expect(runJob.name).toBe('run');
    expect(runJob.permissions).toEqual({ contents: 'read' });
    expect(runJob['timeout-minutes']).toBe(15);
    expect(runJob['runs-on']).toBe('ubuntu-24.04');

    const e2eSmoke = smoke.jobs['e2e-smoke'];
    const { e2e } = prepare.jobs;
    for (const caller of [e2eSmoke, e2e]) {
        expect(caller.uses).toBe('./.github/workflows/e2e-run.yml');
        expect(caller.permissions).toEqual({ contents: 'read' });
        expect(caller.secrets).not.toBe('inherit');
        expect(caller.steps).toBeUndefined();
        expect(caller['timeout-minutes']).toBeUndefined();
    }
    expect(Object.keys(smoke.jobs)).toEqual(['check', 'e2e-smoke']);
    expect(e2eSmoke).toMatchObject({
        name: 'e2e-smoke',
        needs: 'check',
        if: "needs.check.outputs.available == 'true'",
    });
    expect(e2eSmoke.with).toEqual({
        ref: "${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}",
        project: 'chromium',
        target: 'dev-server',
        report_artifact_name: 'e2e-smoke-report-${{ github.run_id }}-${{ github.run_attempt }}',
        test_timeout_minutes: 10,
    });
    // The smoke never gets the Vercel bypass secret.
    expect(e2eSmoke.secrets).toEqual({
        CHIPIN_CONTRACT_SWAGGER_USER: '${{ secrets.CHIPIN_CONTRACT_SWAGGER_USER }}',
        CHIPIN_CONTRACT_SWAGGER_PASSWORD: '${{ secrets.CHIPIN_CONTRACT_SWAGGER_PASSWORD }}',
    });
    expect(e2e.name).toBe('e2e ${{ matrix.profile }}');
    expect(e2e.with).toEqual({
        ref: '${{ needs.resolve.outputs.sha }}',
        project: '${{ matrix.profile }}',
        target: 'preview',
        base_url: '${{ needs.resolve.outputs.url }}',
        report_artifact_name:
            'release-qa-e2e-report-${{ matrix.profile }}-${{ github.run_id }}-${{ github.run_attempt }}',
        test_timeout_minutes: 7,
        all_projects: 'chromium firefox webkit pixel iphone',
    });
    expect(e2e.secrets).toEqual({
        CHIPIN_CONTRACT_SWAGGER_USER: '${{ secrets.CHIPIN_CONTRACT_SWAGGER_USER }}',
        CHIPIN_CONTRACT_SWAGGER_PASSWORD: '${{ secrets.CHIPIN_CONTRACT_SWAGGER_PASSWORD }}',
        VERCEL_AUTOMATION_BYPASS_SECRET: '${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}',
    });
    const report = runSteps.find(step => step.name === 'Upload Playwright report and traces');
    expect(report.with.name).toBe('${{ inputs.report_artifact_name }}');
});

test('the shared job checks its inputs and keeps secrets in the test, scan and purge steps only', () => {
    const checkout = runSteps.find(step => step.uses?.startsWith('actions/checkout@'));
    expect(checkout.with).toEqual({ ref: '${{ inputs.ref }}', 'persist-credentials': false });
    const inputs = runSteps.find(step => step.name === 'Check the inputs');
    expect(runSteps.indexOf(inputs)).toBe(1);
    expect(inputs.env.TARGET).toBe('${{ inputs.target }}');
    expect(inputs.run).toContain(
        'if [[ "$TARGET" != "dev-server" && "$TARGET" != "preview" ]]; then',
    );
    // Only whether the Basic secrets are set reaches the input check, never their values.
    expect(inputs.env).toMatchObject({
        HAS_SWAGGER_USER: "${{ secrets.CHIPIN_CONTRACT_SWAGGER_USER != '' }}",
        HAS_SWAGGER_PASSWORD: "${{ secrets.CHIPIN_CONTRACT_SWAGGER_PASSWORD != '' }}",
    });
    expect(inputs.run).toMatch(
        /if \[\[ "\$HAS_SWAGGER_USER" != "true" \|\| "\$HAS_SWAGGER_PASSWORD" != "true" \]\]; then\n\s*echo "::error::[^"$]*"\n\s*exit 1\n/,
    );
    const withSecrets = runSteps
        .filter(step => secretsOf(step).length > 0)
        .map(step => step.id ?? step.name);
    expect(withSecrets).toEqual(['Check the inputs', 'e2e', 'scan', 'Purge the run on staging']);
    expect(runSteps.at(-1).name).toBe('Purge the run on staging');
    const install = runSteps.find(step => step.run === 'npm ci');
    expect(install.env).toBeUndefined();
    // No workflow expression inside any shell script: values reach scripts through env.
    for (const step of runSteps) expect(step.run ?? '', step.name).not.toContain('${{');
});

/**
 * Asserts the job gets its browsers only from the pinned Playwright image (#750): no apt, no browser
 * install, no cache; a separate pull step; the test step runs its target's command in the image under
 * the runner's Node (mounted read-only, first on PATH) as the runner user, with the workspace and
 * RUNNER_TEMP at their own paths, and passes exactly its target's `names` (by name) plus CI into it.
 * The container is named after the run id and removed by an always-run step before the purge.
 */
const expectTestsInPlaywrightImage = targets => {
    for (const step of runSteps) {
        expect(step.run ?? '', step.name).not.toMatch(/playwright install|apt(-get)? /);
        expect(step.uses ?? '', step.name).not.toMatch(/^actions\/cache/);
    }
    expect(JSON.stringify(run)).not.toContain('ms-playwright');
    expect(runJob.container).toBeUndefined();
    const version = runSteps.find(step => step.id === 'playwright');
    expect(version.run).toContain('^[0-9]+\\.[0-9]+\\.[0-9]+$');
    const pull = runSteps.find(step => step.name === 'Pull the Playwright image');
    expect(pull['timeout-minutes']).toBe(5);
    expect(pull.env).toEqual({ PLAYWRIGHT_VERSION: '${{ steps.playwright.outputs.version }}' });
    expect(pull.run).toContain(STRICT_VERSION_CHECK);
    expect(pull.run).toContain(`docker pull ${PLAYWRIGHT_IMAGE}`);
    expect(runSteps.indexOf(pull)).toBeLessThan(runSteps.indexOf(testStep));
    const test = testStep;
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
            .endsWith(`${PLAYWRIGHT_IMAGE} \\\n  bash -c "node --version && $command"`),
    ).toBe(true);
    // Every variable by name only (its value stays in the step's env), never `-e NAME=value`; only
    // the fixed HOME and PATH carry a value.
    const all = envNames(test.run);
    expect(all.filter(match => match[2] && !['HOME', 'PATH'].includes(match[1]))).toEqual([]);
    expect(test.run).not.toMatch(/--env(-file)?\b/);
    const branches = Object.keys(targets).map(branchOf);
    const common = branches.reduce((text, branch) => text.replace(branch, ''), test.run);
    expect(envNames(common).map(match => match[1])).toEqual(['PATH', 'HOME', 'CI']);
    expect(common).toContain('"${target_env[@]}" \\');
    for (const [target, { command, names }] of Object.entries(targets)) {
        const branch = branchOf(target);
        expect(branch, target).toContain(command);
        expect(
            envNames(branch)
                .map(match => match[1])
                .sort(),
            target,
        ).toEqual([...names].sort());
        // Each passed name has its value in this step's env (CI comes from the runner).
        for (const name of names) expect(Object.keys(test.env), name).toContain(name);
    }
    // A container orphaned by a killed docker client is removed right after the test step, before
    // the artifact steps and the purge.
    const stop = runSteps.find(step => step.name === 'Stop the test container');
    expect(runSteps.indexOf(stop)).toBe(runSteps.indexOf(test) + 1);
    expect(runSteps.indexOf(stop)).toBeLessThan(
        runSteps.findIndex(step => step.name === 'Purge the run on staging'),
    );
    expect(stop.if).toBe("always() && steps.run.outputs.id != ''");
    expect(stop['timeout-minutes']).toBe(1);
    expect(stop.env).toEqual({ RUN_ID: '${{ steps.run.outputs.id }}' });
    expect(stop.run).toBe('docker rm -f "$RUN_ID" >/dev/null 2>&1 || true');
    // Secrets stay in this step's env only (and in the later scan and purge steps), never job-wide.
    expect(runJob.env).toBeUndefined();
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

const prepareRunOf = job => job.steps.find(step => step.run?.includes('release-qa-prepare.mjs'));

test('only prepare holds the Issue, Slack and dev-read secrets; the e2e job holds only staging and bypass secrets', () => {
    const { resolve, e2e, prepare: job } = prepare.jobs;
    // The optional bypass secret reaches only the probe of the validated Preview URL.
    expect(secretsOf(resolve)).toEqual(['VERCEL_AUTOMATION_BYPASS_SECRET']);
    expect(resolve.steps.at(-1).env.GITHUB_TOKEN).toBe('${{ github.token }}');
    expect(resolve.permissions).toEqual({ contents: 'read', actions: 'read', deployments: 'read' });
    const staging = ['CHIPIN_CONTRACT_SWAGGER_USER', 'CHIPIN_CONTRACT_SWAGGER_PASSWORD'];
    expect(new Set(secretsOf(e2e))).toEqual(
        new Set([...staging, 'VERCEL_AUTOMATION_BYPASS_SECRET']),
    );
    expect(new Set(secretsOf(runJob))).toEqual(
        new Set([...staging, 'VERCEL_AUTOMATION_BYPASS_SECRET']),
    );
    expect(new Set(secretsOf(smoke.jobs['e2e-smoke']))).toEqual(new Set(staging));
    expect(e2e.permissions).toEqual({ contents: 'read' });
    expect(new Set(secretsOf(job))).toEqual(
        new Set([
            'CHIPIN_DEV_READ_TOKEN',
            'CHIPIN_ISSUE_WRITE_TOKEN',
            'SLACK_WEBHOOK_FE_RELEASES',
            'VERCEL_AUTOMATION_BYPASS_SECRET',
        ]),
    );
    // The webhook never shares a step env with the Issue write or dev-read token.
    expect(JSON.stringify(prepareRunOf(job).env)).not.toContain('SLACK_WEBHOOK_FE_RELEASES');
    // Trusted jobs install nothing and run only this master SHA's code.
    for (const trusted of [resolve, job]) {
        expect(JSON.stringify(trusted.steps)).not.toMatch(/npm (ci|install)|npx /);
        expect(trusted.steps[0].with.ref).toBe('${{ github.sha }}');
    }
    // No workflow expression inside any shell script: values reach scripts through env.
    for (const each of [resolve, job])
        for (const step of each.steps) expect(step.run ?? '', step.name).not.toContain('${{');
    const prepareRun = prepareRunOf(job);
    expect(prepareRun.env).toMatchObject({
        CANDIDATE_SHA: '${{ needs.resolve.outputs.sha }}',
        PREVIEW_DEPLOYMENT_ID: '${{ needs.resolve.outputs.deployment_id }}',
        E2E_MATRIX_DIR: '${{ runner.temp }}/e2e-results',
    });
    const download = job.steps.find(step => step.uses?.startsWith('actions/download-artifact@'));
    expect(download.uses).toMatch(/@[0-9a-f]{40}$/);
    expect(download.with.pattern).toBe('e2e-result-*');
});

test('the shared job runs each target in the Playwright image with exactly its own variables', () => {
    expectTestsInPlaywrightImage({
        preview: {
            command: `command='exec npx playwright test --project="$PROFILE"'`,
            names: [
                'PROFILE',
                'CHIPIN_CONTRACT_SWAGGER_USER',
                'CHIPIN_CONTRACT_SWAGGER_PASSWORD',
                'VERCEL_AUTOMATION_BYPASS_SECRET',
                'CHIPIN_E2E_RUN_ID',
                'CHIPIN_E2E_BASE_URL',
                'CHIPIN_E2E_JSON_REPORT',
            ],
        },
        'dev-server': {
            command: 'command="exec npm run test:e2e -- --project=$PROFILE"',
            names: [
                'CHIPIN_CONTRACT_SWAGGER_USER',
                'CHIPIN_CONTRACT_SWAGGER_PASSWORD',
                'CHIPIN_E2E_RUN_ID',
            ],
        },
    });
    // The dev-server command embeds PROFILE on the host: only after the input check allowed it.
    const inputs = runSteps.find(step => step.name === 'Check the inputs');
    expect(inputs.run).toContain("name='^[a-z0-9][a-z0-9-]*$'");
    expect(inputs.run).toContain('if [[ ! "$PROFILE" =~ $name ]]; then');
});

test('the matrix runs five profiles without fail-fast and targets the resolved Preview', () => {
    const { e2e } = prepare.jobs;
    expect(e2e.strategy['fail-fast']).toBe(false);
    expect(e2e.strategy.matrix.include).toEqual([
        { profile: 'chromium' },
        { profile: 'firefox' },
        { profile: 'webkit' },
        { profile: 'pixel' },
        { profile: 'iphone' },
    ]);
    // Hard caps, not the wall-time target: a test step cut at 7 minutes still leaves room for the purge.
    expect(runJob['timeout-minutes']).toBe(15);
    expect(testStep['timeout-minutes']).toBe('${{ inputs.test_timeout_minutes }}');
    for (const name of ['Pull the Playwright image', 'Check staging API'])
        expect(runSteps.find(step => step.name === name).if, name).toBe(RUNS_WHEN_AVAILABLE);
    expect(testStep.if).toBe(RUNS_WHEN_AVAILABLE);
    expect(testStep['working-directory']).toBe(
        "${{ inputs.target == 'preview' && 'apps/app' || '.' }}",
    );
    // The matrix never falls back to the local dev server: an empty Preview URL fails before docker.
    const preview = branchOf('preview');
    const guard = preview.indexOf('if [[ -z "$CHIPIN_E2E_BASE_URL" ]]; then');
    expect(guard).toBeGreaterThan(-1);
    expect(testStep.run.indexOf(preview) + guard).toBeLessThan(testStep.run.indexOf('docker run'));
    expect(preview.slice(guard)).toMatch(
        /^[^\n]*\n\s*echo "::error::[^"]*CHIPIN_E2E_BASE_URL[^"]*"\n\s*exit 1\n/,
    );
    // The result step reads the JSON report where the container wrote it.
    const write = runSteps.find(step => step.name === 'Write profile result');
    expect(testStep.env.CHIPIN_E2E_JSON_REPORT).toBe(write.env.REPORT);
    expect(testStep.env).toMatchObject({
        CHIPIN_E2E_BASE_URL: '${{ inputs.base_url }}',
        CHIPIN_E2E_RUN_ID: '${{ steps.run.outputs.id }}',
        PROFILE: '${{ inputs.project }}',
        TARGET: '${{ inputs.target }}',
    });
});

test('a candidate lacking any matrix project reports every profile as unsupported', () => {
    const project = runSteps.find(step => step.id === 'project');
    expect(project.if).toBe("inputs.target == 'preview'");
    expect(project.env.ALL_PROJECTS).toBe('${{ inputs.all_projects }}');
    // One listing of every matrix project, so each leg sees the same answer.
    expect(project.run).toContain(
        'for project in "${projects[@]}"; do args+=("--project=$project"); done',
    );
    expect(project.run).toContain('npx playwright test --list "${args[@]}"');
    // Only the pre-matrix shape: other projects not found, exactly "chromium" available.
    const notFound = /grep -qE '([^']+)'/.exec(project.run)[1];
    const pattern = new RegExp(notFound, 'm');
    const preMatrix =
        'Project(s) "firefox", "webkit", "pixel", "iphone" not found. Available projects: "chromium"';
    expect(pattern.test(`Error: ${preMatrix}`)).toBe(true);
    expect(pattern.test(`Listing tests:\nError: ${preMatrix}\n`)).toBe(true);
    expect(
        pattern.test('Error: Project(s) "firefox" not found. Available projects: "chromium"'),
    ).toBe(true);
    // Any other not-found (a renamed or extra project) fails the job.
    expect(
        pattern.test(
            'Error: Project(s) "iphone" not found. Available projects: "chromium", "firefox", "webkit", "pixel", "iphone-15"',
        ),
    ).toBe(false);
    expect(
        pattern.test(
            'Error: Project(s) "firefox" not found. Available projects: "chromium", "chrome"',
        ),
    ).toBe(false);
    expect(
        pattern.test('Error: Project(s) "firefox" not found. Available projects: "chromium-old"'),
    ).toBe(false);
    expect(pattern.test('Error: No tests found')).toBe(false);
    expect(project.run).toContain('echo "available=false"');
    // Any other listing failure fails the job.
    expect(project.run).toMatch(/else\n\s*printf '%s\\n' "\$output" \| tail -20\n\s*exit 1\n/);
});

test('each profile job provisions and purges like the PR smoke: own run id first, purge always, artifacts after a verified purge', () => {
    expect(runSteps[0].id).toBe('run');
    expect(runSteps[0].run).toContain('fe-e2e-$(date +%s%3N)-$(openssl rand -hex 6)');
    const purge = runSteps.at(-1);
    expect(purge.name).toBe('Purge the run on staging');
    expect(purge.if).toBe(
        'always() && steps.run.outputs.id != \'\' && contains(fromJSON(\'["success","failure","cancelled"]\'), steps.e2e.outcome)',
    );
    expect(purge['timeout-minutes']).toBe(2);
    const marker = runSteps.find(step => step.id === 'purge-marker');
    expect(marker.if).toBe("failure() && steps.e2e.outcome == 'failure'");
    const report = runSteps.find(step => step.name === 'Upload Playwright report and traces');
    expect(report.if).toBe(
        "failure() && steps.purge-marker.outputs.verified == 'true' && steps.scan.outcome == 'success'",
    );
    expect(report.with).toMatchObject({ 'retention-days': 3, 'if-no-files-found': 'ignore' });
    const scan = runSteps.find(step => step.id === 'scan');
    expect(scan.env.VERCEL_BYPASS).toBe('${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}');
    // The bypass secret is a needle only when set: the PR smoke never passes it.
    expect(scan.run).toContain('if os.environ.get("VERCEL_BYPASS"):');
    // The small result file is the only artifact uploaded without the purge gate, and only by the matrix.
    const result = runSteps.find(step => step.name === 'Upload profile result');
    expect(result.if).toBe("always() && inputs.target == 'preview'");
    expect(result.with.name).toBe('e2e-result-${{ inputs.project }}');
    expect(result.with.path).toBe('${{ runner.temp }}/e2e-result/result.json');
    expect(result.with['retention-days']).toBe(3);
    // "Re-run failed jobs" replaces the earlier result of the same profile.
    expect(result.with.overwrite).toBe(true);
    const write = runSteps.find(step => step.name === 'Write profile result');
    expect(write.if).toBe("always() && inputs.target == 'preview'");
    expect(write.run).toContain('version: 1, profile: $profile, status: $status');
    expect(write.run).toContain('status=unsupported');
});

test('the Playwright projects are exactly the matrix profiles', async () => {
    const [{ default: config }, { MATRIX_PROFILES }] = await Promise.all([
        import('../../apps/app/playwright.config.ts'),
        import('./core.mjs'),
    ]);
    const ids = MATRIX_PROFILES.map(profile => profile.id);
    expect(config.projects.map(project => project.name)).toEqual(ids);
    expect(prepare.jobs.e2e.strategy.matrix.include.map(leg => leg.profile)).toEqual(ids);
    // The pre-matrix check lists exactly these projects.
    expect(prepare.jobs.e2e.with.all_projects.split(' ')).toEqual(ids);
    const byName = Object.fromEntries(config.projects.map(project => [project.name, project.use]));
    for (const phone of ['pixel', 'iphone']) {
        expect(byName[phone]).toMatchObject({ isMobile: true, hasTouch: true });
        expect(byName[phone].viewport.width).toBeLessThan(500);
    }
    expect(byName.iphone.defaultBrowserType).toBe('webkit');
    expect(byName.pixel.defaultBrowserType).toBe('chromium');
});
