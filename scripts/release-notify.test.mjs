import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, test, vi } from 'vitest';

import {
    compareTags,
    decideMessage,
    escapeMrkdwn,
    includedIssues,
    issueRefs,
    main,
    outputBlock,
} from './release-notify.mjs';

const SHA = '6f21103aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BASE = {
    guardRelease: 'true',
    skipReason: '',
    sha: SHA,
    newestTag: 'v1.4.0',
    releaseResult: 'success',
    outcome: 'RELEASED',
    tag: 'v1.5.0',
    redeployResult: 'success',
    repository: 'ChipIn-one/chipin-frontend',
    serverUrl: 'https://github.com',
    deploymentUrl: 'https://chipin-frontend-x1y2-chipin.vercel.app',
    releaseUrl: 'https://github.com/ChipIn-one/chipin-frontend/releases/tag/v1.5.0',
    releaseBody:
        "## Included Issues\n\n- ChipIn-one/chipin-frontend#540 (#721)\n- ChipIn-one/chipin-frontend#718 (#728, #730)\n\n\n## What's Changed\n* fix: something by @someone",
    issueTypes: new Map([
        ['ChipIn-one/chipin-frontend#540', 'Bug'],
        ['ChipIn-one/chipin-frontend#718', 'Task'],
    ]),
};
const FE = 'https://github.com/ChipIn-one/chipin-frontend/issues';
const body = refs => `## Included Issues\n${refs.map(ref => `- ${ref}`).join('\n')}\n`;
const ENV = {
    GUARD_RELEASE: 'true',
    GUARD_SKIP_REASON: '',
    NEWEST_TAG: 'v1.4.0',
    DEPLOYED_SHA: SHA,
    RELEASE_RESULT: 'success',
    RELEASE_OUTCOME: 'RELEASED',
    RELEASE_TAG: 'v1.5.0',
    REDEPLOY_RESULT: 'success',
    DEPLOYMENT_ENVIRONMENT_URL: 'https://chipin-frontend-x1y2-chipin.vercel.app',
    GITHUB_REPOSITORY: 'ChipIn-one/chipin-frontend',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com',
    GITHUB_TOKEN: 'secret-github-token',
};
const decide = overrides => decideMessage({ ...BASE, ...overrides });
const reply = (status, body) =>
    Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    });
const collect = () => {
    const lines = [];
    const outputs = [];
    return {
        lines,
        outputs,
        options: { write: line => lines.push(line), output: text => outputs.push(text) },
    };
};
// Parses the GITHUB_OUTPUT text written by main into { name: value }.
const parseOutput = text => {
    const result = {};
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const heredoc = /^([a-z_]+)<<(.+)$/u.exec(lines[i]);
        if (heredoc) {
            const end = lines.indexOf(heredoc[2], i + 1);
            result[heredoc[1]] = lines.slice(i + 1, end).join('\n');
            i = end;
            continue;
        }
        const plain = /^([a-z_]+)=(.*)$/u.exec(lines[i]);
        if (plain) result[plain[1]] = plain[2];
    }
    return result;
};

