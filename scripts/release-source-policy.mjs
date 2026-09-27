import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const MAIN_BRANCH = 'main';
const INTEGRATION_BRANCH = 'dev';

export const evaluateReleaseSource = ({
    baseRef,
    headRef,
    headRepository,
    repository,
}) => {
    if (baseRef !== MAIN_BRANCH) {
        return {
            allowed: true,
            route: 'integration',
        };
    }

    if (headRef === INTEGRATION_BRANCH && headRepository === repository && repository.length > 0) {
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
    const decision = evaluateReleaseSource({
        baseRef: process.env.BASE_REF ?? '',
        headRef: process.env.HEAD_REF ?? '',
        headRepository: process.env.HEAD_REPOSITORY ?? '',
        repository: process.env.THIS_REPOSITORY ?? '',
    });

    if (!decision.allowed) {
        console.error(`RELEASE SOURCE BLOCKED: ${decision.reason}`);
        process.exitCode = 1;
    } else {
        console.log(`Release source accepted via ${decision.route} route.`);
    }
}
