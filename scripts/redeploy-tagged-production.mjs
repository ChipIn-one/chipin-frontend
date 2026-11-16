// Redeploys a freshly tagged Vercel Production deployment (ChipIn-one/.github#172).
//
// Promote to Production builds the commit before release-on-production.yml creates its version tag, so that build
// labels itself untagged. After the release engine answers RELEASED, this script redeploys the exact same Vercel
// deployment (same project, same commit) to Production; the new build finds the tag on VERCEL_GIT_COMMIT_SHA and labels
// itself X.Y.Z. It redeploys only while the source is still the project's current Production; after a newer Promote or
// a rollback it skips with a warning and a green run. The redeploy posts its own deployment_status, which reaches the engine as ALREADY_RELEASED and stops.
//
// The tag and the GitHub Release already exist when this runs, so every failure is an `::error::` and a red job: the
// signal to redeploy by hand. It does not wait for READY; the new build reports itself through deployment_status.
// Inputs come only from env. The token is never printed.
import { pathToFileURL } from 'node:url';

export const API = 'https://api.vercel.com';
const SHA = /^[0-9a-f]{40}$/;
const TAG = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const INSPECTOR_HOSTS = new Set(['vercel.com', 'www.vercel.com']);

const CONFIG = {
    VERCEL_TOKEN: 'repository secret VERCEL_TOKEN (a Vercel token with deploy access to the team)',
    VERCEL_TEAM_ID: 'repository variable VERCEL_TEAM_ID (the Vercel team id, team_...)',
    VERCEL_PROJECT_ID: 'repository variable VERCEL_PROJECT_ID (the Vercel project id, prj_...)',
};

// Returns the validated inputs or throws one message that names everything that is missing or malformed.
export function readConfig(env) {
    const problems = [];
    const missing = Object.keys(CONFIG).filter(key => !env[key]);
    if (missing.length > 0)
        problems.push(
            `Missing Vercel configuration, set ${missing.map(key => CONFIG[key]).join('; ')}`,
        );
    if (!SHA.test(env.DEPLOYED_SHA ?? ''))
        problems.push('DEPLOYED_SHA must be a full lowercase 40-character commit SHA');
    if (!TAG.test(env.RELEASE_TAG ?? '')) problems.push('RELEASE_TAG must be a vX.Y.Z tag');
    const urls = [env.DEPLOYMENT_TARGET_URL, env.DEPLOYMENT_ENVIRONMENT_URL].filter(Boolean);
    if (urls.length === 0)
        problems.push('DEPLOYMENT_TARGET_URL or DEPLOYMENT_ENVIRONMENT_URL is required');
    if (problems.length > 0) throw new Error(`${problems.join('. ')}.`);
    return {
        token: env.VERCEL_TOKEN,
        teamId: env.VERCEL_TEAM_ID,
        projectId: env.VERCEL_PROJECT_ID,
        sha: env.DEPLOYED_SHA,
        tag: env.RELEASE_TAG,
        urls,
    };
}

// Maps the deployment_status URLs to the id-or-host that GET /v13/deployments/{idOrUrl} accepts: the host of a
// deployment URL, or `dpl_<id>` for a vercel.com inspector URL (…/<team>/<project>/<id>). First usable URL wins.
export function deploymentRef(urls) {
    for (const value of urls) {
        let url;
        try {
            url = new URL(value);
        } catch {
            continue;
        }
        if (url.protocol !== 'https:') continue;
        if (INSPECTOR_HOSTS.has(url.hostname)) {
            const id = url.pathname.split('/').filter(Boolean).at(-1) ?? '';
            if (
                /^(dpl_)?[A-Za-z0-9]+$/.test(id) &&
                url.pathname.split('/').filter(Boolean).length >= 3
            )
                return id.startsWith('dpl_') ? id : `dpl_${id}`;
            continue;
        }
        return url.hostname;
    }
    throw new Error(
        `No usable Vercel deployment URL in the deployment status (${urls.join(', ')}).`,
    );
}

export const deploymentSha = deployment =>
    deployment?.gitSource?.sha ?? deployment?.meta?.githubCommitSha ?? null;

// Throws unless the source is a Production deployment of this project built from the released commit.
export function validateSource(deployment, { projectId, sha }) {
    const problems = [];
    if (typeof deployment?.id !== 'string' || !deployment.id)
        problems.push('the response has no deployment id');
    if (typeof deployment?.name !== 'string' || !deployment.name)
        problems.push('the response has no deployment name');
    if (deployment?.projectId !== projectId)
        problems.push(
            `project ${deployment?.projectId ?? 'missing'} is not VERCEL_PROJECT_ID ${projectId}`,
        );
    if (deployment?.target !== 'production')
        problems.push(`target ${deployment?.target ?? 'missing'} is not production`);
    const sourceSha = deploymentSha(deployment);
    if (sourceSha !== sha)
        problems.push(`commit ${sourceSha ?? 'missing'} is not the released ${sha}`);
    if (problems.length > 0)
        throw new Error(
            `Refusing to redeploy ${deployment?.id ?? 'the deployment'}: ${problems.join('; ')}.`,
        );
    return deployment;
}

