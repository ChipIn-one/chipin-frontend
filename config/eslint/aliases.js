import { dirname, resolve } from 'node:path';

import ts from 'typescript';

// The only list of import aliases is `compilerOptions.paths` in the app tsconfig.
// This module reads it through the TypeScript API (so `extends` is honoured) and builds
// the `simple-import-sort` groups from it; no alias names are written by hand here.

const repoRoot = resolve(import.meta.dirname, '../..');

// Layer classification for the import-sort groups. Every alias that is not a presentation or
// asset layer belongs to the first (application/domain) group, so a new `src` directory added
// to `paths` is picked up without editing this file.
const PRESENTATION_LAYERS = new Set(['components', 'basics']);
const ASSET_LAYERS = new Set(['assets', 'styles']);

const formatDiagnostics = diagnostics =>
    diagnostics
        .map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        .join('; ');

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Returns the alias names (e.g. `api`, `public-routes`) declared in the app tsconfig `paths`.
 * @param {{ appDir?: string }} [options] app directory relative to the repository root
 * @returns {string[]}
 */
export const readAliases = ({ appDir = '.' } = {}) => {
    const configPath = resolve(repoRoot, appDir, 'tsconfig.app.json');
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);

    if (error) {
        throw new Error(`Cannot read ${configPath}: ${formatDiagnostics([error])}`);
    }

    // A broken `extends` or an invalid option is reported in `errors`, not thrown: fail loudly.
    const { options, errors } = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        dirname(configPath),
        undefined,
        configPath,
    );

    if (errors.length > 0) {
        throw new Error(`Invalid ${configPath}: ${formatDiagnostics(errors)}`);
    }
    const aliases = new Set(Object.keys(options.paths ?? {}).map(key => key.replace(/\/\*$/, '')));

    if (aliases.size === 0) {
        throw new Error(`No compilerOptions.paths aliases found in ${configPath}`);
    }

    return [...aliases].sort();
};

const aliasGroup = names =>
    names.length > 0 ? [`^(${names.map(escapeRegExp).join('|')})(/|$)`] : [];

/**
 * Builds the `simple-import-sort/imports` groups: Node builtins, packages, the three alias
 * layer groups built from tsconfig `paths`, parent imports, sibling imports, styles.
 * @param {{ appDir?: string }} [options]
 * @returns {string[][]}
 */
export const importSortGroups = options => {
    const aliases = readAliases(options);
    const presentation = aliases.filter(name => PRESENTATION_LAYERS.has(name));
    const assets = aliases.filter(name => ASSET_LAYERS.has(name));
    const application = aliases.filter(
        name => !PRESENTATION_LAYERS.has(name) && !ASSET_LAYERS.has(name),
    );

    return [
        ['^node:'],
        ['^react$', '^react-dom$', '^@?\\w'],
        aliasGroup(application),
        aliasGroup(presentation),
        aliasGroup(assets),
        ['^\\.\\.'],
        ['^\\.'],
        ['\\.s?css$'],
    ].filter(group => group.length > 0);
};
