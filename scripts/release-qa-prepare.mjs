import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GitHubApi, prepareReleaseQa, emitResult } from './release-qa/runtime.mjs';

export function main(env = process.env) {
    const readApi = new GitHubApi(env.CHIPIN_DEV_READ_TOKEN);
    const writeApi = env.CHIPIN_ISSUE_WRITE_TOKEN
        ? new GitHubApi(env.CHIPIN_ISSUE_WRITE_TOKEN)
        : null;
    return prepareReleaseQa({
        env,
        readApi,
        writeApi,
        sharedRoot: env.QA_SHARED_ROOT ?? '.qa-shared',
    });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    Promise.resolve()
        .then(() => main())
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
                `${error instanceof Error ? error.message : 'Release QA preparation failed.'}\n`,
            );
            process.exitCode = 1;
        });
}