describe('release-notify rule table (#484)', () => {
    test('RELEASED: tag, Release link, Included Issues, SHA, deployment URL, no warning', () => {
        const { post, text } = decide({});
        expect(post).toBe(true);
        expect(text).toContain(
            '*chipin-frontend v1.5.0 released* - <https://github.com/ChipIn-one/chipin-frontend/releases/tag/v1.5.0|Release notes>',
        );
        expect(text).toContain(`*Bug (1):* <${FE}/540|#540>\n*Task (1):* <${FE}/718|#718>`);
        expect(text).not.toContain('(#721)');
        expect(text).not.toContain('#728');
        expect(text).not.toContain("What's Changed");
        expect(text).toContain(
            `SHA: <https://github.com/ChipIn-one/chipin-frontend/commit/${SHA}|6f21103>`,
        );
        expect(text).toContain(
            'Deployment: <https://chipin-frontend-x1y2-chipin.vercel.app/|https://chipin-frontend-x1y2-chipin.vercel.app/>',
        );
        expect(text).not.toContain(':warning:');
    });

    test.each(['failure', 'skipped', 'cancelled', ''])(
        'RELEASED with redeploy result "%s" adds the untagged-label warning',
        redeployResult => {
            const { post, text } = decide({ redeployResult });
            expect(post).toBe(true);
            expect(text).toContain(':warning: The redeploy of the tagged build did not succeed');
            expect(text).toContain('still shows the untagged label');
        },
    );

    test('RELEASED without a readable Release falls back to the tag URL and says so', () => {
        const { text } = decide({ releaseUrl: undefined, releaseBody: undefined });
        expect(text).toContain(
            '<https://github.com/ChipIn-one/chipin-frontend/releases/tag/v1.5.0|Release notes>',
        );
        expect(text).toContain('Included Issues: the Release could not be read');
        expect(decide({ releaseBody: 'no section' }).text).toContain(
            'Included Issues: none listed in the Release',
        );
    });

    test('ALREADY_RELEASED of the newest tag is silent', () => {
        expect(decide({ outcome: 'ALREADY_RELEASED', tag: 'v1.4.0' })).toEqual({
            post: false,
            text: '',
        });
        expect(
            decide({ outcome: 'ALREADY_RELEASED', tag: 'v1.10.0', newestTag: 'v1.10.0' }).post,
        ).toBe(false);
    });

    test('ALREADY_RELEASED of an older tag is a rollback (by version order, not lexical)', () => {
        const { post, text } = decide({
            outcome: 'ALREADY_RELEASED',
            tag: 'v1.9.0',
            newestTag: 'v1.10.0',
        });
        expect(post).toBe(true);
        expect(text).toContain('*chipin-frontend: Rollback to v1.9.0*');
        expect(text).toContain('6f21103');
        expect(text).toContain('Deployment: ');
    });

    test('ALREADY_RELEASED without comparable tags is a short factual line', () => {
        const { post, text } = decide({ outcome: 'ALREADY_RELEASED', tag: '', newestTag: '' });
        expect(post).toBe(true);
        expect(text).toContain('release ALREADY_RELEASED');
    });

    test('ALREADY_RELEASED with a tag newer than the newest tag is the generic line', () => {
        const { post, text } = decide({
            outcome: 'ALREADY_RELEASED',
            tag: 'v1.5.0',
            newestTag: 'v1.4.0',
        });
        expect(post).toBe(true);
        expect(text).toBe(
            `:information_source: *chipin-frontend: release ALREADY_RELEASED*, tag v1.5.0 - Production runs <https://github.com/ChipIn-one/chipin-frontend/commit/${SHA}|6f21103>.`,
        );
    });

    test('guard rollback-untagged: rollback to an untagged commit, no release', () => {
        const { post, text } = decide({
            guardRelease: 'false',
            skipReason: 'rollback-untagged',
            outcome: '',
            tag: '',
            releaseResult: 'skipped',
            redeployResult: 'skipped',
        });
        expect(post).toBe(true);
        expect(text).toContain('*chipin-frontend: Rollback to an untagged commit*');
        expect(text).toContain('(behind the newest tag v1.4.0). No release.');
        expect(text).toContain('6f21103');
    });

    test('guard not-on-master: not released with the reason', () => {
        const { post, text } = decide({ guardRelease: 'false', skipReason: 'not-on-master' });
        expect(post).toBe(true);
        expect(text).toContain('*chipin-frontend: not released*');
        expect(text).toContain('which is not on master');
    });

    test('guard not-in-history and an unknown skip are short not-released lines', () => {
        expect(decide({ guardRelease: 'false', skipReason: 'not-in-history' }).text).toContain(
            'not in the repository history',
        );
        expect(decide({ guardRelease: '', skipReason: '' }).text).toContain('(guard: no reason)');
    });

    test.each(['NO_RELEASE', 'BLOCKED', 'RELEASE_MISSING'])(
        '%s is a short factual line with the outcome and the SHA',
        outcome => {
            const { post, text } = decide({ outcome, tag: '' });
            expect(post).toBe(true);
            expect(text).toBe(
                `:information_source: *chipin-frontend: release ${outcome}* - Production runs <https://github.com/ChipIn-one/chipin-frontend/commit/${SHA}|6f21103>.`,
            );
        },
    );

    test('a failed release job without an outcome names the job result', () => {
        const { text } = decide({ outcome: '', tag: '', releaseResult: 'failure' });
        expect(text).toContain('release no outcome (release job failure)');
    });
});

