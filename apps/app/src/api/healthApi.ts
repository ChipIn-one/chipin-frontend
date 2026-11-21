// The health probe lives in `shared/api/health.ts`; legacy callers keep this path.
export { type BackendHealth, BackendHealthCheckError, probeBackendHealth } from 'shared/api/health';
