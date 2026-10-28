import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, test } from 'vitest';

const prepare = parse(readFileSync('.github/workflows/prepare-release-qa.yml', 'utf8'));
const result = parse(readFileSync('.github/workflows/release-qa-result.yml', 'utf8'));

test('candidate preparation can only start manually from owner-controlled master code', () => {
    expect(Object.keys(prepare.on)).toEqual(['workflow_dispatch']);
    expect(prepare.jobs.prepare.if).toContain("github.actor == 'syllik'");
    expect(prepare.jobs.prepare.if).toContain("github.ref == 'refs/heads/master'");
    const checkouts = prepare.jobs.prepare.steps.filter(step => step.uses?.startsWith('actions/checkout@'));
    expect(checkouts).toHaveLength(2);
    expect(checkouts[0].with.ref).toBe('${{ github.sha }}');
    expect(checkouts[1].with).toMatchObject({ repository: 'ChipIn-one/.github', ref: '7dbcfb2b72fca2d477c14f4d242261d72a103dbd', 'persist-credentials': false });
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
    expect(inputs.priority).toMatchObject({ type: 'choice', default: 'P2', options: ['P0', 'P1', 'P2', 'P3'] });
    expect(inputs.qa_login.default).toBe('SoRawSteak');
    expect(inputs.reassign_qa).toMatchObject({ type: 'boolean', default: false });
    expect(prepare['run-name']).toBe("QA prepare ${{ inputs.candidate_sha || 'auto' }}");
    expect(prepare.concurrency.group).not.toContain('inputs.');
});

test('result reader posts to Slack only through env and never interpolates comment text into shell', () => {
    const steps = result.jobs['read-result'].steps;
    const validate = steps.find(step => step.run?.includes('release-qa-result.mjs'));
    expect(validate.env).toMatchObject({ SLACK_WEBHOOK_CI: '${{ secrets.SLACK_WEBHOOK_CI }}', SLACK_USER_MAP: '${{ vars.SLACK_USER_MAP }}' });
    for (const step of steps) expect(step.run ?? '').not.toContain('${{');
    expect(JSON.stringify(result)).not.toContain('github.event.comment.body');
});
