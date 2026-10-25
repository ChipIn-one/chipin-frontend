import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GitHubApi, validateResultEvent } from './release-qa/runtime.mjs';

export function main(env = process.env) {
    if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH is required.');
    return readFile(env.GITHUB_EVENT_PATH, 'utf8').then(JSON.parse).then(event => validateResultEvent({
        event, api: new GitHubApi(env.GITHUB_TOKEN),
    }));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(error => {
        process.stderr.write(`${error instanceof Error ? error.message : 'QA result validation failed.'}\n`);
        process.exitCode = 1;
    });
}
