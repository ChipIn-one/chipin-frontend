// The one source of the GitHub Deployment environment names that belong to the app's Vercel project
// (chipin-frontend#801, spec 04 §1.5). With one Vercel project connected to this repository Vercel writes `Production`
// and `Preview`; once a second project (`chipin-site`) is connected it writes `Production – <project>` and
// `Preview – <project>` (U+2013 EN DASH between spaces) for each project. Release automation must match the app's names
// in both forms and never the site's (`Production – chipin-site`, `Preview – chipin-site`).
//
// Scripts call `isAppEnvironment`/`appEnvironmentNames`; workflow `if:` expressions embed `appEnvironmentCondition`,
// and scripts/deployment-environments.test.mjs fails when a workflow's condition drifts from this list.

/** The Vercel project name of the app (the project whose Root Directory is `apps/app`). */
export const APP_VERCEL_PROJECT = 'chipin-frontend';

const SEPARATOR = ' – ';

/** @type {Readonly<Record<'Production' | 'Preview', readonly string[]>>} */
export const APP_ENVIRONMENTS = Object.freeze({
    Production: Object.freeze(['Production', `Production${SEPARATOR}${APP_VERCEL_PROJECT}`]),
    Preview: Object.freeze(['Preview', `Preview${SEPARATOR}${APP_VERCEL_PROJECT}`]),
});

const assertKind = kind => {
    if (kind !== 'Production' && kind !== 'Preview')
        throw new Error(`Unknown deployment kind ${String(kind)}; expected Production or Preview.`);
    return kind;
};

/** The environment names of the app for `kind`, the unsuffixed name first. */
export const appEnvironmentNames = kind => APP_ENVIRONMENTS[assertKind(kind)];

/** True when `environment` is one of the app's names for `kind` (exact, case-sensitive). */
export const isAppEnvironment = (kind, environment) =>
    typeof environment === 'string' && appEnvironmentNames(kind).includes(environment);

/**
 * The GitHub Actions expression that is true for the app's environments of `kind`, for a `deployment_status` event.
 * Embedded verbatim in workflow `if:` and `concurrency.group` expressions.
 */
export const appEnvironmentCondition = kind =>
    `contains(fromJSON('${JSON.stringify(appEnvironmentNames(kind))}'), github.event.deployment.environment)`;
