import { describe, expect, test } from 'vitest';

import {
    checkStyledAllowlist,
    isTouch,
    parseArgs,
    parseDiff,
    resolveBase,
} from './check-styled-allowlist.mjs';
import { importsStyled } from './generate-styled-allowlist.mjs';

const STYLED = "import styled from 'styled-components';\n";
const ALLOWLIST = ['src/a/styled.ts', 'src/b/B.tsx'];
const SOURCES = { 'src/a/styled.ts': STYLED, 'src/b/B.tsx': STYLED };
const SHA = 'a'.repeat(40);

const check = input =>
    checkStyledAllowlist({ allowlist: ALLOWLIST, sources: SOURCES, exempt: [], ...input });

describe('importsStyled', () => {
    test.each([
        ["import styled, { css } from 'styled-components';", true],
        ["import type { DefaultTheme } from 'styled-components';", true],
        ["import 'styled-components';", true],
        ["import { Box } from '@radix-ui/themes';", false],
    ])('%s -> %s', (source, expected) => {
        expect(importsStyled(source)).toBe(expected);
    });
});

describe('checkStyledAllowlist', () => {
    test('passes for listed importers without a base (a new check)', () => {
        expect(check({})).toEqual([]);
    });

    test('rule 1: a missing file or a file that no longer imports styled-components', () => {
        expect(
            check({
                sources: { 'src/a/styled.ts': "import { x } from 'y';", 'src/b/B.tsx': undefined },
            }),
        ).toEqual([
            expect.stringMatching(
                /src\/a\/styled\.ts no longer imports styled-components; remove the entry$/,
            ),
            expect.stringMatching(/src\/b\/B\.tsx does not exist; remove the entry$/),
        ]);
    });

    test('rule 2: the list only shrinks against the base', () => {
        expect(check({ baseAllowlist: ['src/a/styled.ts'] })).toEqual([
            expect.stringMatching(/^\S+: src\/b\/B\.tsx is not in the list at the base commit/),
        ]);
        expect(check({ baseAllowlist: [...ALLOWLIST, 'src/c/C.tsx'] })).toEqual([]);
        // A swap (one entry converted, another added) keeps the count but still fails.
        expect(check({ baseAllowlist: ['src/a/styled.ts', 'src/c/C.tsx'] })).toEqual([
            expect.stringMatching(/src\/b\/B\.tsx is not in the list at the base commit/),
        ]);
    });

    test('rule 3: editing an allowlisted styled.ts without converting it fails', () => {
        const changes = {
            'src/a/styled.ts': { added: ['    width: 41px;'], removed: ['    width: 40px;'] },
        };

        expect(check({ baseAllowlist: ALLOWLIST, changes })).toEqual([
            expect.stringMatching(
                /^src\/a\/styled\.ts: changed styled code since the base commit .*; move it to a CSS Module/,
            ),
        ]);
    });

    test('rule 3: new styled code in another listed file fails; other edits do not', () => {
        expect(
            check({
                baseAllowlist: ALLOWLIST,
                changes: { 'src/b/B.tsx': { added: ['const X = styled.div`'], removed: [] } },
            }),
        ).toHaveLength(1);
        expect(
            check({
                baseAllowlist: ALLOWLIST,
                changes: {
                    'src/b/B.tsx': { added: ['    return <X />;'], removed: ['    return null;'] },
                },
            }),
        ).toEqual([]);
    });

    test('rule 3: a change of only import/export lines is not a touch', () => {
        const changes = {
            'src/a/styled.ts': {
                added: [
                    'export { Root };',
                    "import { cx } from 'helpers/cx';",
                    '    Root,',
                    "} from './x';",
                ],
                removed: ['export default Root;'],
            },
        };

        expect(check({ baseAllowlist: ALLOWLIST, changes })).toEqual([]);
    });

    test('rule 4: an exempt entry needs an issue and allows the touch', () => {
        const changes = { 'src/a/styled.ts': { added: ['    width: 41px;'], removed: [] } };

        expect(
            check({
                baseAllowlist: ALLOWLIST,
                changes,
                exempt: [{ path: 'src/a/styled.ts', reason: 'hotfix', issue: 845 }],
            }),
        ).toEqual([]);
        expect(
            check({
                baseAllowlist: ALLOWLIST,
                changes,
                exempt: [{ path: 'src/a/styled.ts', reason: 'hotfix' }],
            }),
        ).toEqual([
            expect.stringMatching(/needs path, reason and issue/),
            expect.stringMatching(/^src\/a\/styled\.ts: changed styled code/),
        ]);
    });
});

