// The styled-components allowlist only shrinks (spec 05 §3, "no new styled-components"):
// 1. every entry of config/eslint/styled-components-allowlist.json exists and still imports
//    styled-components (otherwise: remove the entry);
// 2. the list only shrinks: no entry that is not in the list at the base commit;
// 3. touch rule: a listed file changed since the base, that is a `styled.ts` or whose added lines
//    write styles (styled./styled(, css`, keyframes`, createGlobalStyle), must move to a CSS Module
//    and leave the list. A change of only `import`/`export` lines without style code is not a touch;
// 4. an exception is an entry `{ path, reason, issue }` added to config/eslint/styled-touch-exempt.json
//    in the same change (an entry already present at the base commit no longer exempts).
// When the allowlist does not exist at the base commit the check is new: only rule 1 applies.
//
// Usage: node scripts/check-styled-allowlist.mjs [--base <sha>]
// Without --base it compares with `git merge-base HEAD origin/master` locally. With CI=true a run
// without --base (the `lint` inside verify:full) checks only rule 1; the CI step passes
// `--base "$BASE_SHA"`, and in a pull_request run an empty or non-SHA base fails closed.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ALLOWLIST_PATH, importsStyled } from './generate-styled-allowlist.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

export const EXEMPT_PATH = 'config/eslint/styled-touch-exempt.json';

const SHA = /^(?!0{40}$)[0-9a-f]{40}$/i;
const STYLE_CODE = /\bstyled[.(]|\bcss`|\bkeyframes`|\bcreateGlobalStyle\b/;
// Lines of an import/export statement, also inside a multi-line one (`    Foo,`, `} from './x';`).
const IMPORT_EXPORT_LINE =
    /^\s*(?:$|(?:import|export)\b|}\s*from\s|(?:type\s+)?[\w$]+(?:\s+as\s+[\w$]+)?,?\s*$|};?\s*$)/;

/**
 * Changed lines per file of a `git diff --unified=0` output.
 * @returns {Record<string, { added: string[], removed: string[] }>}
 */
export const parseDiff = diff => {
    const files = {};
    let current;

    for (const line of diff.split('\n')) {
        if (line.startsWith('diff --git ')) {
            current = undefined;
        } else if (line.startsWith('+++ ')) {
            const path = line.slice(4);

            current = path === '/dev/null' ? undefined : path.replace(/^b\//, '');
            if (current) {
                files[current] ??= { added: [], removed: [] };
            }
        } else if (line.startsWith('--- ')) {
            const path = line.slice(4);

            if (path !== '/dev/null') {
                current = path.replace(/^a\//, '');
                files[current] ??= { added: [], removed: [] };
            }
        } else if (current && line.startsWith('+')) {
            files[current].added.push(line.slice(1));
        } else if (current && line.startsWith('-')) {
            files[current].removed.push(line.slice(1));
        }
    }

    return files;
};

/** True when a change of a listed file counts as a touch (rule 3). */
export const isTouch = (path, { added, removed }) => {
    if (added.some(line => STYLE_CODE.test(line))) {
        return true;
    }
    if ([...added, ...removed].every(line => IMPORT_EXPORT_LINE.test(line))) {
        return false;
    }

    return /(?:^|\/)styled\.ts$/.test(path);
};

/**
 * @param {{
 *   allowlist: string[],
 *   sources: Record<string, string | undefined>,
 *   exempt: unknown,
 *   baseAllowlist?: string[],
 *   baseExempt?: unknown,
 *   changes?: Record<string, { added: string[], removed: string[] }>,
 * }} input
 *   `sources`: file contents by path (undefined: the file does not exist); `baseAllowlist`: the
 *   list at the base commit (undefined: the check is new or no base); `changes`: the diff since
 *   the base; `baseExempt`: the exempt list at the base (its entries no longer exempt).
 * @returns {string[]} errors
 */
export const checkStyledAllowlist = ({
    allowlist,
    sources,
    exempt,
    baseAllowlist,
    baseExempt,
    changes,
}) => {
    const errors = [];

    if (!Array.isArray(exempt)) {
        errors.push(`${EXEMPT_PATH}: must be an array of { path, reason, issue }`);
    }
    const exemptPaths = new Set();
    const usedExemptions = new Set(
        (Array.isArray(baseExempt) ? baseExempt : []).map(entry => JSON.stringify(entry)),
    );

    for (const entry of Array.isArray(exempt) ? exempt : []) {
        if (!entry?.path || !entry.reason || !entry.issue) {
            errors.push(
                `${EXEMPT_PATH}: ${JSON.stringify(entry)} needs path, reason and issue (the issue that converts the file)`,
            );
        } else if (!usedExemptions.has(JSON.stringify(entry))) {
            exemptPaths.add(entry.path);
        }
    }

    for (const path of allowlist) {
        const source = sources[path];

        if (source === undefined) {
            errors.push(`${ALLOWLIST_PATH}: ${path} does not exist; remove the entry`);
        } else if (!importsStyled(source)) {
            errors.push(
                `${ALLOWLIST_PATH}: ${path} no longer imports styled-components; remove the entry`,
            );
        }
    }

    if (baseAllowlist) {
        const before = new Set(baseAllowlist);

        for (const path of allowlist.filter(entry => !before.has(entry))) {
            errors.push(
                `${ALLOWLIST_PATH}: ${path} is not in the list at the base commit; the list only shrinks (use a CSS Module). If the branch is behind master, merge master first`,
            );
        }
        for (const path of allowlist) {
            const change = changes?.[path];

            if (change && !exemptPaths.has(path) && isTouch(path, change)) {
                errors.push(
                    `${path}: changed styled code since the base commit (if the branch is behind master, merge master first); move it to a CSS Module (Component.module.css, var(--cp-*)) and remove it from ${ALLOWLIST_PATH}, or add { path, reason, issue } to ${EXEMPT_PATH}`,
                );
            }
        }
    }

    return errors;
};

/** `{ base }` from `[--base <sha>]` / `[--base=<sha>]` (undefined: no flag), or `{ error }`. */
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
            return { error: `check-styled-allowlist: unknown argument "${arg}"` };
        }
    }

    return { base };
};

