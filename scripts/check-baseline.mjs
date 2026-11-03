// Ratchet for the lint/type baselines (spec 02 §D0, §D7): compares the baseline files with their
// version at the base commit (`git show <base>:<file>`). A new file x rule key or a higher count
// fails, except for rules that get a new key in config/eslint/rule-classes.json in this change (an
// "enable rule + --suppress-rule" PR).
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

// Rules with a registry key (`<rule>` or `<rule>#<id>`) that the base does not have: a PR that
// enables a rule or adds a selector id may add suppressions for that rule.
const addedRules = (baseRegistry, headRegistry) =>
    new Set(
        Object.keys(headRegistry)
            .filter(key => !(key in baseRegistry))
            .map(key => key.split('#')[0]),
    );

/**
 * @param {{ base: object, head: object, baseRegistry: object, headRegistry: object, file?: string }} input
 * @returns {string[]} errors
 */
export const findBaselineGrowth = ({ base, head, baseRegistry, headRegistry, file = '' }) => {
    const newRules = addedRules(baseRegistry, headRegistry);
    const errors = [];

    for (const [path, rules] of Object.entries(head)) {
        for (const [rule, { count }] of Object.entries(rules)) {
            const before = base[path]?.[rule]?.count ?? 0;

            if (count > before && !newRules.has(rule)) {
                errors.push(`${file}: ${path} ${rule} ${before} -> ${count}`);
            }
        }
    }

    return errors;
};

const git = args =>
    execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

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

export const main = (argv = process.argv.slice(2), env = process.env) => {
    const { base, exit, message } = resolveBase(parseBase(argv), env);

    if (!base) {
        (exit === 0 ? console.log : console.error)(message);
        return exit;
    }

    const baseRegistry = readAtBase(base, REGISTRY_PATH);
    const headRegistry = readHead(REGISTRY_PATH);
    const errors = BASELINE_FILES.flatMap(file =>
        findBaselineGrowth({
            base: readAtBase(base, file),
            head: readHead(file),
            baseRegistry,
            headRegistry,
            file,
        }),
    );

    if (errors.length > 0) {
        console.error(
            'Baseline grew. Fix the new violations instead of suppressing them; only a PR that ' +
                `adds a rule to ${REGISTRY_PATH} may add its suppressions:\n- ${errors.join('\n- ')}`,
        );
        return 1;
    }
    console.log(`Baseline did not grow against ${base.slice(0, 12)}.`);
    return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
