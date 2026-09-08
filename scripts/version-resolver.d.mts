export interface VersionResolverOptions {
    baseVersion?: string;
    branch?: string;
    env?: Record<string, string | undefined>;
    pullRequestHeadSha?: string;
    taskHeadSha?: string;
    commitSha?: string;
    localHeadSha?: string;
    readLocalHeadSha?: () => string;
}

export function resolveAppVersion(options?: VersionResolverOptions): string;