const git = args =>
    execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 * 1024,
    }).trim();

/**
 * The base commit, or `{ base: undefined, exit?, message }` when the base checks do not run.
 * Locally the default is the merge-base with origin/master; in CI only an explicit SHA counts.
 */
export const resolveBase = (
    argBase,
    env,
    mergeBase = () => git(['merge-base', 'HEAD', 'origin/master']),
) => {
    if (env.CI !== 'true') {
        return { base: argBase || mergeBase() };
    }
    if (argBase && SHA.test(argBase)) {
        return { base: argBase };
    }
    if (argBase === undefined) {
        return { message: 'check-styled-allowlist: no --base, base checks run in the CI step' };
    }
    if (env.GITHUB_EVENT_NAME === 'pull_request') {
        return {
            exit: 1,
            message: `check-styled-allowlist: --base "${argBase}" is not a commit SHA`,
        };
    }

    return { message: '::notice::check-styled-allowlist: no base commit, base checks skipped' };
};

/** A JSON file at `base`, or undefined when it does not exist there (the check is new). */
const readJsonAt = (base, path) => {
    try {
        return JSON.parse(git(['show', `${base}:${path}`]));
    } catch (error) {
        if (/does not exist|exists on disk, but not in/.test(String(error.stderr ?? ''))) {
            return undefined;
        }
        throw error;
    }
};

const readJson = path => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

export const main = (argv = process.argv.slice(2), env = process.env) => {
    const { base: argBase, error } = parseArgs(argv);

    if (error) {
        console.error(`${error}\nUsage: node scripts/check-styled-allowlist.mjs [--base <sha>]`);
        return 1;
    }
    const { base, exit, message } = resolveBase(argBase, env);

    if (exit) {
        console.error(message);
        return exit;
    }
    if (message) {
        console.log(message);
    }

    const allowlist = readJson(ALLOWLIST_PATH);
    const sources = Object.fromEntries(
        allowlist.map(path => {
            const absolute = resolve(repoRoot, path);

            return [path, existsSync(absolute) ? readFileSync(absolute, 'utf8') : undefined];
        }),
    );
    const baseAllowlist = base ? readJsonAt(base, ALLOWLIST_PATH) : undefined;
    const baseExempt = base ? readJsonAt(base, EXEMPT_PATH) : undefined;
    // The working tree against the base: the same as HEAD in CI, and it includes local edits.
    const changes =
        base && baseAllowlist
            ? parseDiff(
                  git([
                      'diff',
                      '--unified=0',
                      '--no-renames',
                      '--no-color',
                      base,
                      '--',
                      ...allowlist,
                  ]),
              )
            : undefined;
    const errors = checkStyledAllowlist({
        allowlist,
        sources,
        exempt: readJson(EXEMPT_PATH),
        baseAllowlist,
        baseExempt,
        changes,
    });

    if (errors.length > 0) {
        console.error(
            `Styled-components allowlist check failed (spec 05 §3):\n- ${errors.join('\n- ')}`,
        );
        return 1;
    }
    console.log(`Styled-components allowlist OK (${allowlist.length} files).`);
    return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
