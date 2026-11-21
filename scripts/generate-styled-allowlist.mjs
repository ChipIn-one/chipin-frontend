// Writes config/eslint/styled-components-allowlist.json (spec 05 §3): the sorted repository-relative
// paths of every file in apps/app/src (tests included) that imports `styled-components`. Run once
// when the rule is introduced; afterwards the list only shrinks (scripts/check-styled-allowlist.mjs).
//
// Usage: node scripts/generate-styled-allowlist.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '..');

export const ALLOWLIST_PATH = 'config/eslint/styled-components-allowlist.json';
export const SOURCE_DIR = 'apps/app/src';

const SOURCE_FILE = /\.(?:ts|tsx)$/;
// `import x from 'styled-components'`, `import type {…} from …`, `import 'styled-components'`.
const STYLED_IMPORT = /(?:\bfrom\s*|\bimport\s*)['"]styled-components['"]/;

/** True when the source imports `styled-components`. */
export const importsStyled = source => STYLED_IMPORT.test(source);

/** Sorted repository-relative POSIX paths of the files under `dir` that import styled-components. */
export const findStyledImporters = (root = repoRoot, dir = SOURCE_DIR) =>
    readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile() && SOURCE_FILE.test(entry.name))
        .map(entry => join(entry.parentPath, entry.name))
        .filter(path => importsStyled(readFileSync(path, 'utf8')))
        .map(path => relative(root, path).split(sep).join('/'))
        .sort();

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const paths = findStyledImporters();

    writeFileSync(resolve(repoRoot, ALLOWLIST_PATH), `${JSON.stringify(paths, null, 4)}\n`);
    console.log(`${ALLOWLIST_PATH}: ${paths.length} files.`);
}