describe('isTouch', () => {
    test('a styled.ts change touches, an import-only change does not', () => {
        expect(isTouch('src/x/styled.ts', { added: ['  color: red;'], removed: [] })).toBe(true);
        expect(isTouch('src/x/styled.ts', { added: ["import a from 'b';"], removed: [] })).toBe(
            false,
        );
        expect(isTouch('src/x/X.tsx', { added: ['const s = css`'], removed: [] })).toBe(true);
        expect(
            isTouch('src/x/X.tsx', { added: ['const G = createGlobalStyle`'], removed: [] }),
        ).toBe(true);
    });
});

describe('parseDiff', () => {
    test('collects added and removed lines per file', () => {
        const diff = [
            'diff --git a/src/a/styled.ts b/src/a/styled.ts',
            'index 1..2 100644',
            '--- a/src/a/styled.ts',
            '+++ b/src/a/styled.ts',
            '@@ -3 +3 @@',
            '-    width: 40px;',
            '+    width: 41px;',
        ].join('\n');

        expect(parseDiff(diff)).toEqual({
            'src/a/styled.ts': { added: ['    width: 41px;'], removed: ['    width: 40px;'] },
        });
    });
});

describe('parseArgs and resolveBase', () => {
    test('parses --base forms and rejects unknown arguments', () => {
        expect(parseArgs([])).toEqual({ base: undefined });
        expect(parseArgs(['--base', SHA])).toEqual({ base: SHA });
        expect(parseArgs(['--base='])).toEqual({ base: '' });
        expect(parseArgs(['--x'])).toEqual({ error: expect.stringMatching(/unknown argument/) });
    });

    test('locally defaults to the merge-base with origin/master', () => {
        expect(resolveBase(undefined, {}, () => 'm')).toEqual({ base: 'm' });
        expect(resolveBase(SHA, {}, () => 'm')).toEqual({ base: SHA });
    });

    test('in CI: an explicit SHA runs, no flag skips the base checks, a bad base fails a PR', () => {
        const pr = { CI: 'true', GITHUB_EVENT_NAME: 'pull_request' };
        const push = { CI: 'true', GITHUB_EVENT_NAME: 'push' };

        expect(resolveBase(SHA, pr)).toEqual({ base: SHA });
        expect(resolveBase(undefined, pr)).toEqual({ message: expect.any(String) });
        expect(resolveBase('', pr)).toEqual({
            exit: 1,
            message: expect.stringMatching(/not a commit SHA/),
        });
        expect(resolveBase('0'.repeat(40), pr).exit).toBe(1);
        expect(resolveBase('', push)).toEqual({ message: expect.stringMatching(/::notice::/) });
    });
});

describe('review hardening (05-5)', () => {
    test('rule 3: an exported one-line styled declaration is a touch', () => {
        expect(
            isTouch('src/a/styled.ts', {
                added: ['export const Gap = styled.div`gap: 8px;`;'],
                removed: [],
            }),
        ).toBe(true);
        expect(
            isTouch('src/b/B.tsx', { added: ['export const P = keyframes`from{}`;'], removed: [] }),
        ).toBe(true);
    });

    test('rule 4: an exempt entry already at the base commit no longer exempts', () => {
        const changes = { 'src/a/styled.ts': { added: ['    width: 41px;'], removed: [] } };
        const entry = { path: 'src/a/styled.ts', reason: 'hotfix', issue: 845 };

        expect(
            check({ baseAllowlist: ALLOWLIST, changes, exempt: [entry], baseExempt: [entry] }),
        ).toEqual([expect.stringMatching(/^src\/a\/styled\.ts: changed styled code/)]);
    });

    test('rule 3: re-sorting a createGlobalStyle import is not a touch', () => {
        expect(
            isTouch('src/b/B.tsx', {
                added: [
                    "import { createGlobalStyle } from 'styled-components';",
                    '    createGlobalStyle,',
                ],
                removed: ["import { css, createGlobalStyle } from 'styled-components';"],
            }),
        ).toBe(false);
    });
});
