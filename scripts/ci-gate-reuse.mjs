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
// The last one runs only when every gate step before it succeeded, so its success marks a passed gate.
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

const NEUTRAL_STEP_CONCLUSIONS = new Set([null, undefined, 'success', 'skipped']);

/**
 * Gate verdict of one finished frontend-ci job attempt.
 * - `pass`: the gate ran (or reused a passed gate) and every gate step succeeded.
 * - `fail`: a gate step failed, timed out or was cancelled, or the job is not finished.
 * - `none`: the gate never started (for example Issue admission failed first); says nothing.
 */
export function gateVerdict(job) {
    if (job.status !== 'completed') {
        return 'fail';
    }
    const steps = (job.steps ?? []).filter(step => GATE_STEPS.includes(step.name));
    const passed = steps.find(step => step.name === GATE_PASSED_STEP);

    if (passed?.conclusion === 'success') {
        return job.conclusion === 'success' ? 'pass' : 'fail';
    }
    if (steps.some(step => !NEUTRAL_STEP_CONCLUSIONS.has(step.conclusion))) {
        return 'fail';
    }
    return 'none';
}

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

    const newestFirst = [...others].sort((a, b) =>
        String(b.started_at ?? '').localeCompare(String(a.started_at ?? '')),
    );

    for (const job of newestFirst) {
        const verdict = gateVerdict(job);

        if (verdict === 'pass') {
            return {
                reuse: true,
                reason: `gate passed in run ${job.run_id} attempt ${job.run_attempt}`,
            };
        }
        if (verdict === 'fail') {
            return {
                reuse: false,
                reason: `newest gate on this SHA did not pass (run ${job.run_id} attempt ${job.run_attempt})`,
            };
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
    const jobs = [];

    for (const run of runs.workflow_runs ?? []) {
        // filter=all lists the jobs of every attempt, so a re-run attempt counts on its own.
        const page = await request(
            `/repos/${repository}/actions/runs/${run.id}/jobs?filter=all&per_page=100`,
            token,
        );
        jobs.push(...(page.jobs ?? []));
    }
    return jobs;
}

async function main() {
    const {
        GITHUB_REPOSITORY,
        GITHUB_RUN_ID,
        GITHUB_RUN_ATTEMPT,
        GITHUB_OUTPUT,
        GH_TOKEN,
        HEAD_SHA,
    } = process.env;
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
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    await main();
}
