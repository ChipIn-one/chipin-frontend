import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    collectGateJobs,
    decideGateReuse,
    GATE_STEPS,
    gateVerdict,
    main,
} from './ci-gate-reuse.mjs';

const SHA = 'a'.repeat(40);
const SELF = { runId: 900, runAttempt: 1 };

// Shaped like the jobs API: numbered steps, post steps that always run.
const numbered = list => list.map((step, index) => ({ ...step, number: index + 1 }));
const steps = (overrides = {}, gate = GATE_STEPS) =>
    numbered([
        { name: 'Set up job', conclusion: 'success' },
        { name: 'Checkout verified source SHA', conclusion: 'success' },
        { name: 'Setup Node', conclusion: 'success' },
        {
            name: 'Require canonical Issue admission for PR',
            conclusion: overrides.admission ?? 'success',
        },
        ...gate.map(name => ({ name, conclusion: overrides[name] ?? 'success' })),
        { name: 'Post Checkout verified source SHA', conclusion: 'success' },
        { name: 'Complete job', conclusion: 'success' },
    ]);
const job = ({
    runId,
    attempt = 1,
    startedAt,
    conclusion = 'success',
    status = 'completed',
    ...rest
}) => ({
    name: 'frontend-ci',
    head_sha: SHA,
    run_id: runId,
    run_attempt: attempt,
    started_at: startedAt,
    status,
    conclusion,
    steps: steps(),
    ...rest,
});
const passed = (runId, startedAt) => job({ runId, startedAt });
const gateFailed = (runId, startedAt) =>
    job({
        runId,
        startedAt,
        conclusion: 'failure',
        steps: steps({
            'Verify frontend': 'failure',
            'Verify site': 'skipped',
            'Record verification mode': 'skipped',
        }),
    });
const admissionFailed = (runId, startedAt) =>
    job({
        runId,
        startedAt,
        conclusion: 'failure',
        steps: steps({
            admission: 'failure',
            ...Object.fromEntries(GATE_STEPS.map(name => [name, 'skipped'])),
        }),
    });
const self = job({
    runId: SELF.runId,
    startedAt: '2026-11-20T12:00:00Z',
    status: 'in_progress',
    conclusion: null,
});

describe('gateVerdict', () => {
    test('a passed gate needs the pass marker and a successful job', () => {
        expect(gateVerdict(passed(1, 't'))).toBe('pass');
        expect(gateVerdict(job({ runId: 1, conclusion: 'failure' }))).toBe('fail');
    });

    test('a failed, timed-out or cancelled gate step is a failed gate', () => {
        expect(gateVerdict(gateFailed(1, 't'))).toBe('fail');
        for (const conclusion of ['cancelled', 'timed_out', 'action_required']) {
            expect(
                gateVerdict(
                    job({
                        runId: 1,
                        conclusion: 'cancelled',
                        steps: steps({
                            'Install dependencies': conclusion,
                            'Record verification mode': 'skipped',
                        }),
                    }),
                ),
                conclusion,
            ).toBe('fail');
        }
    });

    test('a gate that never started says nothing', () => {
        expect(gateVerdict(admissionFailed(1, 't'))).toBe('none');
        expect(gateVerdict(job({ runId: 1, conclusion: 'cancelled', steps: [] }))).toBe('none');
    });

    test('a stopped step this file does not know is a failed gate, never "none"', () => {
        // An earlier run used a workflow with a gate step that is not in GATE_STEPS.
        const unknown = job({
            runId: 1,
            conclusion: 'failure',
            steps: steps({ 'Verify e2e': 'failure', 'Record verification mode': 'skipped' }, [
                ...GATE_STEPS.slice(0, -1),
                'Verify e2e',
                'Record verification mode',
            ]),
        });

        expect(gateVerdict(unknown)).toBe('fail');
    });

    test('a cancelled job with every step green is not a pass', () => {
        expect(gateVerdict(job({ runId: 1, conclusion: 'cancelled' }))).toBe('fail');
    });

    test('an unfinished job is never a pass', () => {
        expect(gateVerdict(job({ runId: 1, status: 'in_progress', conclusion: null }))).toBe(
            'fail',
        );
    });
});

