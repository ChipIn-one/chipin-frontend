import process from 'node:process';
import { pathToFileURL } from 'node:url';

const WORKFLOWS = new Set(['frontend-ci']);
const BRANCHES = new Set(['master']);

const isSafeDocumentationPath = path => {
    if (path === 'README.md') {
        return true;
    }

    if (!path.startsWith('docs/') || !path.endsWith('.md')) {
        return false;
    }

    // Rules feed the ESLint layer table; the specs feed scripts/check-rule-registry.test.mjs
    // (02-rulebook-tooling.md §D0). Both are gate inputs, not prose.
    if (path.startsWith('docs/engineering/rules/') || path.startsWith('docs/superpowers/specs/')) {
        return false;
    }

    return path !== 'docs/dependabot-security-updates.md';
};

export const isDocsOnlyChange = changedFiles =>
    changedFiles.length > 0 && changedFiles.every(isSafeDocumentationPath);

// Workspace scopes (spec 04 §1.4). The trailing slash keeps lookalikes (`apps/application/`) out.
const WORKSPACE_PREFIXES = [
    ['app', 'apps/app/'],
    ['site', 'apps/site/'],
];

// 'docs' | 'app' | 'site' | 'full'. Anything not classified (packages/**, the lockfile, root
// configs, config/**, scripts/**, .github/**, unknown paths) is 'full': fail safe.
const classifyPath = path => {
    if (isSafeDocumentationPath(path)) {
        return 'docs';
    }

    for (const [scope, prefix] of WORKSPACE_PREFIXES) {
        if (path.startsWith(prefix)) {
            return scope;
        }
    }

    return 'full';
};

// docs-only | app | site | full. An empty list fails closed (full). Safe docs mixed into a
// workspace change do not widen it; app + site together, or any repo-level path, give full.
export const resolveChangeScope = changedFiles => {
    if (changedFiles.length === 0) {
        return 'full';
    }

    const scopes = new Set(changedFiles.map(classifyPath));

    scopes.delete('docs');
    if (scopes.size === 0) {
        return 'docs-only';
    }

    return scopes.size === 1 ? [...scopes][0] : 'full';
};

export const resolveCiGateMode = ({ workflow, targetBranch, changedFiles }) => {
    if (!WORKFLOWS.has(workflow)) {
        throw new Error(`Unsupported CI workflow: ${workflow || 'missing'}`);
    }

    if (!BRANCHES.has(targetBranch)) {
        throw new Error(`Unsupported CI target branch: ${targetBranch || 'missing'}`);
    }

    return resolveChangeScope(changedFiles);
};

const isCli = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

// stdin as a stream: `fs.readFileSync(0)` throws EAGAIN on a non-blocking pipe whose writer
// (`git diff ... |` in frontend-ci.yml) has not finished yet.
const readStdin = async () => {
    const chunks = [];

    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

if (isCli) {
    try {
        const input = await readStdin();
        const changedFiles =
            input.length === 0 ? [] : input.toString('utf8').split('\0').filter(Boolean);
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
