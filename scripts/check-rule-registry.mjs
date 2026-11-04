// Checks that every enabled ESLint rule is in the rule registry (spec 02 §D0):
// config/eslint/rule-classes.json maps `<rule>` or `<rule>#<id>` to class `a` (auto-fixable) or
// `b` (correctness or boundary). Class c rules are not allowed in the config, and there is no
// `warn` level. Entries of `no-restricted-syntax`/`no-restricted-imports` are registered by the
// `[id]` prefix of their message.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';

import { PENDING_IDS } from '../config/eslint/project.js';

const repoRoot = resolve(import.meta.dirname, '..');

export const REGISTRY_PATH = 'config/eslint/rule-classes.json';
// Files that must be linted (spec 02 §D0: a component, a store, a test; plus ds-gallery). Rules
// are collected from every linted file; the samples guard against a broken file enumeration.
export const SAMPLE_FILES = [
    'src/components/AddExpenseButton.tsx',
    'src/store/authStore.ts',
    'src/store/authStore.test.ts',
    'ds-gallery/gallery.tsx',
];
const ID_RULES = new Set(['no-restricted-syntax', 'no-restricted-imports']);
const ID_PREFIX = /^\[([a-z0-9]+(?:-[a-z0-9]+)*)\] /;
const CLASSES = new Set(['a', 'b']);

const severityOf = value => (Array.isArray(value) ? value[0] : value);
const isEnabled = value => ![0, 'off'].includes(severityOf(value));
const isWarn = value => [1, 'warn'].includes(severityOf(value));

/** Messages of every entry in the options of a restricted-syntax/imports rule. */
export const entryMessages = (ruleName, value) => {
    const options = Array.isArray(value) ? value.slice(1) : [];

    if (ruleName === 'no-restricted-syntax') {
        return options.map(option => (typeof option === 'string' ? undefined : option.message));
    }

    return options.flatMap(option => {
        if (typeof option === 'string') {
            return [undefined];
        }
        if (!option.paths && !option.patterns) {
            return [option.message];
        }

        return [...(option.paths ?? []), ...(option.patterns ?? [])].map(entry =>
            typeof entry === 'string' ? undefined : entry.message,
        );
    });
};

/**
 * @param {{ registry: Record<string, string>, resolved: Array<{ file: string, rules?: object }>, blocks: unknown[], samples?: string[] }} input
 *   `resolved`: effective rules of every linted file (undefined when a file has no config);
 *   `blocks`: raw config blocks `{ name?, rules, pending? }`, scanned only for restricted-entry
 *   ids; `pending` lists `<rule>#<id>` keys marked `pending: true` (scoped to files that do not
 *   exist yet);
 *   `samples`: files that must get a config.
 * @returns {string[]} errors
 */
