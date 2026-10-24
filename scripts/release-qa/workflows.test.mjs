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
