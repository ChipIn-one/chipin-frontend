import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const PACKAGE_PATH = resolve(process.cwd(), 'package.json');
const LOCKFILE_PATH = resolve(process.cwd(), 'package-lock.json');
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const VERSION_IMPACTS = Object.freeze(['none', 'patch', 'minor', 'major']);

export const isVersionImpact = value => VERSION_IMPACTS.includes(value);

export const parseSemVer = version => {
    if (typeof version !== 'string') {
        throw new Error('Invalid SemVer: expected a string.');
    }

    const match = VERSION_PATTERN.exec(version);

    if (!match) {
        throw new Error(`Invalid SemVer: ${version}`);
    }

    const [major, minor, patch] = match.slice(1).map(Number);

    if (![major, minor, patch].every(Number.isSafeInteger)) {
        throw new Error(`Invalid SemVer: ${version}`);
    }

    return { major, minor, patch };
};

export const bumpVersion = (version, impact) => {
    const parsedVersion = parseSemVer(version);

    if (!isVersionImpact(impact)) {
        throw new Error(`Unsupported version impact: ${impact}`);
    }

    if (impact === 'none') {
        return version;
    }

    if (impact === 'patch') {
        return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch + 1}`;
    }

    if (impact === 'minor') {
        return `${parsedVersion.major}.${parsedVersion.minor + 1}.0`;
    }

    if (parsedVersion.major === 0) {
        throw new Error('Automatic major bump from 0.x.y to 1.0.0 is forbidden; 1.0.0 requires an explicit release decision.');
    }

    return `${parsedVersion.major + 1}.0.0`;
};

const readJson = filePath => JSON.parse(readFileSync(filePath, 'utf8'));

const readManifestVersions = ({
    packagePath = PACKAGE_PATH,
    lockfilePath = LOCKFILE_PATH,
} = {}) => {
    const packageJson = readJson(packagePath);
    const lockJson = readJson(lockfilePath);

    if (typeof packageJson.version !== 'string') {
        throw new Error('package.json must contain a version string.');
    }

    if (typeof lockJson.version !== 'string') {
        throw new Error('package-lock.json must contain a root version string.');
    }

    if (typeof lockJson.packages?.['']?.version !== 'string') {
        throw new Error('package-lock.json must contain packages[""].version.');
    }

    return {
        packageVersion: packageJson.version,
        lockRootVersion: lockJson.version,
        lockVersion: lockJson.packages[''].version,
    };
};

const writeJson = (filePath, value, indentation) => {
    writeFileSync(filePath, `${JSON.stringify(value, null, indentation)}\n`, 'utf8');
};

export const updateManifestVersions = (version, {
    packagePath = PACKAGE_PATH,
    lockfilePath = LOCKFILE_PATH,
} = {}) => {
    parseSemVer(version);

    const packageJson = readJson(packagePath);
    const lockJson = readJson(lockfilePath);

    packageJson.version = version;

    if (typeof lockJson.version !== 'string' || !lockJson.packages?.['']) {
        throw new Error('package-lock.json must contain packages[""].');
    }

    lockJson.version = version;
    lockJson.packages[''].version = version;
    writeJson(packagePath, packageJson, 4);
    writeJson(lockfilePath, lockJson, 2);
};

export const runVersionBump = (impact, {
    packagePath = PACKAGE_PATH,
    lockfilePath = LOCKFILE_PATH,
} = {}) => {
    if (!isVersionImpact(impact)) {
        throw new Error(`Unsupported version impact: ${impact}`);
    }

    const { packageVersion, lockRootVersion, lockVersion } = readManifestVersions({ packagePath, lockfilePath });
    parseSemVer(packageVersion);
    parseSemVer(lockRootVersion);
    parseSemVer(lockVersion);

    if (packageVersion !== lockRootVersion || packageVersion !== lockVersion) {
        throw new Error(`package.json (${packageVersion}) and package-lock.json (${lockRootVersion}/${lockVersion}) versions must match.`);
    }

    const nextVersion = bumpVersion(packageVersion, impact);

    if (impact === 'none') {
        return nextVersion;
    }

    updateManifestVersions(nextVersion, { packagePath, lockfilePath });
    return nextVersion;
};

const isMainModule = process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
    const impact = process.argv[2];

    try {
        const nextVersion = runVersionBump(impact);
        console.log(impact === 'none' ? `Version unchanged: ${nextVersion}` : `Version bumped to ${nextVersion}`);
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}
