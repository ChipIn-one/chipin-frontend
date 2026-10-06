import fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const WORKFLOWS = new Set(['frontend-ci', 'main-ci']);
const BRANCHES = new Set(['dev', 'main']);

const isSafeDocumentationPath = path => {
    if (path === 'README.md') {
        return true;
    }

    if (!path.startsWith('docs/') || !path.endsWith('.md')) {
        return false;
    }

    if (path.startsWith('docs/codex/rules/')) {
        return false;
    }

    return path !== 'docs/dependabot-security-updates.md';
};

export const isDocsOnlyChange = changedFiles => changedFiles.length > 0
    && changedFiles.every(isSafeDocumentationPath);

export const resolveCiGateMode = ({ workflow, targetBranch, changedFiles }) => {
    if (!WORKFLOWS.has(workflow)) {
        throw new Error(`Unsupported CI workflow: ${workflow || 'missing'}`);
    }

    if (!BRANCHES.has(targetBranch)) {
        throw new Error(`Unsupported CI target branch: ${targetBranch || 'missing'}`);
    }

    if (workflow === 'frontend-ci' && targetBranch === 'main') {
        return 'compatibility';
    }

    if (workflow === 'main-ci' && targetBranch !== 'main') {
        throw new Error('main-ci may only validate main.');
    }

    return isDocsOnlyChange(changedFiles) ? 'docs-only' : 'full';
};

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isCli) {
    try {
        const input = fs.readFileSync(0);
        const changedFiles = input.length === 0
            ? []
            : input.toString('utf8').split('\0').filter(Boolean);
        const mode = resolveCiGateMode({
            workflow: process.env.CHIPIN_CI_WORKFLOW ?? '',
            targetBranch: process.env.CHIPIN_TARGET_BRANCH ?? '',
            changedFiles,
        });

        process.stdout.write(`${mode}\n`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
