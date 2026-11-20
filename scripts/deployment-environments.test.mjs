import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, test } from 'vitest';

import { readHint } from './forward-production-deployment.mjs';
import {
    APP_ENVIRONMENTS,
    appEnvironmentCondition,
    appEnvironmentNames,
    isAppEnvironment,
} from './deployment-environments.mjs';

// chipin-frontend#801. Environment names as Vercel writes them (U+2013 EN DASH between spaces).
const APP_PRODUCTION = 'Production – chipin-frontend';
const APP_PREVIEW = 'Preview – chipin-frontend';
const SITE_PRODUCTION = 'Production – chipin-site';
const SITE_PREVIEW = 'Preview – chipin-site';

const WORKFLOWS = '.github/workflows';
const workflowFiles = readdirSync(WORKFLOWS).filter(name => /\.ya?ml$/u.test(name));
const readWorkflow = name => readFileSync(join(WORKFLOWS, name), 'utf8');

// A `deployment_status` payload as GitHub delivers it for a Vercel deployment.
const payload = environment => ({
    deployment: {
        id: 7946283729,
        sha: '0a99625a'.padEnd(40, '0'),
        environment,
        creator: { login: 'vercel[bot]' },
    },
    deployment_status: {
        state: 'success',
        environment,
        creator: { login: 'vercel[bot]' },
    },
});

// Dry run of the workflow condition: GitHub evaluates `contains(fromJSON('<array>'), value)` as array membership with
// case-insensitive string comparison. The array is read from the workflow text itself, so this checks what runs.
const CONDITION = /contains\(fromJSON\('(\[[^']*\])'\), github\.event\.deployment\.environment\)/gu;
const evaluateConditions = (text, event) => {
    const matches = [...text.matchAll(CONDITION)];
    expect(matches.length).toBeGreaterThan(0);
    return matches.map(([, array]) =>
        JSON.parse(array).some(
            name => name.toLowerCase() === String(event.deployment.environment).toLowerCase(),
        ),
    );
};

describe('app environment names', () => {
    test('are the unsuffixed and the chipin-frontend-suffixed names', () => {
        expect(APP_ENVIRONMENTS).toEqual({
            Production: ['Production', APP_PRODUCTION],
            Preview: ['Preview', APP_PREVIEW],
        });
        expect(Object.isFrozen(APP_ENVIRONMENTS.Production)).toBe(true);
        expect(appEnvironmentNames('Production')).toBe(APP_ENVIRONMENTS.Production);
        expect(() => appEnvironmentNames('production')).toThrow(/Unknown deployment kind/u);
        expect(() => appEnvironmentNames('toString')).toThrow(/Unknown deployment kind/u);
    });

    test.each([
        ['Production', 'Production', true],
        ['Production', APP_PRODUCTION, true],
        ['Production', SITE_PRODUCTION, false],
        ['Production', 'Preview', false],
        ['Production', APP_PREVIEW, false],
        ['Production', 'production', false],
        ['Production', 'Production - chipin-frontend', false],
        ['Production', 'Production – chipin-frontend-x', false],
        ['Production', undefined, false],
        ['Preview', 'Preview', true],
        ['Preview', APP_PREVIEW, true],
        ['Preview', SITE_PREVIEW, false],
        ['Preview', APP_PRODUCTION, false],
    ])('%s matches %j: %s', (kind, environment, expected) => {
        expect(isAppEnvironment(kind, environment)).toBe(expected);
    });

    test('the workflow condition embeds the list as JSON', () => {
        expect(appEnvironmentCondition('Production')).toBe(
            `contains(fromJSON('["Production","${APP_PRODUCTION}"]'), github.event.deployment.environment)`,
        );
    });
});

describe('workflows filter the deployment environment only through the shared list', () => {
    test.each(workflowFiles)('%s has no hand-written environment comparison', name => {
        const text = readWorkflow(name);
        // Every reference to the environment is the shared condition: no `==`, `contains(<env>, …)`,
        // `startsWith(…)` or other hand-written test, and no `deployment_status.environment`.
        const references = text.match(/deployment(_status)?\.environment\b/gu) ?? [];
        const conditions = [...text.matchAll(CONDITION)];
        expect(references).toHaveLength(conditions.length);
        for (const [, array] of conditions) {
            const names = JSON.parse(array);
            expect([APP_ENVIRONMENTS.Production, APP_ENVIRONMENTS.Preview]).toContainEqual(names);
        }
    });

    test('the Production workflows use the shared Production condition', () => {
        const production = workflowFiles.filter(name =>
            readWorkflow(name).includes('github.event.deployment.environment'),
        );
        expect(production.sort()).toEqual([
            'forward-production-deployment.yml',
            'release-on-production.yml',
        ]);
        for (const name of production) {
            const workflow = parse(readWorkflow(name));
            for (const job of Object.values(workflow.jobs)) {
                if (typeof job.if === 'string' && job.if.includes('deployment.environment'))
                    expect(job.if).toContain(appEnvironmentCondition('Production'));
            }
        }
    });
});

describe('dry run on deployment_status payloads', () => {
    const cases = [
        ['Production', true],
        [APP_PRODUCTION, true],
        [SITE_PRODUCTION, false],
        ['Preview', false],
        [APP_PREVIEW, false],
        [SITE_PREVIEW, false],
    ];

    test.each(cases)('%s → release and forward run: %s', (environment, expected) => {
        const event = payload(environment);
        const release = parse(readWorkflow('release-on-production.yml'));
        const forward = parse(readWorkflow('forward-production-deployment.yml'));
        expect(evaluateConditions(release.jobs.guard.if, event)).toEqual([expected]);
        expect(evaluateConditions(release.concurrency.group, event)).toEqual([expected]);
        expect(evaluateConditions(forward.jobs.forward.if, event)).toEqual([expected]);
        expect(readHint(event) !== null).toBe(expected);
    });
});
