import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, test, vi } from 'vitest';

import {
    compareTags,
    decideMessage,
    escapeMrkdwn,
    includedIssues,
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
};
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
        expect(text).toContain('*Included Issues*');
        expect(text).toContain(
            '• <https://github.com/ChipIn-one/chipin-frontend/issues/540|ChipIn-one/chipin-frontend#540> (#721)',
        );
        expect(text).toContain(
            '• <https://github.com/ChipIn-one/chipin-frontend/issues/718|ChipIn-one/chipin-frontend#718> (#728, #730)',
        );
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
        expect(text).toContain('• &lt;!here&gt; &amp; Owner/repo#1 &lt;x&gt;');
        expect(text).toContain('• <https://github.com/Owner/repo/issues/2|Owner/repo#2> &lt;b&gt;');
        expect(text).not.toContain('<!here>');
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

    test('caps a long Included Issues list', () => {
        const body = `## Included Issues\n${Array.from({ length: 35 }, (_, i) => `- O/r#${i + 1}`).join('\n')}`;
        const { text } = decide({ releaseBody: body });
        expect(text).toContain('• and 5 more');
        expect(text).not.toContain('O/r#31');
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

describe('release-notify main', () => {
    test('reads the Release with GITHUB_TOKEN and writes text and post=true', async () => {
        const fetchImpl = vi.fn(() =>
            reply(200, { html_url: BASE.releaseUrl, body: BASE.releaseBody }),
        );
        const { lines, outputs, options } = collect();
        const result = await main(ENV, { ...options, fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe(
            'https://api.github.com/repos/ChipIn-one/chipin-frontend/releases/tags/v1.5.0',
        );
        expect(init.headers.Authorization).toBe('Bearer secret-github-token');
        const parsed = parseOutput(outputs.join(''));
        expect(parsed.post).toBe('true');
        expect(parsed.text).toBe(result.text);
        expect(parsed.text).toContain('ChipIn-one/chipin-frontend#540');
        expect(lines.join('')).not.toContain('secret-github-token');
    });

    test('posts without Included Issues when the Release read fails', async () => {
        const fetchImpl = vi.fn(() => reply(404, {}));
        const { lines, outputs, options } = collect();
        await main(ENV, { ...options, fetchImpl });
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
        expect(job.permissions).toEqual({ contents: 'read' });
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
