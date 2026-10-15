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

// Locate JSON members by their structural path, not by global text matching.
// This allows preserving every byte outside the intended string values.
const skipWhitespace = (source, offset) => {
    while (/\s/u.test(source[offset] ?? '')) offset += 1;
    return offset;
};

const readStringToken = (source, offset) => {
    if (source[offset] !== '"') throw new Error('Expected a JSON string token.');
    const start = offset;
    offset += 1;
    while (offset < source.length) {
        if (source[offset] === '\\') { offset += 2; continue; }
        if (source[offset] === '"') {
            const end = offset + 1;
            return { start, end, value: JSON.parse(source.slice(start, end)) };
        }
        offset += 1;
    }
    throw new Error('Unterminated JSON string.');
};

const skipValue = (source, offset) => {
    if (source[offset] === '"') return readStringToken(source, offset).end;
    if (source[offset] === '{' || source[offset] === '[') {
        const closers = [source[offset] === '{' ? '}' : ']'];
        offset += 1;
        while (closers.length && offset < source.length) {
            if (source[offset] === '"') { offset = readStringToken(source, offset).end; continue; }
            if (source[offset] === '{' || source[offset] === '[') {
                closers.push(source[offset] === '{' ? '}' : ']');
            } else if (source[offset] === closers[closers.length - 1]) {
                closers.pop();
            }
            offset += 1;
        }
        return offset;
    }
    while (offset < source.length && !/[\s,}\]]/u.test(source[offset])) offset += 1;
    return offset;
};

const findMember = (source, objectStart, member) => {
    let offset = skipWhitespace(source, objectStart);
    if (source[offset] !== '{') throw new Error('Expected an object containing ' + JSON.stringify(member) + '.');
    offset += 1;
    let found = null;
    while (true) {
        offset = skipWhitespace(source, offset);
        if (source[offset] === '}') return found;
        const key = readStringToken(source, offset);
        offset = skipWhitespace(source, key.end);
        if (source[offset] !== ':') throw new Error('Invalid JSON member.');
        offset = skipWhitespace(source, offset + 1);
        const end = skipValue(source, offset);
        if (key.value === member) {
            if (found) throw new Error('Duplicate JSON member: ' + member + '.');
            found = { start: offset, end };
        }
        offset = skipWhitespace(source, end);
        if (source[offset] === '}') return found;
        if (source[offset] !== ',') throw new Error('Invalid JSON object separator.');
        offset += 1;
    }
};

const locateMember = (source, path, label) => {
    let range = { start: skipWhitespace(source, 0) };
    for (const key of path) {
        range = findMember(source, range.start, key);
        if (!range) throw new Error(label + ' must contain ' + JSON.stringify(key) + '.');
    }
    return range;
};

const replaceStringValues = (source, replacements, version) => {
    const token = JSON.stringify(version);
    return replacements
        .sort((left, right) => right.start - left.start)
        .reduce((text, range) => text.slice(0, range.start) + token + text.slice(range.end), source);
};

const updatePackageVersionSource = (source, version) => {
    const manifest = JSON.parse(source);
    if (typeof manifest.version !== 'string') throw new Error('package.json must contain a version string.');
    const range = locateMember(source, ['version'], 'package.json');
    if (JSON.parse(source.slice(range.start, range.end)) !== manifest.version) {
        throw new Error('package.json root version could not be located safely.');
    }
    const updated = replaceStringValues(source, [range], version);
    if (JSON.parse(updated).version !== version) throw new Error('package.json version could not be updated safely.');
    return updated;
};

const updateLockVersionSource = (source, version) => {
    const manifest = JSON.parse(source);
    if (typeof manifest.version !== 'string') throw new Error('package-lock.json must contain a root version string.');
    if (typeof manifest.packages?.['']?.version !== 'string') {
        throw new Error('package-lock.json must contain packages[""].version.');
    }
    const root = locateMember(source, ['version'], 'package-lock.json');
    const nested = locateMember(source, ['packages', '', 'version'], 'package-lock.json packages[""]');
    if (JSON.parse(source.slice(root.start, root.end)) !== manifest.version ||
        JSON.parse(source.slice(nested.start, nested.end)) !== manifest.packages[''].version) {
        throw new Error('package-lock.json version fields could not be located safely.');
    }
    const updated = replaceStringValues(source, [root, nested], version);
    const parsed = JSON.parse(updated);
    if (parsed.version !== version || parsed.packages[''].version !== version) {
        throw new Error('package-lock.json versions could not be updated safely.');
    }
    return updated;
};

export const updateManifestVersions = (version, {
    packagePath = PACKAGE_PATH,
    lockfilePath = LOCKFILE_PATH,
} = {}) => {
    parseSemVer(version);
    // Fully validate and prepare both files before writing either one.
    const packageSource = readFileSync(packagePath, 'utf8');
    const lockSource = readFileSync(lockfilePath, 'utf8');
    const nextPackage = updatePackageVersionSource(packageSource, version);
    const nextLock = updateLockVersionSource(lockSource, version);
    writeFileSync(packagePath, nextPackage, 'utf8');
    writeFileSync(lockfilePath, nextLock, 'utf8');
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
