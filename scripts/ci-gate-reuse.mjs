#!/usr/bin/env node
// Decides whether a frontend-ci run for a pull_request `edited` or `ready_for_review` event may skip
// the heavy gate (chipin-frontend#792). Those events do not change the head SHA, so the gate result
// of an earlier run on the same SHA still holds. The run only reuses it when the newest earlier gate
// on that SHA passed: a failed, cancelled or still running gate is never masked, it runs again.
// Any API error falls back to running the full gate.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const GATE_JOB_NAME = 'frontend-ci';

// Steps of the frontend-ci job that belong to the gate, in workflow order (after Issue admission).
// The last one runs only when every step before it succeeded, so its success marks a passed gate.
// scripts/ci-gate-policy.test.mjs pins this list against .github/workflows/frontend-ci.yml.
export const GATE_STEPS = Object.freeze([
    'Resolve gate reuse',
    'Resolve verification mode',
    'Install dependencies',
    'Check lint baseline does not grow',
    'Check file layout baseline does not grow',
    'Check generated API types',
    'Verify frontend',
    'Verify site',
    'Record verification mode',
]);
export const GATE_PASSED_STEP = GATE_STEPS.at(-1);

// Steps that run before the gate. Only a stop here means the gate never started. The verdict does
// not rely on the gate step names: an earlier run may have used a workflow with gate steps this list
// does not know, and an unknown stopped step must count as a failed gate, never as "none".
export const PRE_GATE_STEPS = Object.freeze([
    'Set up job',
    'Checkout verified source SHA',
    'Setup Node',
    'Require canonical Issue admission for PR',
]);

const STOPPED = new Set(['failure', 'cancelled', 'timed_out', 'action_required', 'stale']);

/**
 * Gate verdict of one frontend-ci job attempt.
 * - `pass`: the pass marker succeeded and the whole job succeeded.
 * - `none`: the gate never started: no step ran, or the first stopped step is a pre-gate step
 *   (for example Issue admission rejected the PR body). Says nothing about the gate.
 * - `fail`: anything else, including an unfinished job or a stopped step this file does not know.
 */
export function gateVerdict(job) {
    if (job.status !== 'completed') {
        return 'fail';
    }
    const steps = [...(job.steps ?? [])].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    const passed = steps.find(step => step.name === GATE_PASSED_STEP);

    if (passed?.conclusion === 'success' && job.conclusion === 'success') {
        return 'pass';
    }
    if (steps.length === 0) {
        return 'none';
    }
    const firstStopped = steps.find(step => STOPPED.has(step.conclusion));

    return firstStopped && PRE_GATE_STEPS.includes(firstStopped.name) ? 'none' : 'fail';
}

// Newest first; on equal start times the later run and attempt come first.
const newestFirst = (a, b) =>
    String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')) ||
    (b.run_id ?? 0) - (a.run_id ?? 0) ||
    (b.run_attempt ?? 0) - (a.run_attempt ?? 0);

/**
 * Picks the decision from every frontend-ci job attempt of this workflow on the head SHA.
 * `self` is the current run ({ runId, runAttempt }); its own job is ignored.
 */
export function decideGateReuse({ jobs, headSha, self }) {
    const others = jobs.filter(
        job =>
            job.name === GATE_JOB_NAME &&
            job.head_sha === headSha &&
            !(job.run_id === self.runId && job.run_attempt === self.runAttempt),
    );

    if (others.some(job => job.status !== 'completed')) {
        return { reuse: false, reason: 'another frontend-ci run on this SHA is not finished' };
    }

    for (const job of [...others].sort(newestFirst)) {
        const verdict = gateVerdict(job);
        const where = `run ${job.run_id} attempt ${job.run_attempt}`;

        if (verdict === 'pass') {
            return { reuse: true, reason: `gate passed in ${where}` };
        }
        if (verdict === 'fail') {
            return { reuse: false, reason: `newest gate on this SHA did not pass (${where})` };
        }
    }
    return { reuse: false, reason: 'no earlier gate ran on this SHA' };
}

async function github(path, token) {
    const response = await fetch(
        `${process.env.GITHUB_API_URL ?? 'https://api.github.com'}${path}`,
        {
            headers: {
                accept: 'application/vnd.github+json',
                authorization: `Bearer ${token}`,
                'x-github-api-version': '2022-11-28',
            },
            // A hung request must not eat the job timeout that the full gate needs.
            signal: AbortSignal.timeout(15_000),
        },
    );

    if (!response.ok) {
        throw new Error(`GET ${path}: HTTP ${response.status}`);
    }
    return response.json();
}

export async function collectGateJobs({ repository, runId, headSha, token, request = github }) {
    const current = await request(`/repos/${repository}/actions/runs/${runId}`, token);
    const runs = await request(
        `/repos/${repository}/actions/workflows/${current.workflow_id}/runs?event=pull_request&head_sha=${headSha}&per_page=100`,
        token,
    );
    const workflowRuns = runs.workflow_runs ?? [];
    const jobs = [];

    if ((runs.total_count ?? workflowRuns.length) > workflowRuns.length) {
        throw new Error('more than one page of runs on this SHA');
    }
    for (const run of workflowRuns) {
        // filter=all lists the jobs of every attempt (oldest first), so a re-run attempt counts.
        const page = await request(
            `/repos/${repository}/actions/runs/${run.id}/jobs?filter=all&per_page=100`,
            token,
        );
        const runJobs = page.jobs ?? [];

        if ((page.total_count ?? runJobs.length) > runJobs.length) {
            throw new Error(`more than one page of jobs in run ${run.id}`);
        }
        jobs.push(...runJobs);
    }
    return jobs;
}

export async function main(env = process.env, request = github) {
    const {
        GITHUB_REPOSITORY,
        GITHUB_RUN_ID,
        GITHUB_RUN_ATTEMPT,
        GITHUB_OUTPUT,
        GH_TOKEN,
        HEAD_SHA,
    } = env;
    let decision;

    try {
        if (!/^[0-9a-f]{40}$/u.test(HEAD_SHA ?? '')) {
            throw new Error(`invalid HEAD_SHA: ${HEAD_SHA}`);
        }
        const jobs = await collectGateJobs({
            repository: GITHUB_REPOSITORY,
            runId: GITHUB_RUN_ID,
            headSha: HEAD_SHA,
            token: GH_TOKEN,
            request,
        });

        decision = decideGateReuse({
            jobs,
            headSha: HEAD_SHA,
            self: { runId: Number(GITHUB_RUN_ID), runAttempt: Number(GITHUB_RUN_ATTEMPT) },
        });
    } catch (error) {
        console.log(`::warning::gate reuse lookup failed, running the full gate: ${error.message}`);
        decision = { reuse: false, reason: 'lookup failed' };
    }

    console.log(`${decision.reuse ? 'Reusing' : 'Not reusing'} the gate: ${decision.reason}.`);
    if (GITHUB_OUTPUT) {
        appendFileSync(GITHUB_OUTPUT, `reuse=${decision.reuse}\n`);
    }
    return decision;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    await main();
}
