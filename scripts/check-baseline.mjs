// Ratchet for the lint/type baselines (spec 02 §D0, §D7): compares the baseline files with their
// version at the base commit (`git show <base>:<file>`). A new file x rule key or a higher count
// fails, except for rules that config/eslint/rule-classes.json registers for the first time in this
// change, and, up to the count of their own messages, new `#id` entries (ratchetOpenings).
//
// Usage: node scripts/check-baseline.mjs [--base <sha>]
// Without --base it compares with `git merge-base HEAD origin/master` locally. With CI=true a
// pull_request run fails closed on an empty or non-SHA base; a push run without a base prints a
// notice and skips the check (first push of a branch).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '..');

// Both files use the ESLint suppressions shape: { "<file>": { "<rule or TS code>": { "count": n } } }.
export const BASELINE_FILES = ['eslint-suppressions.json', 'config/tsc-baseline.json'];
export const REGISTRY_PATH = 'config/eslint/rule-classes.json';

const SHA = /^(?!0{40}$)[0-9a-f]{40}$/i;

const ruleOf = key => key.split('#')[0];

// What a change may add suppressions for (an "enable rule + --suppress-rule" PR):
// - `rules`: rules registered for the first time (`<rule>` or `<rule>#<id>` with no key of any
//   form at base); their growth is not limited;
// - `ids`: new `#id` entries of a `no-restricted-syntax`/`no-restricted-imports` rule that is
//   already registered (spec 03-1 adds the money entries next to the i18n entry of 02-C8).
//   Suppressions count per rule, not per entry, so the growth of such a rule is allowed only up to
//   the number of its messages that carry a NEW `[id]` (re-linted without suppressions); growth of
//   the rule's older entries still fails.
export const ratchetOpenings = (baseRegistry, headRegistry) => {
    const baseRules = new Set(Object.keys(baseRegistry).map(ruleOf));
    const rules = new Set();
    const ids = new Map();

    for (const key of Object.keys(headRegistry)) {
        if (key in baseRegistry) {
            continue;
        }
        const [rule, id] = key.split('#');

        if (!baseRules.has(rule)) {
            rules.add(rule);
        } else if (id) {
            ids.set(rule, new Set([...(ids.get(rule) ?? []), id]));
        }
    }

    return { rules, ids };
};

const noNewIdMessages = async () => 0;

/**
 * @param {{ base: object, head: object, baseRegistry: object, headRegistry: object, file?: string,
 *   countNewIdMessages?: (path: string, rule: string, ids: Set<string>) => Promise<number> }} input
 *   `countNewIdMessages`: messages of `rule` in `path` (linted without suppressions) whose `[id]`
 *   is one of `ids`.
 * @returns {Promise<string[]>} errors
 */
export const findBaselineGrowth = async ({
    base,
    head,
    baseRegistry,
    headRegistry,
    file = '',
    countNewIdMessages = noNewIdMessages,
}) => {
    const openings = ratchetOpenings(baseRegistry, headRegistry);
    const errors = [];

    // A malformed count (negative, fractional, missing, a string) would make the comparison
    // meaningless, so it is an error on either side.
    for (const [side, baseline] of [
        ['base', base],
        ['head', head],
    ]) {
        for (const [path, rules] of Object.entries(baseline)) {
            for (const [rule, entry] of Object.entries(rules ?? {})) {
                if (!Number.isInteger(entry?.count) || entry.count < 0) {
                    errors.push(`${file}: ${path} ${rule} has invalid count at ${side}`);
                }
            }
        }
    }
    if (errors.length > 0) {
        return errors;
    }

    for (const [path, rules] of Object.entries(head)) {
        for (const [rule, { count }] of Object.entries(rules)) {
            const before = base[path]?.[rule]?.count ?? 0;

            if (count <= before || openings.rules.has(rule)) {
                continue;
            }
            const newIds = openings.ids.get(rule);
            const allowed = newIds
                ? before + (await countNewIdMessages(path, rule, newIds))
                : before;

            if (count > allowed) {
                const detail = newIds
                    ? ` (new entries ${[...newIds].join(', ')} allow ${allowed})`
                    : '';

                errors.push(`${file}: ${path} ${rule} ${before} -> ${count}${detail}`);
            }
        }
    }

    return errors;
};

