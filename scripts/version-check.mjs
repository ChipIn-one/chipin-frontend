import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parseSemVer } from './version-bump.mjs';

const PACKAGE_PATH = resolve(process.cwd(), 'package.json');
const LOCKFILE_PATH = resolve(process.cwd(), 'package-lock.json');

const readJson = filePath => JSON.parse(readFileSync(filePath, 'utf8'));

export const checkVersionConsistency = ({
    packagePath = PACKAGE_PATH,
    lockfilePath = LOCKFILE_PATH,
} = {}) => {
    const packageJson = readJson(packagePath);
    const lockJson = readJson(lockfilePath);
    const packageVersion = packageJson.version;
    const lockRootVersion = lockJson.version;
    const lockVersion = lockJson.packages?.['']?.version;

    parseSemVer(packageVersion);
    parseSemVer(lockRootVersion);
    parseSemVer(lockVersion);

    if (packageVersion !== lockRootVersion || packageVersion !== lockVersion) {
        throw new Error(`package.json (${packageVersion}) and package-lock.json (${lockRootVersion}/${lockVersion}) versions must match.`);
    }

    return packageVersion;
};

const isMainModule = process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
    try {
        console.log(`Version check passed: ${checkVersionConsistency()}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