describe('decideGateReuse', () => {
    const decide = jobs => decideGateReuse({ jobs: [self, ...jobs], headSha: SHA, self: SELF });

    test('reuses the newest gate when it passed', () => {
        expect(decide([passed(1, '2026-11-20T10:00:00Z')]).reuse).toBe(true);
    });

    test('never masks a newer failed gate with an older pass', () => {
        expect(
            decide([passed(1, '2026-11-20T10:00:00Z'), gateFailed(2, '2026-11-20T11:00:00Z')])
                .reuse,
        ).toBe(false);
    });

    test('a newer failure in a step this file does not know blocks an older pass', () => {
        const unknown = job({
            runId: 2,
            startedAt: '2026-11-20T11:00:00Z',
            conclusion: 'failure',
            steps: steps({ 'Verify e2e': 'failure', 'Record verification mode': 'skipped' }, [
                ...GATE_STEPS.slice(0, -1),
                'Verify e2e',
                'Record verification mode',
            ]),
        });

        expect(decide([passed(1, '2026-11-20T10:00:00Z'), unknown]).reuse).toBe(false);
    });

    test('on equal start times the later run decides', () => {
        const at = '2026-11-20T10:00:00Z';

        expect(decide([gateFailed(2, at), passed(1, at)]).reuse).toBe(false);
        expect(decide([passed(1, at), gateFailed(2, at)]).reuse).toBe(false);
        expect(decide([gateFailed(1, at), passed(2, at)]).reuse).toBe(true);
    });

    test('a re-run attempt that passed after a failure counts as the newest gate', () => {
        expect(
            decide([
                gateFailed(1, '2026-11-20T10:00:00Z'),
                job({ runId: 1, attempt: 2, startedAt: '2026-11-20T11:00:00Z' }),
            ]).reuse,
        ).toBe(true);
    });

    test('skips runs whose gate never started, such as a rejected PR body', () => {
        expect(
            decide([passed(1, '2026-11-20T10:00:00Z'), admissionFailed(2, '2026-11-20T11:00:00Z')])
                .reuse,
        ).toBe(true);
        expect(decide([admissionFailed(2, '2026-11-20T11:00:00Z')]).reuse).toBe(false);
    });

    test('runs the gate when there is no earlier run or another run is not finished', () => {
        expect(decide([]).reuse).toBe(false);
        expect(
            decide([
                passed(1, '2026-11-20T10:00:00Z'),
                job({
                    runId: 2,
                    startedAt: '2026-11-20T11:00:00Z',
                    status: 'queued',
                    conclusion: null,
                }),
            ]).reuse,
        ).toBe(false);
    });

    test('ignores other SHAs, other job names and its own job', () => {
        expect(
            decide([
                { ...passed(1, '2026-11-20T10:00:00Z'), head_sha: 'b'.repeat(40) },
                {
                    ...passed(2, '2026-11-20T10:00:00Z'),
                    name: 'Notify #chipin-ci on master failure',
                },
            ]).reuse,
        ).toBe(false);
        expect(
            decideGateReuse({
                jobs: [{ ...passed(SELF.runId, '2026-11-20T10:00:00Z') }],
                headSha: SHA,
                self: SELF,
            }).reuse,
        ).toBe(false);
    });
});

describe('collectGateJobs', () => {
    test('reads the PR runs of this workflow on the SHA and every attempt of their jobs', async () => {
        const calls = [];
        const request = async path => {
            calls.push(path);
            if (path.endsWith('/actions/runs/900')) {
                return { workflow_id: 77 };
            }
            if (path.includes('/actions/workflows/77/runs')) {
                return { workflow_runs: [{ id: 1 }, { id: 2 }] };
            }
            return { jobs: [{ run_id: Number(path.split('/')[6]) }] };
        };

        const jobs = await collectGateJobs({
            repository: 'ChipIn-one/chipin-frontend',
            runId: '900',
            headSha: SHA,
            token: 't',
            request,
        });

        expect(jobs).toEqual([{ run_id: 1 }, { run_id: 2 }]);
        expect(calls).toEqual([
            '/repos/ChipIn-one/chipin-frontend/actions/runs/900',
            `/repos/ChipIn-one/chipin-frontend/actions/workflows/77/runs?event=pull_request&head_sha=${SHA}&per_page=100`,
            '/repos/ChipIn-one/chipin-frontend/actions/runs/1/jobs?filter=all&per_page=100',
            '/repos/ChipIn-one/chipin-frontend/actions/runs/2/jobs?filter=all&per_page=100',
        ]);
    });
});

describe('collectGateJobs paging', () => {
    test('fails (so the full gate runs) when a list has more than one page', async () => {
        const runsOverflow = async path =>
            path.endsWith('/runs/900')
                ? { workflow_id: 77 }
                : { total_count: 101, workflow_runs: [{ id: 1 }] };
        const jobsOverflow = async path => {
            if (path.endsWith('/runs/900')) {
                return { workflow_id: 77 };
            }
            if (path.includes('/workflows/77/runs')) {
                return { total_count: 1, workflow_runs: [{ id: 1 }] };
            }
            return { total_count: 101, jobs: [{}] };
        };
        const args = { repository: 'o/r', runId: '900', headSha: SHA, token: 't' };

        await expect(collectGateJobs({ ...args, request: runsOverflow })).rejects.toThrow(
            'more than one page',
        );
        await expect(collectGateJobs({ ...args, request: jobsOverflow })).rejects.toThrow(
            'more than one page',
        );
    });
});

describe('main', () => {
    const run = async (env, request) => {
        const output = join(mkdtempSync(join(tmpdir(), 'gate-reuse-')), 'out');
        const decision = await main(
            {
                GITHUB_REPOSITORY: 'o/r',
                GITHUB_RUN_ID: '900',
                GITHUB_RUN_ATTEMPT: '1',
                GITHUB_OUTPUT: output,
                GH_TOKEN: 't',
                HEAD_SHA: SHA,
                ...env,
            },
            request,
        );

        return { decision, output: readFileSync(output, 'utf8') };
    };
    const api = jobs => async path => {
        if (path.endsWith('/runs/900')) {
            return { workflow_id: 77 };
        }
        if (path.includes('/workflows/77/runs')) {
            return { total_count: 1, workflow_runs: [{ id: 1 }] };
        }
        return { total_count: jobs.length, jobs };
    };

    test('writes reuse=true when the newest gate on the SHA passed', async () => {
        const result = await run({}, api([self, passed(1, '2026-11-20T10:00:00Z')]));

        expect(result.decision.reuse).toBe(true);
        expect(result.output).toBe('reuse=true\n');
    });

    test('writes reuse=false on an API error or an invalid SHA', async () => {
        const failing = async () => {
            throw new Error('HTTP 500');
        };

        expect((await run({}, failing)).output).toBe('reuse=false\n');
        expect((await run({ HEAD_SHA: 'main' }, api([passed(1, 't')]))).output).toBe(
            'reuse=false\n',
        );
    });
});
