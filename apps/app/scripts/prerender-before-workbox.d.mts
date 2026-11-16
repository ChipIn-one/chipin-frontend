// Type contract for the Vite integration's Node ESM runner.
export declare function runPrerenderPublic(): Promise<void>;

export declare function addPublicDirectoryAliases<T extends { url: string }>(
    entries: T[],
): Promise<{ manifest: T[]; warnings: string[] }>;
