// Writes the OpenAPI snapshot `openapi/chipin.yaml` with deterministically sorted keys (spec 03 §5.3).
//
// - default: downloads the `openapi-documentation` artifact of the backend CI run for the SHA in
//   `openapi/BACKEND_VERSION` (`gh run download -R ChipIn-one/chipin-backend`). Needs BE-03-4.
// - `--staging`: GET https://api-dev.chipin.one/swagger/documentation.yaml with Basic auth from
//   CHIPIN_CONTRACT_SWAGGER_USER / CHIPIN_CONTRACT_SWAGGER_PASSWORD. CI only (drift report, §5.5):
//   staging is ahead of prod and never a source of types.
//
// Usage: node scripts/api/fetch-openapi.mjs [--staging]
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parse, stringify } from 'yaml';

const repoRoot = resolve(import.meta.dirname, '../..');

export const SNAPSHOT_PATH = 'openapi/chipin.yaml';
export const BACKEND_VERSION_PATH = 'openapi/BACKEND_VERSION';
export const BACKEND_REPO = 'ChipIn-one/chipin-backend';
export const ARTIFACT_NAME = 'openapi-documentation';
export const STAGING_URL = 'https://api-dev.chipin.one/swagger/documentation.yaml';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

const sortKeys = value => {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map(key => [key, sortKeys(value[key])]),
        );
    }

    return value;
};

/** The snapshot text: the parsed document with every map's keys sorted, no anchors, no wrapping. */
export const normalizeOpenApiYaml = text => {
    const document = parse(text);

    if (document === null || typeof document !== 'object' || !('openapi' in document)) {
        throw new Error('the response is not an OpenAPI document (no top-level `openapi` key)');
    }

    return stringify(sortKeys(document), { aliasDuplicateObjects: false, lineWidth: 0 });
};

export const fetchStaging = async ({ env = process.env, fetchImpl = fetch } = {}) => {
    const user = env.CHIPIN_CONTRACT_SWAGGER_USER;
    const password = env.CHIPIN_CONTRACT_SWAGGER_PASSWORD;

    if (!user || !password) {
        throw new Error(
            '--staging needs CHIPIN_CONTRACT_SWAGGER_USER and CHIPIN_CONTRACT_SWAGGER_PASSWORD (CI secrets)',
        );
    }

    const authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
    const response = await fetchImpl(STAGING_URL, { headers: { authorization } });

    if (!response.ok) {
        throw new Error(`GET ${STAGING_URL} failed: HTTP ${response.status}`);
    }

    return response.text();
};

export const readBackendVersion = (root = repoRoot) => {
    const path = join(root, BACKEND_VERSION_PATH);

    if (!existsSync(path)) {
        throw new Error(
            `${BACKEND_VERSION_PATH} is missing: it must hold the backend prod git SHA`,
        );
    }

    const sha = readFileSync(path, 'utf8').trim();

    if (!SHA_PATTERN.test(sha)) {
        throw new Error(`${BACKEND_VERSION_PATH} must hold a full 40-char git SHA, got "${sha}"`);
    }

    return sha;
};

const gh = args =>
    execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export const fetchBackendArtifact = sha => {
    const runs = JSON.parse(
        gh([
            'run',
            'list',
            '-R',
            BACKEND_REPO,
            '--commit',
            sha,
            '--status',
            'success',
            '--json',
            'databaseId',
        ]),
    );
    const directory = mkdtempSync(join(tmpdir(), 'chipin-openapi-'));

    try {
        for (const { databaseId } of runs) {
            try {
                gh([
                    'run',
                    'download',
                    String(databaseId),
                    '-R',
                    BACKEND_REPO,
                    '-n',
                    ARTIFACT_NAME,
                    '-D',
                    directory,
                ]);
            } catch {
                continue;
            }

            const file = readdirSync(directory).find(name => /\.ya?ml$/.test(name));

            if (file) {
                return readFileSync(join(directory, file), 'utf8');
            }
        }
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }

    throw new Error(
        `no successful ${BACKEND_REPO} run for ${sha} has an "${ARTIFACT_NAME}" artifact ` +
            '(it is published by BE-03-4, chipin-backend#201); until then take chipin.yaml from the ' +
            '"OpenAPI drift" workflow artifact',
    );
};

export const main = async (argv = process.argv.slice(2)) => {
    const staging = argv.includes('--staging');
    const text = staging ? await fetchStaging() : fetchBackendArtifact(readBackendVersion());
    const target = join(repoRoot, SNAPSHOT_PATH);

    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, normalizeOpenApiYaml(text));
    process.stdout.write(`wrote ${SNAPSHOT_PATH} (${staging ? 'staging' : 'backend artifact'})\n`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        process.stderr.write(`fetch-openapi: ${error.message}\n`);
        process.exit(1);
    });
}
