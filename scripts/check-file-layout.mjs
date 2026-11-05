// File layout checks that are not import rules (spec 02 §D0, 02-C12):
// - `index-depth`: an `index.ts` may exist only at a slice root, `src/<layer>/<slice>/index.ts`,
//   where the slice is not an `internal/` or `components/` folder (10.Recursive); an `index.tsx`
//   is never allowed (no slice root has one) (D11: one barrel per slice, no nested barrels; D27:
//   this is where an index may exist, not how it is imported);
// - `use-connect`: no `useConnect.ts(x)` files, in any letter case (D12: a selector with useShallow).
// The existing files are listed in config/file-layout-baseline.json. The baseline only shrinks:
// a listed file that is gone or allowed now must be removed from it, and with --base <sha> a path
// that is not in the baseline at that commit fails (the base file missing = the check is new).
//
// Usage: node scripts/check-file-layout.mjs [--base <sha>]
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '..');

export const BASELINE_PATH = 'config/file-layout-baseline.json';
export const SOURCE_DIR = 'src';
// Folders that hold a slice's private files, never a slice of their own (10.Recursive).
const NOT_A_SLICE = new Set(['internal', 'components']);

export const CHECKS = {
    'index-depth': {
        matches: path => /\/index\.tsx?$/.test(path),
        // `src/<layer>/<slice>/index.ts`: exactly four path segments, a real slice folder.
        allowed: path => {
            const segments = path.split('/');

            return (
                segments.length === 4 && segments[3] === 'index.ts' && !NOT_A_SLICE.has(segments[2])
            );
        },
        message:
            'an index.ts is allowed only at a slice root, src/<layer>/<slice>/index.ts (D11); import the file directly',
    },
    'use-connect': {
        matches: path => /\/useconnect\.tsx?$/i.test(path),
        allowed: () => false,
        message:
            'no new useConnect.ts (D12): read the store in the component, `useXStore(useShallow(state => ({ ... })))`',
    },
};

/** Repository-relative POSIX paths of every file under `dir`. */
export const listFiles = (root, dir = SOURCE_DIR) => {
    const absolute = join(root, dir);

    if (!existsSync(absolute)) {
        return [];
    }

    return readdirSync(absolute, { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .sort();
};

/** `{ <check>: [paths] }` of the files that break each check. */
export const findViolations = files =>
    Object.fromEntries(
        Object.entries(CHECKS).map(([name, { matches, allowed }]) => [
            name,
            files.filter(path => matches(path) && !allowed(path)),
        ]),
    );

/**
 * @param {{ files: string[], baseline: Record<string, string[]>, baseBaseline?: Record<string, string[]> }} input
 *   `baseBaseline`: the baseline at the base commit, undefined when the file did not exist there.
 * @returns {string[]} errors
 */
export const checkFileLayout = ({ files, baseline, baseBaseline }) => {
    const errors = [];
    const violations = findViolations(files);

    for (const key of Object.keys(baseline)) {
        if (!(key in CHECKS)) {
            errors.push(`${BASELINE_PATH}: unknown check "${key}"`);
        }
    }

    for (const [name, { message }] of Object.entries(CHECKS)) {
        const listed = new Set(baseline[name] ?? []);
        const found = new Set(violations[name]);

        for (const path of found) {
            if (!listed.has(path)) {
                errors.push(`${path}: ${message} [${name}]`);
            }
        }
        for (const path of listed) {
            if (!found.has(path)) {
                errors.push(
                    `${BASELINE_PATH}: ${name} lists ${path}, which no longer breaks the check; remove it (the baseline only shrinks)`,
                );
            }
        }
        if (baseBaseline) {
            const before = new Set(baseBaseline[name] ?? []);

            for (const path of listed) {
                if (!before.has(path)) {
                    errors.push(
                        `${BASELINE_PATH}: ${name} adds ${path}, which is not in the baseline at the base commit; fix the file instead [${name}]`,
                    );
                }
            }
        }
    }

    return errors;
};

const readJson = path => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

/** The baseline at `base`, or undefined when the file does not exist there. */
const readBaselineAt = base => {
    try {
        return JSON.parse(
            execFileSync('git', ['show', `${base}:${BASELINE_PATH}`], {
                cwd: repoRoot,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            }),
        );
    } catch (error) {
        if (/does not exist|exists on disk, but not in/.test(String(error.stderr ?? ''))) {
            return undefined;
        }
        throw error;
    }
};

/** `{ base }` from `[--base <sha>]` / `[--base=<sha>]`, or `{ error }` for any other argument. */
export const parseArgs = argv => {
    let base;

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg.startsWith('--base=')) {
            base = arg.slice(7);
        } else if (arg === '--base') {
            base = argv[index + 1] ?? '';
            index += 1;
        } else {
            return { error: `check-file-layout: unknown argument "${arg}"` };
        }
    }

    return { base };
};

export const main = (argv = process.argv.slice(2)) => {
    const { base, error } = parseArgs(argv);

    if (error) {
        console.error(`${error}\nUsage: node scripts/check-file-layout.mjs [--base <sha>]`);
        return 1;
    }
    if (base !== undefined && !/^[0-9a-f]{7,40}$/i.test(base)) {
        console.error(`check-file-layout: --base "${base}" is not a commit SHA`);
        return 1;
    }
    const errors = checkFileLayout({
        files: listFiles(repoRoot),
        baseline: readJson(BASELINE_PATH),
        baseBaseline: base ? readBaselineAt(base) : undefined,
    });

    if (errors.length > 0) {
        console.error(
            `File layout check failed (spec 02 §D0, D11, D12):\n- ${errors.join('\n- ')}`,
        );
        return 1;
    }
    console.log('File layout OK.');
    return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
