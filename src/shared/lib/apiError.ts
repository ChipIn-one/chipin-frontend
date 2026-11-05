// Backend error bodies, shared by the legacy `helpers/errors.ts` and the `api()` wrapper
// (`shared/api/client.ts`), which cannot import `helpers`.
export interface ApiErrorPayload {
    code?: string;
    details?: Record<string, unknown>;
}

/** A backend error response from `api()`. `details`/`current` keep the wire shape (`WireAmount`). */
export class ApiError extends Error {
    override readonly name = 'ApiError';
    readonly status: number;
    readonly code: string | undefined;
    readonly details: Record<string, unknown> | undefined;
    /** Only for a 409 `LEDGER.VERSION_CONFLICT`: the body's `current`. */
    // TODO(ChipIn-one/chipin-backend#199): parse with the zod `LedgerConflictResponseSchema` (BE-03-1).
    readonly current?: unknown;
    /** The Axios error (the ES2022 `cause`, which the target lib does not type yet). */
    readonly cause: unknown;

    constructor(init: {
        status: number;
        payload: ApiErrorPayload | undefined;
        current?: unknown;
        cause: unknown;
    }) {
        super(`API request failed with status ${init.status}`);
        this.status = init.status;
        this.code = init.payload?.code;
        this.details = init.payload?.details;
        this.cause = init.cause;
        if (init.current !== undefined) {
            this.current = init.current;
        }
    }
}

/** A 2xx response whose body is still text: it was not valid JSON (every 2xx body is JSON). */
export class ApiResponseFormatError extends Error {
    override readonly name = 'ApiResponseFormatError';
    readonly status: number;

    constructor(status: number) {
        super(`API response with status ${status} is not valid JSON`);
        this.status = status;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/** `{ code, details }` of an `ApiError` or of an Axios-like error's response body. */
export const getApiErrorPayload = (error: unknown): ApiErrorPayload | undefined => {
    if (error instanceof ApiError) {
        const { code, details } = error;

        return code || details ? { ...(code && { code }), ...(details && { details }) } : undefined;
    }
    const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
    const payload = response?.data;

    if (!isRecord(payload)) {
        return undefined;
    }

    const code = typeof payload.code === 'string' ? payload.code : undefined;
    const details = isRecord(payload.details) ? payload.details : undefined;

    return code || details ? { ...(code && { code }), ...(details && { details }) } : undefined;
};