export const checkRegistry = ({ registry, resolved, blocks, samples = [] }) => {
    const errors = new Set();
    // Keys that are effective on at least one linted file (`onFiles`), or pending.
    const effective = new Set();
    const onFiles = new Set();
    const requireEntry = (key, where) => {
        if (!(key in registry)) {
            errors.add(`${key} (${where}) has no entry in ${REGISTRY_PATH}`);
        }
    };

    for (const [key, value] of Object.entries(registry)) {
        if (!CLASSES.has(value)) {
            errors.add(`${key}: class "${value}" is not allowed (only a or b; class c is deleted)`);
        }
    }

    const entryIds = (ruleName, value, where) =>
        entryMessages(ruleName, value).flatMap(message => {
            const id = message?.match(ID_PREFIX)?.[1];

            if (!id) {
                errors.add(`${ruleName} entry without an [id] message prefix (${where})`);
                return [];
            }
            return [`${ruleName}#${id}`];
        });

    const byFile = new Map(resolved.map(({ file, rules }) => [file, rules]));

    for (const file of samples) {
        if (!byFile.get(file)) {
            errors.add(`sample file ${file} is missing, ignored or gets no ESLint config`);
        }
    }

    for (const { file, rules } of resolved) {
        for (const [ruleName, value] of Object.entries(rules ?? {})) {
            if (!isEnabled(value)) {
                continue;
            }
            if (isWarn(value)) {
                errors.add(`${ruleName} is "warn" in ${file}: use error or off`);
            }
            const keys = ID_RULES.has(ruleName) ? entryIds(ruleName, value, file) : [ruleName];

            for (const key of keys) {
                effective.add(key);
                onFiles.add(key);
                requireEntry(key, file);
            }
        }
    }

    // Every restricted entry of a raw block must be registered, even if no linted file matches it.
    // Only an entry marked `pending: true` (scoped to files that do not exist yet, e.g.
    // `src/money/**`) also counts as effective without a matching file.
    for (const block of blocks.flat(Infinity)) {
        for (const [ruleName, value] of Object.entries(block?.rules ?? {})) {
            if (ID_RULES.has(ruleName) && isEnabled(value)) {
                const where = `block ${block.name ?? '(unnamed)'}`;

                if (isWarn(value)) {
                    errors.add(`${ruleName} is "warn" in ${where}: use error or off`);
                }
                for (const key of entryIds(ruleName, value, where)) {
                    if ((block.pending ?? []).includes(key)) {
                        effective.add(key);
                        // A pending entry that already matches a linted file is no longer pending.
                        if (onFiles.has(key)) {
                            errors.add(`${key} is effective; remove \`pending: true\``);
                        }
                    }
                    requireEntry(key, where);
                }
            }
        }
    }

    // No dead or junk keys: every key is effective on a linted file or is a pending entry id.
    for (const key of Object.keys(registry)) {
        if (!effective.has(key)) {
            errors.add(`${key} in ${REGISTRY_PATH} is not effective on any linted file`);
        }
    }

    return [...errors];
};

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/** Effective rules of every file ESLint lints (tracked and untracked, not ignored). */
export const resolveLintedFiles = async eslint => {
    const files = execFileSync(
        'git',
        ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
        { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
        .split('\0')
        .filter(file => SOURCE_FILE.test(file) && existsSync(resolve(repoRoot, file)));
    const resolved = [];

    for (const file of files) {
        const path = resolve(repoRoot, file);

        if (!(await eslint.isPathIgnored(path))) {
            const rules = (await eslint.calculateConfigForFile(path))?.rules;

            if (rules) {
                resolved.push({ file, rules });
            }
        }
    }

    return resolved;
};

// Lint modes whose effective rules are merged: `lint` and `lint:full` (CHIPIN_ESLINT_FULL=1), so a
// full-only rule is checked and not reported dead. Each mode resolves in its own process because
// config modules read the env once, at import time.
export const LINT_MODES = [{}, { CHIPIN_ESLINT_FULL: '1' }];

// The child gets the caller's env without the mode flags (a shell-set CHIPIN_ESLINT_FAST would
// drop the type-aware rules) and without test-runner variables
// (NODE_ENV, VITEST*), so it resolves the config exactly as `npm run lint` does.
export const modeEnv = (mode, base = process.env) => {
    const env = Object.fromEntries(
        Object.entries(base).filter(
            ([name]) =>
                !['CHIPIN_ESLINT_FULL', 'CHIPIN_ESLINT_FAST', 'NODE_ENV'].includes(name) &&
                !name.startsWith('VITEST'),
        ),
    );

    return { ...env, ...mode };
};

// The child prints its JSON after this marker, so output of config modules does not break parsing.
export const RESULT_MARKER = '\n@@check-rule-registry:result@@\n';
const SELF = fileURLToPath(import.meta.url);

/** Effective rules and restricted-entry blocks of the config in the current process env. */
const resolveCurrentMode = async () => {
    const resolved = await resolveLintedFiles(new ESLint({ cwd: repoRoot }));
    const { default: config } = await import(pathToFileURL(resolve(repoRoot, 'eslint.config.js')));
    // Only the restricted rules of raw blocks are needed, and they are plain JSON.
    const blocks = config.flat(Infinity).map(block => ({
        name: block?.name,
        rules: Object.fromEntries(
            Object.entries(block?.rules ?? {}).filter(([ruleName]) => ID_RULES.has(ruleName)),
        ),
        pending: block?.[PENDING_IDS] ?? [],
    }));

    return { resolved, blocks };
};

/** Runs `script --resolve` (this file by default) in the env of `mode` and parses its result. */
export const resolveMode = async (mode, script = SELF) => {
    let stdout;

    try {
        ({ stdout } = await promisify(execFile)(process.execPath, [script, '--resolve'], {
            cwd: repoRoot,
            env: modeEnv(mode),
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
        }));
    } catch (error) {
        throw new Error(
            `Rule resolution failed for mode ${JSON.stringify(mode)}: ${error.message}`,
            { cause: error },
        );
    }
    const start = stdout.lastIndexOf(RESULT_MARKER);

    try {
        if (start < 0) {
            throw new Error('result marker not found');
        }
        return JSON.parse(stdout.slice(start + RESULT_MARKER.length));
    } catch (error) {
        throw new Error(
            `Cannot read the rule resolution for mode ${JSON.stringify(mode)}: ${error.message}; ` +
                `stdout starts with: ${JSON.stringify(stdout.slice(0, 200))}`,
        );
    }
};

/** Union of every lint mode: `resolved` and `blocks` of all modes, concatenated. */
export const collectModes = async (load = resolveMode) => {
    const results = await Promise.all(LINT_MODES.map(mode => load(mode)));

    return {
        resolved: results.flatMap(result => result.resolved),
        blocks: results.flatMap(result => result.blocks),
    };
};

export const main = async () => {
    const registry = JSON.parse(readFileSync(resolve(repoRoot, REGISTRY_PATH), 'utf8'));
    const { resolved, blocks } = await collectModes();

    return checkRegistry({ registry, resolved, blocks, samples: SAMPLE_FILES });
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    // `--resolve` is the per-mode child of `resolveMode`; it prints JSON and lets stdout drain.
    if (process.argv[2] === '--resolve') {
        process.stdout.write(RESULT_MARKER + JSON.stringify(await resolveCurrentMode()));
    } else {
        const errors = await main();

        if (errors.length > 0) {
            console.error(`Rule registry check failed (spec 02 §D0):\n- ${errors.join('\n- ')}`);
            process.exit(1);
        }
        console.log(
            'Rule registry: every enabled ESLint rule is class a or b (lint and lint:full).',
        );
    }
}