describe('release-notify escaping', () => {
    test('escapes &, < and > in every external value', () => {
        expect(escapeMrkdwn('a & <!channel> > b')).toBe('a &amp; &lt;!channel&gt; &gt; b');
        const { text } = decide({
            releaseBody: '## Included Issues\n- <!here> & Owner/repo#1 <x>\n- Owner/repo#2 <b>',
            outcome: 'RELEASED',
        });
        expect(text).toContain('&lt;!here&gt; &amp; Owner/repo#1 &lt;x&gt;');
        expect(text).toContain('<https://github.com/Owner/repo/issues/2|Owner/repo#2>');
        expect(text).not.toContain('&lt;b&gt;');
        expect(text).not.toContain('<!here>');
        const typed = decide({
            releaseBody: body(['ChipIn-one/chipin-frontend#1']),
            issueTypes: new Map([['ChipIn-one/chipin-frontend#1', '<!channel> & co']]),
        }).text;
        expect(typed).toContain(`*&lt;!channel&gt; &amp; co (1):* <${FE}/1|#1>`);
        expect(typed).not.toContain('<!channel>');
        const odd = decide({ outcome: '<!channel>', tag: '', sha: 'x<y>`z' }).text;
        expect(odd).toContain('release &lt;!channel&gt;');
        expect(odd).toContain('`x&lt;y&gt;z`');
        expect(odd).not.toContain('<!channel>');
    });

    test('drops a non-https or link-breaking deployment URL', () => {
        expect(decide({ deploymentUrl: 'javascript:alert(1)' }).text).not.toContain('Deployment:');
        expect(decide({ deploymentUrl: 'http://example.com' }).text).not.toContain('Deployment:');
    });
});

describe('release-notify helpers', () => {
    test('includedIssues reads only the Included Issues section', () => {
        expect(includedIssues(BASE.releaseBody)).toEqual([
            'ChipIn-one/chipin-frontend#540 (#721)',
            'ChipIn-one/chipin-frontend#718 (#728, #730)',
        ]);
        expect(includedIssues('')).toEqual([]);
        expect(includedIssues(undefined)).toEqual([]);
    });

    test('issueRefs drops the PR numbers and duplicates and keeps an item that is not a ref', () => {
        expect(
            issueRefs(['O/r#2 (#9)', 'O/r#2 (#10)', 'free text', 'P/q#1']).map(ref => ref.key),
        ).toEqual(['O/r#2', 'free text', 'P/q#1']);
    });

    test('compareTags orders by version', () => {
        expect(compareTags('v1.9.0', 'v1.10.0')).toBe(-1);
        expect(compareTags('v2.0.0', 'v1.10.0')).toBe(1);
        expect(compareTags('v1.0.0', 'v1.0.0')).toBe(0);
        expect(compareTags('v1.0', 'v1.0.0')).toBeNull();
    });

    test('outputBlock uses the heredoc form and refuses a value that contains the delimiter', () => {
        expect(outputBlock('text', 'a\nb', 'EOF_X')).toBe('text<<EOF_X\na\nb\nEOF_X\n');
        expect(() => outputBlock('text', 'a\nEOF_X', 'EOF_X')).toThrow();
        expect(outputBlock('text', 'x')).toMatch(/^text<<ghadelimiter_[0-9a-f-]{36}\nx\n/u);
    });
});