// No `meta`: a custom meta could replace the git meta Vercel copies from the source deployment.
export const redeployBody = (source, { projectId }) => ({
    name: source.name,
    project: projectId,
    deploymentId: source.id,
    target: 'production',
});

// The id of the project's current Production deployment: `targets.production.id` of GET /v9/projects/{id}, or null
// when the field is absent (the caller then lists the newest READY production deployment).
export const currentProductionId = project => project?.targets?.production?.id ?? null;
export const newestProductionId = list => list?.deployments?.[0]?.uid ?? null;

export const redact = (text, token) =>
    token ? String(text).split(token).join('[REDACTED]') : String(text);

const call = (fetchImpl, url, { token, timeoutMs, ...init }) =>
    fetchImpl(url, {
        ...init,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
    }).then(async response => {
        const text = await response.text();
        if (!response.ok)
            throw new Error(
                `${init.method} ${url} returned HTTP ${response.status}: ${redact(text, token).slice(0, 2000)}`,
            );
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(`${init.method} ${url} returned a non-JSON body.`);
        }
    });

export async function redeploy({
    env = process.env,
    fetchImpl = globalThis.fetch,
    timeoutMs = 30000,
} = {}) {
    const config = readConfig(env);
    const ref = deploymentRef(config.urls);
    const team = `teamId=${encodeURIComponent(config.teamId)}`;
    const project = encodeURIComponent(config.projectId);
    const options = { token: config.token, timeoutMs };
    const get = url => call(fetchImpl, url, { ...options, method: 'GET' });
    try {
        const source = validateSource(
            await get(`${API}/v13/deployments/${encodeURIComponent(ref)}?${team}`),
            config,
        );
        // Never overwrite a newer Production: a later Promote or a rollback moved it away from the tagged source.
        let current = currentProductionId(await get(`${API}/v9/projects/${project}?${team}`));
        if (!current)
            current = newestProductionId(
                await get(
                    `${API}/v6/deployments?projectId=${project}&target=production&state=READY&limit=1&${team}`,
                ),
            );
        if (!current)
            throw new Error('Could not read the current Production deployment of the project.');
        if (current !== source.id)
            return { status: 'skipped', source: source.id, current, tag: config.tag };
        const created = await call(fetchImpl, `${API}/v13/deployments?${team}&forceNew=1`, {
            ...options,
            method: 'POST',
            body: JSON.stringify(redeployBody(source, config)),
        });
        const id = created?.id ?? null;
        const createdSha = deploymentSha(created);
        if (createdSha && createdSha !== config.sha)
            throw new Error(
                `The redeploy ${id ?? '(unknown id)'} builds commit ${createdSha}, not the released ${config.sha}; cancel it in Vercel.`,
            );
        return {
            status: 'redeployed',
            source: source.id,
            id,
            url: created?.url ?? null,
            tag: config.tag,
            confirmed: Boolean(createdSha),
        };
    } catch (error) {
        throw new Error(
            redact(error instanceof Error ? error.message : 'Vercel request failed.', config.token),
        );
    }
}

export function main(
    env = process.env,
    { fetchImpl = globalThis.fetch, write = text => process.stdout.write(text) } = {},
) {
    return redeploy({ env, fetchImpl }).then(result => {
        if (result.status === 'skipped') {
            write(
                `::warning::Skipping redeploy: Production moved to ${result.current} since ${result.source} was promoted (a newer Promote or a rollback); ${result.tag} stays without an in-app version until its next Promote.\n`,
            );
            return result;
        }
        write(
            `Redeployed ${result.source} to Production as ${result.id ?? 'unknown id'} (${result.url ? `https://${result.url}` : 'no URL returned'}).\n`,
        );
        if (!result.confirmed)
            write(
                `::notice::The Vercel response has no commit SHA, so the commit of ${result.id ?? 'the redeploy'} could not be confirmed.\n`,
            );
        write(
            `::notice::Redeploying Production for ${result.tag} so the build labels itself with the tag.\n`,
        );
        return result;
    });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    main().catch(error => {
        const message = redact(
            error instanceof Error
                ? error.message
                : 'Redeploying the tagged Production deployment failed.',
            process.env.VERCEL_TOKEN,
        );
        process.stdout.write(
            `::error::${message} Redeploy the Production deployment by hand in Vercel.\n`,
        );
        process.exitCode = 1;
    });
}
