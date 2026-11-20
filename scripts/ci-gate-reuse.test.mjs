import { describe, expect, test } from 'vitest';

import { collectGateJobs, decideGateReuse, GATE_STEPS, gateVerdict } from './ci-gate-reuse.mjs';

const SHA = 'a'.repeat(40);
const SELF = { runId: 900, runAttempt: 1 };

const steps = (overrides = {}) => [
    { name: 'Checkout verified source SHA', conclusion: 'success' },
    { name: 'Require canonical Issue admission for PR', conclusion: 'success' },
    ...GATE_STEPS.map(name => ({ name, conclusion: overrides[name] ?? 'success' })),
];
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
        steps: [
            { name: 'Checkout verified source SHA', conclusion: 'success' },
            { name: 'Require canonical Issue admission for PR', conclusion: 'failure' },
            ...GATE_STEPS.map(name => ({ name, conclusion: 'skipped' })),
        ],
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
