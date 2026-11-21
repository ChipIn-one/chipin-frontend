// The client version gate lives in `shared/api/clientVersion.ts`; legacy callers keep this path.
export {
    CLIENT_VERSION_HEADER,
    isVersionBelowMinimum,
    MIN_CLIENT_VERSION_HEADER,
    parseVersionCore,
} from 'shared/api/clientVersion';
