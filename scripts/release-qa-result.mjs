import { appendFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { GitHubApi, readResultAndNotify, emitResult } from './release-qa/runtime.mjs';

export function main(env = process.env) {
    if (!env.GITHUB_EVENT_PATH) return Promise.reject(new Error('GITHUB_EVENT_PATH is required.'));
    return readFile(env.GITHUB_EVENT_PATH, 'utf8')
        .then(JSON.parse)
        .then(event =>
            readResultAndNotify({
                event,
                api: new GitHubApi(env.GITHUB_TOKEN),
                env,
            }),
        );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main()
        .then(result => {
            // Masks the Slack user IDs, then prints the redacted result; the next workflow step posts
            // `slack_text` with the shared Slack action.
            const outputPath = process.env.GITHUB_OUTPUT;
            emitResult(result, {
                write: text => process.stdout.write(text),
                output: outputPath ? text => appendFileSync(outputPath, text) : null,
            });
        })
        .catch(error => {
            process.stderr.write(
                `${error instanceof Error ? error.message : 'QA result validation failed.'}\n`,
            );
            process.exitCode = 1;
        });
}
