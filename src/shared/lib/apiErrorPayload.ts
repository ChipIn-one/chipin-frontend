// The `{ code, details }` of a backend error body. Shared by the legacy `helpers/errors.ts` and
// the `api()` wrapper (`shared/api/client.ts`), which cannot import `helpers`.
export interface ApiErrorPayload {
    code?: string;
    details?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const getApiErrorPayload = (error: unknown): ApiErrorPayload | undefined => {
    const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
    const payload = response?.data;

    if (!isRecord(payload)) {
        return undefined;
    }

    const code = typeof payload.code === 'string' ? payload.code : undefined;
    const details = isRecord(payload.details) ? payload.details : undefined;

    return code || details ? { ...(code && { code }), ...(details && { details }) } : undefined;
};