describe('release-notify compact Included Issues (#908)', () => {
    const refs = numbers => numbers.map(n => `ChipIn-one/chipin-frontend#${n} (#${n + 1000})`);
    const types = entries =>
        new Map(entries.map(([n, type]) => [`ChipIn-one/chipin-frontend#${n}`, type]));

    test('one line per type: Feature, Bug, Task, other types by name, then No type; numbers sorted', () => {
        const { text } = decide({
            releaseBody: body(refs([9, 3, 5, 7, 4, 8, 6])),
            issueTypes: types([
                [9, 'Task'],
                [3, 'Bug'],
                [5, 'Feature'],
                [7, 'Task'],
                [4, 'Epic'],
                [8, null],
                [6, 'Bug'],
            ]),
        });
        expect(text).toContain(
            [
                `*Feature (1):* <${FE}/5|#5>`,
                `*Bug (2):* <${FE}/3|#3> <${FE}/6|#6>`,
                `*Task (2):* <${FE}/7|#7> <${FE}/9|#9>`,
                `*Epic (1):* <${FE}/4|#4>`,
                `*No type (1):* <${FE}/8|#8>`,
            ].join('\n'),
        );
        expect(text).not.toMatch(/\(#10\d\d\)/u);
        expect(text).not.toContain('Included Issues');
    });

    test('caps each line and ends it with +N more', () => {
        const numbers = Array.from({ length: 28 }, (_, i) => i + 1);
        const { text } = decide({
            releaseBody: body(refs(numbers)),
            issueTypes: types(numbers.map(n => [n, 'Task'])),
        });
        const line = text.split('\n').find(item => item.startsWith('*Task'));
        expect(line).toMatch(/^\*Task \(28\):\* /u);
        expect(line).toContain(`<${FE}/15|#15> +13 more`);
        expect(line).not.toContain('|#16>');
    });

    test('without Issue Types: one ungrouped line of linked numbers, capped too', () => {
        const numbers = Array.from({ length: 17 }, (_, i) => 100 - i);
        const { text } = decide({ releaseBody: body(refs(numbers)), issueTypes: undefined });
        expect(text).toContain(`*Issues (17):* <${FE}/84|#84> <${FE}/85|#85>`);
        expect(text).toContain(`<${FE}/98|#98> +2 more`);
        expect(text).not.toContain('Bug');
    });

    test('cross-repository refs keep their repository, own Issues first', () => {
        const { text } = decide({
            releaseBody: body([
                'ChipIn-one/chipin-backend#12 (#40)',
                'ChipIn-one/chipin-frontend#7 (#41)',
                'Other-org/tool#3',
            ]),
            issueTypes: new Map([
                ['ChipIn-one/chipin-backend#12', 'Bug'],
                ['ChipIn-one/chipin-frontend#7', 'Bug'],
                ['Other-org/tool#3', 'Bug'],
            ]),
        });
        expect(text).toContain(
            `*Bug (3):* <${FE}/7|#7> <https://github.com/ChipIn-one/chipin-backend/issues/12|chipin-backend#12> <https://github.com/Other-org/tool/issues/3|Other-org/tool#3>`,
        );
    });

    test('a free-text item goes to No type, last, and is counted', () => {
        const { text } = decide({
            releaseBody: body(['ChipIn-one/chipin-frontend#7 (#1)', 'hand-written <note>']),
            issueTypes: types([[7, 'Bug']]),
        });
        expect(text).toContain(`*Bug (1):* <${FE}/7|#7>\n*No type (1):* hand-written &lt;note&gt;`);
    });

    test('type names lose line breaks and mrkdwn markers', () => {
        const { text } = decide({
            releaseBody: body(['ChipIn-one/chipin-frontend#7']),
            issueTypes: types([[7, 'Tech*\nDebt_']]),
        });
        expect(text).toContain(`*Tech Debt (1):* <${FE}/7|#7>`);
    });

    test('repository names compare without case', () => {
        const { text } = decide({
            releaseBody: body(['chipin-one/CHIPIN-frontend#7', 'chipin-one/chipin-backend#2']),
            issueTypes: new Map([
                ['chipin-one/CHIPIN-frontend#7', 'Bug'],
                ['chipin-one/chipin-backend#2', 'Bug'],
            ]),
        });
        expect(text).toContain(
            '|#7> <https://github.com/chipin-one/chipin-backend/issues/2|chipin-backend#2>',
        );
    });

    test('a duplicate Issue is counted once', () => {
        const { text } = decide({
            releaseBody: body([
                'ChipIn-one/chipin-frontend#7 (#1)',
                'ChipIn-one/chipin-frontend#7 (#2)',
            ]),
            issueTypes: types([[7, 'Bug']]),
        });
        expect(text).toContain(`*Bug (1):* <${FE}/7|#7>\n`);
    });
});

describe('release-notify milestone line (#919)', () => {
    const FE_REPO = 'ChipIn-one/chipin-frontend';
    const MS = `https://github.com/${FE_REPO}/milestone`;
    const refs = numbers => numbers.map(n => `${FE_REPO}#${n} (#${n + 1000})`);
    const ms = (number, title, closed, total, open = false, repo = FE_REPO) => ({
        repo,
        number,
        title,
        url: `https://github.com/${repo}/milestone/${number}`,
        closed,
        total,
        open,
    });
    const milestones = entries => new Map(entries.map(([key, value]) => [key, value]));
    const fe = n => `${FE_REPO}#${n}`;
    const milestoneLineOf = text => text.split('\n').find(line => line.startsWith('*Milestone'));

    test('one milestone: linked title and done/total, after the Issue lines and before SHA', () => {
        const { text } = decide({
            releaseBody: body(refs([1, 2])),
            issueTypes: new Map([
                [fe(1), 'Bug'],
                [fe(2), 'Task'],
            ]),
            issueMilestones: milestones([
                [fe(1), ms(5, 'Public site', 4, 10)],
                [fe(2), null],
            ]),
        });
        const lines = text.split('\n');
        const index = lines.indexOf(`*Milestone:* <${MS}/5|Public site> 4/10 done`);
        expect(index).toBeGreaterThan(0);
        expect(lines[index - 1]).toMatch(/^\*Task \(1\):\*/u);
        expect(lines[index + 1]).toMatch(/^SHA: /u);
    });

    test('open Included Issues count as done once each; done never exceeds total', () => {
        const { text } = decide({
            releaseBody: body(refs([1, 2, 3])),
            issueMilestones: milestones([
                [fe(1), ms(6, 'Design system v1', 2, 16, true)],
                [fe(2), ms(6, 'Design system v1', 2, 16, true)],
                [fe(3), ms(7, 'Premium', 3, 3, true)],
            ]),
        });
        expect(milestoneLineOf(text)).toBe(
            `*Milestones:* <${MS}/6|Design system v1> 4/16 done, <${MS}/7|Premium> 3/3 done`,
        );
    });

    test('several milestones: more Included Issues first, then by title; at most 3 and then +N more', () => {
        const { text } = decide({
            releaseBody: body(refs([1, 2, 3, 4, 5, 6])),
            issueMilestones: milestones([
                [fe(1), ms(8, 'Onboarding and invites', 0, 5)],
                [fe(2), ms(7, 'Premium', 1, 3)],
                [fe(3), ms(5, 'Public site', 4, 10)],
                [fe(4), ms(5, 'Public site', 4, 10)],
                [fe(5), ms(4, 'Telegram TMA', 0, 2)],
                [fe(6), ms(6, 'Design system v1', 2, 16)],
            ]),
        });
        expect(milestoneLineOf(text)).toBe(
            `*Milestones:* <${MS}/5|Public site> 4/10 done, <${MS}/6|Design system v1> 2/16 done, <${MS}/8|Onboarding and invites> 0/5 done, +2 more`,
        );
    });

    test('the same title in two repositories is one goal: counts summed, link to this repository', () => {
        const be = 'ChipIn-one/chipin-backend';
        const { text } = decide({
            releaseBody: body([`${be}#9`, ...refs([1])]),
            issueMilestones: milestones([
                [`${be}#9`, ms(4, 'Telegram TMA', 1, 1, true, be)],
                [fe(1), ms(4, 'telegram tma', 0, 2)],
            ]),
        });
        expect(milestoneLineOf(text)).toBe(`*Milestone:* <${MS}/4|Telegram TMA> 2/3 done`);
        const unsafe = decide({
            releaseBody: body([`${be}#9`, ...refs([1])]),
            issueMilestones: milestones([
                [`${be}#9`, ms(4, 'Telegram TMA', 1, 1, true, be)],
                [fe(1), { ...ms(4, 'Telegram TMA', 0, 2), url: 'http://example.com' }],
            ]),
        });
        expect(milestoneLineOf(unsafe.text)).toBe(
            '*Milestone:* <https://github.com/ChipIn-one/chipin-backend/milestone/4|Telegram TMA> 2/3 done',
        );
    });

    test('no line without milestones, without the milestone read, or for unusable counts', () => {
        for (const issueMilestones of [
            undefined,
            new Map(),
            milestones([[fe(1), null]]),
            milestones([[fe(1), ms(5, 'Public site', -1, 10)]]),
            milestones([[fe(1), ms(5, '  ', 1, 10)]]),
            milestones([[fe(1), { ...ms(5, 'Public site', 1, 10), total: '10' }]]),
        ]) {
            const { text } = decide({ releaseBody: body(refs([1])), issueMilestones });
            expect(text).not.toContain('Milestone');
        }
    });

    test('a milestone title is one escaped line; an unsafe URL leaves plain text', () => {
        const { text } = decide({
            releaseBody: body(refs([1])),
            issueMilestones: milestones([
                [fe(1), { ...ms(5, '<!channel>\n& co', 1, 2), url: 'javascript:alert(1)' }],
            ]),
        });
        expect(milestoneLineOf(text)).toBe('*Milestone:* &lt;!channel&gt; &amp; co 1/2 done');
        expect(
            milestoneLineOf(
                decide({
                    releaseBody: body(refs([1])),
                    issueMilestones: milestones([[fe(1), ms(5, '*Bold_ ~x~ `y`', 1, 2)]]),
                }).text,
            ),
        ).toBe(`*Milestone:* <${MS}/5|Bold x y> 1/2 done`);
        expect(text).not.toContain('<!channel>');
    });
});

describe('release-notify main', () => {
    const graphql = {
        data: { r0: { i0: { issueType: { name: 'Bug' } }, i1: { issueType: null } } },
    };
    const releaseThen = typesReply =>
        vi.fn(url =>
            url.endsWith('/graphql')
                ? typesReply()
                : reply(200, { html_url: BASE.releaseUrl, body: BASE.releaseBody }),
        );

    test('reads the Release and the Issue Types with GITHUB_TOKEN and writes text and post=true', async () => {
        const fetchImpl = releaseThen(() => reply(200, graphql));
        const { lines, outputs, options } = collect();
        const result = await main(ENV, { ...options, fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe(
            'https://api.github.com/repos/ChipIn-one/chipin-frontend/releases/tags/v1.5.0',
        );
        expect(init.headers.Authorization).toBe('Bearer secret-github-token');
        const [typesUrl, typesInit] = fetchImpl.mock.calls[1];
        expect(typesUrl).toBe('https://api.github.com/graphql');
        expect(typesInit.method).toBe('POST');
        expect(typesInit.headers.Authorization).toBe('Bearer secret-github-token');
        const request = JSON.parse(typesInit.body);
        expect(request.variables).toEqual({ o0: 'ChipIn-one', n0: 'chipin-frontend' });
        expect(request.query).toContain(
            'i0: issue(number: 540) { issueType { name } state milestone { number title url closed: issues(states: [CLOSED]) { totalCount } all: issues { totalCount } } }',
        );
        expect(request.query).toContain(
            'i1: issue(number: 718) { issueType { name } state milestone {',
        );
        const parsed = parseOutput(outputs.join(''));
        expect(parsed.post).toBe('true');
        expect(parsed.text).toBe(result.text);
        expect(parsed.text).toContain(`*Bug (1):* <${FE}/540|#540>`);
        expect(parsed.text).toContain(`*No type (1):* <${FE}/718|#718>`);
        expect(lines.join('')).not.toContain('secret-github-token');
        expect(parsed.text).not.toContain('Milestone');
    });

    test('the same read gives the milestone line (#919): open Included Issues count as done', async () => {
        const milestone = (closed, total) => ({
            number: 5,
            title: 'Public site',
            url: 'https://github.com/ChipIn-one/chipin-frontend/milestone/5',
            closed: { totalCount: closed },
            all: { totalCount: total },
        });
        const fetchImpl = releaseThen(() =>
            reply(200, {
                data: {
                    r0: {
                        i0: {
                            issueType: { name: 'Bug' },
                            state: 'OPEN',
                            milestone: milestone(3, 10),
                        },
                        i1: {
                            issueType: { name: 'Task' },
                            state: 'CLOSED',
                            milestone: milestone(3, 10),
                        },
                    },
                },
            }),
        );
        const { outputs, options } = collect();
        await main(ENV, { ...options, fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        const text = parseOutput(outputs.join('')).text;
        expect(text).toContain(
            `*Task (1):* <${FE}/718|#718>\n*Milestone:* <https://github.com/ChipIn-one/chipin-frontend/milestone/5|Public site> 4/10 done\nSHA:`,
        );
    });

    test('one request for two repositories maps each alias back; Issues past the read limit and huge numbers are not read', async () => {
        const many = Array.from({ length: 101 }, (_, i) => `ChipIn-one/chipin-frontend#${i + 1}`);
        const releaseBody = body([
            'ChipIn-one/chipin-backend#5',
            ...many,
            'ChipIn-one/chipin-frontend#99999999999',
        ]);
        const fetchImpl = vi.fn(url =>
            url.endsWith('/graphql')
                ? reply(200, {
                      data: {
                          r0: { i0: { issueType: { name: 'Feature' } } },
                          r1: Object.fromEntries(
                              Array.from({ length: 99 }, (_, i) => [
                                  `i${i}`,
                                  { issueType: { name: 'Task' } },
                              ]),
                          ),
                      },
                  })
                : reply(200, { html_url: BASE.releaseUrl, body: releaseBody }),
        );
        const { outputs, options } = collect();
        await main(ENV, { ...options, fetchImpl });
        const request = JSON.parse(fetchImpl.mock.calls[1][1].body);
        expect(request.variables).toEqual({
            o0: 'ChipIn-one',
            n0: 'chipin-backend',
            o1: 'ChipIn-one',
            n1: 'chipin-frontend',
        });
        expect(request.query).toContain(
            'r0: repository(owner: $o0, name: $n0) { i0: issue(number: 5)',
        );
        expect(request.query).toContain('i98: issue(number: 99) {');
        expect(request.query).not.toContain('issue(number: 100)');
        expect(request.query).not.toContain('99999999999');
        expect(JSON.stringify(request)).not.toContain('secret-github-token');
        const text = parseOutput(outputs.join('')).text;
        expect(text).toContain(
            '*Feature (1):* <https://github.com/ChipIn-one/chipin-backend/issues/5|chipin-backend#5>',
        );
        expect(text).toMatch(/\*Task \(99\):\* <[^>]+\|#1> /u);
        expect(text).toMatch(
            /\*No type \(3\):\* <[^>]+\|#100> <[^>]+\|#101> <[^>]+\|#99999999999>/u,
        );
    });

    test('partial GraphQL errors keep the read types and warn on one line', async () => {
        const fetchImpl = releaseThen(() =>
            reply(200, {
                data: { r0: { i0: { issueType: { name: 'Bug' } }, i1: null } },
                errors: [{ type: 'NOT_FOUND', message: 'Could not resolve\n::error::x' }],
            }),
        );
        const { lines, outputs, options } = collect();
        await main(ENV, { ...options, fetchImpl });
        const log = lines.join('');
        expect(log).toContain(
            '::warning::1 Issue(s) without a readable type (NOT_FOUND: Could not resolve ::error::x).',
        );
        expect(log).not.toContain('\n::error::');
        expect(log).not.toContain('secret-github-token');
        const text = parseOutput(outputs.join('')).text;
        expect(text).toContain(`*Bug (1):* <${FE}/540|#540>\n*No type (1):* <${FE}/718|#718>`);
    });

    test('errors with no type but a milestone keep the read: No type group and the milestone line', async () => {
        const fetchImpl = releaseThen(() =>
            reply(200, {
                data: {
                    r0: {
                        i0: {
                            issueType: null,
                            state: 'OPEN',
                            milestone: {
                                number: 7,
                                title: 'Premium',
                                url: 'https://github.com/ChipIn-one/chipin-frontend/milestone/7',
                                closed: { totalCount: 1 },
                                all: { totalCount: 3 },
                            },
                        },
                        i1: null,
                    },
                },
                errors: [{ type: 'NOT_FOUND', message: 'Could not resolve' }],
            }),
        );
        const { outputs, options } = collect();
        await main(ENV, { ...options, fetchImpl });
        const text = parseOutput(outputs.join('')).text;
        expect(text).toContain(`*No type (2):* <${FE}/540|#540> <${FE}/718|#718>`);
        expect(text).toContain(
            '*Milestone:* <https://github.com/ChipIn-one/chipin-frontend/milestone/7|Premium> 2/3 done',
        );
    });

    test('uses GITHUB_GRAPHQL_URL when set', async () => {
        const fetchImpl = releaseThen(() => reply(200, graphql));
        const { options } = collect();
        await main(
            { ...ENV, GITHUB_GRAPHQL_URL: 'https://ghe.example/api/graphql' },
            { ...options, fetchImpl },
        );
        expect(fetchImpl.mock.calls[1][0]).toBe('https://ghe.example/api/graphql');
    });

    test.each([
        ['an HTTP error', () => reply(403, { message: 'Resource not accessible by integration' })],
        ['no data', () => reply(200, { errors: [{ message: 'boom' }] })],
        [
            'only errors',
            () =>
                reply(200, { data: { r0: null }, errors: [{ type: 'FORBIDDEN', message: 'no' }] }),
        ],
        [
            'a network error',
            () => {
                throw new Error('socket hang up');
            },
        ],
    ])(
        'a failed Issue Type read (%s) still posts one ungrouped line',
        async (_name, typesReply) => {
            const fetchImpl = releaseThen(typesReply);
            const { lines, outputs, options } = collect();
            await main(ENV, { ...options, fetchImpl });
            expect(lines.join('')).toContain(
                '::warning::Posting the Issues without Issue Types and milestones',
            );
            const parsed = parseOutput(outputs.join(''));
            expect(parsed.post).toBe('true');
            expect(parsed.text).toContain(`*Issues (2):* <${FE}/540|#540> <${FE}/718|#718>`);
            expect(parsed.text).not.toContain('Milestone');
        },
    );

    test('posts without Included Issues when the Release read fails', async () => {
        const fetchImpl = vi.fn(() => reply(404, {}));
        const { lines, outputs, options } = collect();
        await main(ENV, { ...options, fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(lines.join('')).toContain('::warning::Posting without Included Issues');
        const parsed = parseOutput(outputs.join(''));
        expect(parsed.post).toBe('true');
        expect(parsed.text).toContain('the Release could not be read');
    });

    test('does not read the Release for other outcomes and writes post=false when silent', async () => {
        const fetchImpl = vi.fn();
        const { outputs, options } = collect();
        await main(
            { ...ENV, RELEASE_OUTCOME: 'ALREADY_RELEASED', RELEASE_TAG: 'v1.4.0' },
            { ...options, fetchImpl },
        );
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(parseOutput(outputs.join(''))).toEqual({ text: '', post: 'false' });
    });

    test('an error produces post=false and a warning without throwing', async () => {
        const { lines, outputs, options } = collect();
        const fetchImpl = vi.fn(() => {
            throw new Error('network down');
        });
        let calls = 0;
        const output = text => {
            calls += 1;
            if (calls === 1) throw new Error('disk full');
            outputs.push(text);
        };
        const result = await main(ENV, { ...options, output, fetchImpl });
        expect(result).toEqual({ post: false, text: '' });
        expect(outputs).toEqual(['post=false\n']);
        expect(lines.join('')).toContain('::warning::No Slack release message: disk full.');
    });

    test('a missing GITHUB_OUTPUT is a warning, not a throw', async () => {
        const lines = [];
        const env = { ...ENV, RELEASE_OUTCOME: 'NO_RELEASE', GITHUB_OUTPUT: undefined };
        await expect(main(env, { write: line => lines.push(line) })).resolves.toEqual({
            post: false,
            text: '',
        });
        expect(lines.join('')).toContain('::warning::Could not write GITHUB_OUTPUT');
    });
});

describe('release-notify workflow job', () => {
    const text = readFileSync('.github/workflows/release-on-production.yml', 'utf8');
    const job = parse(text).jobs.notify;
    const message = job.steps.find(step => step.id === 'message');
    const post = job.steps.find(step => step.uses?.includes('slack-notify-action'));

    test('runs after every job once the guard passed, unless cancelled, read-only, bounded', () => {
        expect(job.needs).toEqual(['guard', 'release', 'redeploy']);
        expect(job.if).toBe("${{ !cancelled() && needs.guard.result == 'success' }}");
        expect(job.permissions).toEqual({ contents: 'read', issues: 'read' });
        expect(job['timeout-minutes']).toBe(3);
        for (const step of job.steps) expect(step.run ?? '').not.toContain('${{');
        expect(message.run).toBe('node scripts/release-notify.mjs');
        expect(job.steps.map(step => step.uses?.split('@')[0] ?? step.id)).toEqual([
            'actions/checkout',
            'message',
            'ChipIn-one/.github/automation/slack-notify-action',
        ]);
        expect(message.env.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
        expect(Object.values(message.env).join('\n')).not.toContain('SLACK');
    });

    test('posts through the shared action only when there is a message, never failing the job', () => {
        expect(post.if).toBe("steps.message.outputs.post == 'true'");
        expect(post['continue-on-error']).toBe(true);
        expect(post.uses).toMatch(
            /^ChipIn-one\/\.github\/automation\/slack-notify-action@[0-9a-f]{40}$/u,
        );
        expect(post.with).toEqual({
            'webhook-url': '${{ secrets.SLACK_WEBHOOK_FE_RELEASES }}',
            text: '${{ steps.message.outputs.text }}',
            'timeout-seconds': '10',
        });
    });
});