const ENTRY_ID = '\\[([a-z0-9]+(?:-[a-z0-9]+)*)\\] ';
const ENTRY_PREFIX = new RegExp(`^${ENTRY_ID}`);
const ENTRY_ANYWHERE = new RegExp(ENTRY_ID, 'g');

/**
 * `[id]` of a restricted-entry message. A restricted-syntax message starts with it. ESLint puts its
 * own text, which quotes the import source (`'routes/[id] x' import is restricted…`), before a
 * restricted-import message, and our message comes last: there the id is the last `[id] `.
 */
export const messageId = message =>
    message.match(ENTRY_PREFIX)?.[1] ?? [...message.matchAll(ENTRY_ANYWHERE)].at(-1)?.[1];

/** Lints a file with the repository config and no suppressions (the ESLint API never applies them). */
export const eslintNewIdCounter = () => {
    let eslint;

    return async (path, rule, ids) => {
        const { ESLint } = await import('eslint');

        eslint ??= new ESLint({ cwd: repoRoot });
        const [result] = await eslint.lintFiles([resolve(repoRoot, path)]);

        return (result?.messages ?? []).filter(
            message => message.ruleId === rule && ids.has(messageId(message.message)),
        ).length;
    };
};

const git = args =>
    execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

const commitExists = ref => {
    try {
        git(['cat-file', '-e', `${ref}^{commit}`]);
        return true;
    } catch {
        return false;
    }
};

const readAtBase = (base, path) => {
    try {
        return JSON.parse(git(['show', `${base}:${path}`]) || '{}');
    } catch (error) {
        // A file that does not exist at base is an empty baseline.
        if (
            /does not exist|exists on disk, but not in/.test(String(error.stderr ?? error.message))
        ) {
            return {};
        }
        throw error;
    }
};

const readHead = path => {
    const absolute = resolve(repoRoot, path);

    return existsSync(absolute) ? JSON.parse(readFileSync(absolute, 'utf8') || '{}') : {};
};

export const parseBase = argv => {
    const index = argv.findIndex(arg => arg === '--base' || arg.startsWith('--base='));

    if (index === -1) {
        return undefined;
    }

    return argv[index].startsWith('--base=') ? argv[index].slice(7) : (argv[index + 1] ?? '');
};

/** Resolves the base commit, or returns { exit, message } when the check cannot run. */
export const resolveBase = (argBase, env) => {
    if (env.CI !== 'true') {
        return { base: argBase || git(['merge-base', 'HEAD', 'origin/master']) };
    }
    if (argBase && SHA.test(argBase)) {
        return { base: argBase };
    }
    if (env.GITHUB_EVENT_NAME === 'pull_request') {
        return {
            exit: 1,
            message: `check-baseline: --base "${argBase ?? ''}" is not a commit SHA`,
        };
    }

    return { exit: 0, message: '::notice::check-baseline: no base commit, growth check skipped' };
};

export const main = async (argv = process.argv.slice(2), env = process.env) => {
    const { base, exit, message } = resolveBase(parseBase(argv), env);

    if (!base) {
        (exit === 0 ? console.log : console.error)(message);
        return exit;
    }
    // A missing file at base reads as an empty baseline, so the base commit itself must exist:
    // `git show <unknown full SHA>:<file>` reports the file as missing instead of the commit.
    if (!commitExists(base)) {
        console.error(`check-baseline: base commit "${base}" is not available (fetch it first)`);
        return 1;
    }

    const baseRegistry = readAtBase(base, REGISTRY_PATH);
    const headRegistry = readHead(REGISTRY_PATH);
    const countNewIdMessages = eslintNewIdCounter();
    const errors = [];

    for (const file of BASELINE_FILES) {
        errors.push(
            ...(await findBaselineGrowth({
                base: readAtBase(base, file),
                head: readHead(file),
                baseRegistry,
                headRegistry,
                file,
                countNewIdMessages,
            })),
        );
    }

    if (errors.length > 0) {
        console.error(
            'Baseline grew. Fix the new violations instead of suppressing them; only a PR that ' +
                `adds a rule (or a restricted entry id, for that entry's own messages) to ${REGISTRY_PATH} may add its suppressions:\n- ${errors.join('\n- ')}`,
        );
        return 1;
    }
    console.log(`Baseline did not grow against ${base.slice(0, 12)}.`);
    return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(await main());
}
