// Forwards a successful vercel[bot] Production deployment to the org completion sweep
// (ChipIn-one/.github .github/workflows/frontend-production-completion.yml) as one repository_dispatch
// `frontend-production-deployed` (chipin-frontend#559, ChipIn-one/.github#228).
//
// The payload is only a hint: the sweep runs trusted .github master code and re-reads the Vercel Production receipt
// itself. A missing token or a failed POST is a warning and a green run, because the sweep schedule stays the
// fallback. This script writes nothing in this repository.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const DISPATCH_URL = 'https://api.github.com/repos/ChipIn-one/.github/dispatches';
export const EVENT_TYPE = 'frontend-production-deployed';
export const TOKEN_ENV = 'CHIPIN_COMPLETION_DISPATCH_TOKEN';
const ENVIRONMENT = 'Production';
const CREATOR = 'vercel[bot]';
const SHA = /^[0-9a-f]{40}$/;

// Returns the hint to forward, `null` when the event is not a successful vercel[bot] Production deployment (the
// workflow `if:` already filters these; this is the second check), or throws on a malformed id or SHA.
export function readHint(event) {
    const deployment = event?.deployment;
    if (deployment?.environment !== ENVIRONMENT || event?.deployment_status?.state !== 'success'
        || deployment?.creator?.login !== CREATOR) return null;
    const id = deployment.id;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('deployment.id must be a positive integer.');
    if (typeof deployment.sha !== 'string' || !SHA.test(deployment.sha)) {
        throw new Error('deployment.sha must be a full lowercase 40-character commit SHA.');
    }
    return { deployment_id: id, sha: deployment.sha };
}

const warning = (hint, reason) => ({ status: 'warning', hint, reason: `${reason}; the org sweep schedule is the fallback.` });

export function forward({ env = process.env, event, fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
    let hint;
    try {
        hint = readHint(event);
    } catch (error) {
        return Promise.reject(error);
    }
    if (!hint) return Promise.resolve({ status: 'skipped', reason: 'Not a successful vercel[bot] Production deployment; nothing sent.' });
    const token = env[TOKEN_ENV];
    if (!token) return Promise.resolve(warning(hint, `${TOKEN_ENV} is not set, no dispatch sent`));
    return Promise.resolve()
        .then(() => fetchImpl(DISPATCH_URL, {
            method: 'POST',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ event_type: EVENT_TYPE, client_payload: hint }),
            signal: AbortSignal.timeout(timeoutMs),
        }))
        .then(response => (response.status === 204
            ? { status: 'sent', hint, reason: `Sent ${EVENT_TYPE} for deployment ${hint.deployment_id} (${hint.sha}).` }
            : warning(hint, `Dispatch returned HTTP ${response.status}`)))
        .catch(error => warning(hint, `Dispatch request failed (${error instanceof Error ? error.name : 'request error'})`));
}

export function main(env = process.env, { fetchImpl = globalThis.fetch, write = text => process.stdout.write(text) } = {}) {
    if (!env.GITHUB_EVENT_PATH) return Promise.reject(new Error('GITHUB_EVENT_PATH is required.'));
    return readFile(env.GITHUB_EVENT_PATH, 'utf8')
        .then(JSON.parse)
        .then(event => forward({ env, event, fetchImpl }))
        .then(result => {
            write(result.status === 'warning' ? `::warning::${result.reason}\n` : `${result.reason}\n`);
            return result;
        });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().catch(error => {
        process.stdout.write(`::error::${error instanceof Error ? error.message : 'Forwarding the Production deployment failed.'}\n`);
        process.exitCode = 1;
    });
}
