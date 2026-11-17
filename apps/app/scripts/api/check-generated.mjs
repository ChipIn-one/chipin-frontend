// The offline half of `npm run api:check` (spec 03 §5.5), run after `api:gen`: the committed
// snapshot is normalized and the generated files match the commit, untracked files included.
//
// Usage: node scripts/api/check-generated.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { normalizeOpenApiYaml, SNAPSHOT_PATH } from './fetch-openapi.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');

export const GENERATED_PATHS = [
    'src/shared/api/generated',
    'src/shared/offline/modelHash.generated.ts',
];

const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

export const checkGenerated = () => {
    const errors = [];
    const snapshot = readFileSync(join(repoRoot, SNAPSHOT_PATH), 'utf8');

    if (normalizeOpenApiYaml(snapshot) !== snapshot) {
        errors.push(
            `${SNAPSHOT_PATH} is not normalized (sorted keys): write it with npm run api:fetch`,
        );
    }

    const status = git([
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        ...GENERATED_PATHS,
    ]);

    if (status !== '') {
        errors.push(
            `generated files differ from the commit; run npm run api:gen and commit:\n${status}` +
                git(['diff', '--stat', '--', ...GENERATED_PATHS]),
        );
    }
    return errors;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const errors = checkGenerated();

    for (const error of errors) {
        process.stderr.write(`api:check: ${error}\n`);
    }
    process.exitCode = errors.length === 0 ? 0 : 1;
}
