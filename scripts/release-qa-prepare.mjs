import { pathToFileURL } from 'node:url';
import { GitHubApi, prepareReleaseQa } from './release-qa/runtime.mjs';

export function main(env = process.env) {
    const readApi = new GitHubApi(env.CHIPIN_DEV_READ_TOKEN);
    const writeApi = env.CHIPIN_ISSUE_WRITE_TOKEN ? new GitHubApi(env.CHIPIN_ISSUE_WRITE_TOKEN) : null;
    return prepareReleaseQa({ env, readApi, writeApi, sharedRoot: env.QA_SHARED_ROOT ?? '.qa-shared' });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(error => {
        process.stderr.write(`${error instanceof Error ? error.message : 'Release QA preparation failed.'}\n`);
        process.exitCode = 1;
    });
}
