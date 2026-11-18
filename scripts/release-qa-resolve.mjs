import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GitHubApi, formatResolveOutputs, resolveReleaseCandidate } from './release-qa/runtime.mjs';

// The `resolve` job of prepare-release-qa.yml: picks the candidate and its immutable Preview with
// the workflow's read-only GITHUB_TOKEN and writes them as job outputs for the e2e matrix and
// `prepare`.
export function main(env = process.env) {
    if (!env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.');
    return resolveReleaseCandidate({ env, api: new GitHubApi(env.GITHUB_TOKEN) }).then(resolved =>
        appendFile(env.GITHUB_OUTPUT, formatResolveOutputs(resolved)).then(() => resolved),
    );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    Promise.resolve()
        .then(() => main())
        .then(resolved => {
            process.stdout.write(`${JSON.stringify(resolved)}\n`);
        })
        .catch(error => {
            process.stderr.write(
                `${error instanceof Error ? error.message : 'Release candidate resolution failed.'}\n`,
            );
            process.exitCode = 1;
        });
}
