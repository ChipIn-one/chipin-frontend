import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GitHubApi, readResultAndNotify } from './release-qa/runtime.mjs';

export function main(env = process.env) {
    if (!env.GITHUB_EVENT_PATH) return Promise.reject(new Error('GITHUB_EVENT_PATH is required.'));
    return readFile(env.GITHUB_EVENT_PATH, 'utf8').then(JSON.parse).then(event => readResultAndNotify({
        event, api: new GitHubApi(env.GITHUB_TOKEN), env,
    }));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().then(result => {
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (result.slack && !result.slack.delivered) process.stdout.write(`::warning::${result.slack.reason}\n`);
    }).catch(error => {
        process.stderr.write(`${error instanceof Error ? error.message : 'QA result validation failed.'}\n`);
        process.exitCode = 1;
    });
}
