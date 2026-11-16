export interface LocalTags {
    pointsAt: string[];
    all: string[];
}

export interface VersionResolverOptions {
    env?: Record<string, string | undefined>;
    pullRequestHeadSha?: string;
    taskHeadSha?: string;
    commitSha?: string;
    localHeadSha?: string;
    readLocalHeadSha?: () => string;
    readLocalTags?: (sha: string) => LocalTags;
    readRemoteTagRefs?: (repositoryUrl: string) => string;
    warn?: (message: string) => void;
}

export interface AppVersionInfo {
    version: string;
    isRelease: boolean;
    tag: string | null;
}

export function parseRemoteTagRefs(output: string): Map<string, string>;

export function resolveAppVersionInfo(options?: VersionResolverOptions): AppVersionInfo;

export function resolveAppVersion(options?: VersionResolverOptions): string;
