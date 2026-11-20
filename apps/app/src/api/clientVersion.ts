// The client version gate (spec 03 row 03-20, KB API-001…API-005): every request names the build in
// `X-Client-Version`; the backend answers 426 `CLIENT.OUTDATED` or sends `X-Min-Client-Version` when a
// minimum is configured. Versions are compared only by the numeric semver core `major.minor.patch`.

export const CLIENT_VERSION_HEADER = 'X-Client-Version';
export const MIN_CLIENT_VERSION_HEADER = 'X-Min-Client-Version';

type VersionCore = readonly [number, number, number];

const VERSION_CORE_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * The `major.minor.patch` core of a version; everything from the first `-` is dropped
 * (`1.2.0-dev-abc1234` → `[1, 2, 0]`). `null` when the core is not three numeric fields.
 */
export const parseVersionCore = (value: string): VersionCore | null => {
    const suffixStart = value.indexOf('-');
    const core = (suffixStart === -1 ? value : value.slice(0, suffixStart)).trim();
    const match = VERSION_CORE_PATTERN.exec(core);

    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * Whether `minVersion` is above `clientVersion`, field by field and numerically (`1.10.0` > `1.9.0`).
 * An unparseable side never reports the client as outdated.
 */
export const isVersionBelowMinimum = (clientVersion: string, minVersion: string): boolean => {
    const client = parseVersionCore(clientVersion);
    const minimum = parseVersionCore(minVersion);

    if (!client || !minimum) {
        return false;
    }
    if (minimum[0] !== client[0]) {
        return minimum[0] > client[0];
    }
    if (minimum[1] !== client[1]) {
        return minimum[1] > client[1];
    }

    return minimum[2] > client[2];
};
