// Pre-commit ESLint step (spec 02 §D0, §D7): lint-staged passes the staged files, ESLint fixes what
// it can (FAST mode comes from .husky/pre-commit), and the remaining errors are printed only as a
// hint. Always exits with 0: the commit is never blocked; CI (`verify:full`) is the only gate.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const files = process.argv.slice(2);
const eslintBin = resolve(import.meta.dirname, '../node_modules/eslint/bin/eslint.js');

if (files.length > 0) {
    // The CLI (not the Node API) so eslint-suppressions.json applies and baseline entries stay quiet.
    const { status, error } = spawnSync(
        process.execPath,
        // FAST mode leaves the type-aware suppressions unused: they must not fail the run.
        [
            eslintBin,
            '--fix',
            '--no-warn-ignored',
            '--pass-on-unpruned-suppressions',
            '--',
            ...files,
        ],
        { stdio: 'inherit' },
    );

    if (error || status === 2) {
        console.warn(
            '\neslint-fix-staged: ESLint crashed or the config is broken; CI will fail — see the output above. ' +
                'The commit is not blocked.',
        );
    } else if (status !== 0) {
        console.warn(
            '\neslint-fix-staged: the errors above are not auto-fixable. The commit is not blocked; ' +
                'fix them before the PR (CI runs `npm run verify:full`).',
        );
    }
}
process.exit(0);
