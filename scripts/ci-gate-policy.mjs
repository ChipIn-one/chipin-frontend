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

    if (path.startsWith('docs/engineering/rules/')) {
        return false;
    }

    return path !== 'docs/dependabot-security-updates.md';
};

export const isDocsOnlyChange = changedFiles =>
    changedFiles.length > 0 && changedFiles.every(isSafeDocumentationPath);

export const resolveCiGateMode = ({ workflow, targetBranch, changedFiles }) => {
    if (!WORKFLOWS.has(workflow)) {
        throw new Error(`Unsupported CI workflow: ${workflow || 'missing'}`);
    }

    if (!BRANCHES.has(targetBranch)) {
        throw new Error(`Unsupported CI target branch: ${targetBranch || 'missing'}`);
    }

    return isDocsOnlyChange(changedFiles) ? 'docs-only' : 'full';
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
