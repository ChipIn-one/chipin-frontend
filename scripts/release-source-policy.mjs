import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const MAIN_BRANCH = 'main';
const INTEGRATION_BRANCH = 'dev';

// Match GitHub closing verbs only when followed by an Issue reference. The
// conservative Markdown wrappers and comma/and chains prevent body formatting
// from bypassing the gate; unrelated links and non-closing references are safe.
const ISSUE_REFERENCE = String.raw`(?:https:\/\/github\.com\/[a-z\d_.-]+\/[a-z\d_.-]+\/issues\/\d+|[a-z\d_.-]+\/[a-z\d_.-]+#\d+|#\d+)`;
const MARKDOWN_REFERENCE = String.raw`[\x60*_\[]*${ISSUE_REFERENCE}[\x60*_\]]*`;
const CLOSING_REFERENCE_PATTERN = new RegExp(
    String.raw`\b(?:close(?:s|d)?|fix(?:es|ed)?|resolve(?:s|d)?)\b(?:\s+|\s*:\s*)${MARKDOWN_REFERENCE}`
        + String.raw`(?:(?:\s*,\s*|\s+and\s+)${MARKDOWN_REFERENCE})*`,
    'giu',
);
const ISSUE_TOKEN_PATTERN = new RegExp(ISSUE_REFERENCE, 'giu');

const isLocalIssueReference = (reference, repository) => {
    if (reference.startsWith('#')) {
        return true;
    }

    const qualified = /^https:\/\/github\.com\//iu.test(reference)
        ? reference.replace(/^https:\/\/github\.com\//iu, '').split(/\/issues\//iu)[0]
        : reference.split('#')[0];

    return qualified.toLowerCase() === repository.toLowerCase();
};

export const findUnsafeReleaseIssueReference = (body, repository) => {
    // A missing body is valid (an empty release description cannot auto-close).
    if (typeof body !== 'string' || repository.length === 0) {
        return null;
    }

    for (const closing of body.matchAll(CLOSING_REFERENCE_PATTERN)) {
        for (const token of closing[0].matchAll(ISSUE_TOKEN_PATTERN)) {
            if (isLocalIssueReference(token[0], repository)) {
                return {
                    line: body.slice(0, closing.index).split('\n').length,
                    reference: token[0],
                };
            }
        }
    }

    return null;
};

export const evaluateReleaseSource = ({
    baseRef,
    headRef,
    headRepository,
    repository,
    body = '',
}) => {
    if (baseRef !== MAIN_BRANCH) {
        return {
            allowed: true,
            route: 'integration',
        };
    }

    if (headRef === INTEGRATION_BRANCH && headRepository === repository && repository.length > 0) {
        const unsafeReference = findUnsafeReleaseIssueReference(body, repository);

        if (unsafeReference) {
            return {
                allowed: false,
                route: 'blocked',
                reason: `Release PR body line ${unsafeReference.line} contains a GitHub closing keyword `
                    + `with local Issue reference ${unsafeReference.reference}. `
                    + 'Replace it with a plain Issue link/reference (for example, "Includes #123"). '
                    + 'Frontend production completion alone must close completed Issues.',
            };
        }

        return {
            allowed: true,
            route: 'release',
        };
    }

    return {
        allowed: false,
        route: 'blocked',
        reason: 'PRs to main must originate from the repository dev branch. '
            + 'Dependabot security updates are not a direct-main exception; integrate the reviewed fix through dev. '
            + 'See docs/dependabot-security-updates.md.',
    };
};

const isMainModule = process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
    // Fail closed when workflow wiring forgets to supply the PR body.
    if (process.env.BASE_REF === MAIN_BRANCH && process.env.PR_BODY === undefined) {
        console.error('RELEASE SOURCE BLOCKED: PR_BODY is missing from the main-target PR CI environment.');
        process.exitCode = 1;
    } else {
        const decision = evaluateReleaseSource({
            baseRef: process.env.BASE_REF ?? '',
            headRef: process.env.HEAD_REF ?? '',
            headRepository: process.env.HEAD_REPOSITORY ?? '',
            repository: process.env.THIS_REPOSITORY ?? '',
            body: process.env.PR_BODY ?? '',
        });

        if (!decision.allowed) {
            console.error(`RELEASE SOURCE BLOCKED: ${decision.reason}`);
            process.exitCode = 1;
        } else {
            console.log(`Release source accepted via ${decision.route} route.`);
        }
    }
}
