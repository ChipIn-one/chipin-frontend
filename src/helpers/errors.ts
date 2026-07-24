import i18n from 'i18next';

export interface ApiErrorPayload {
    code?: string;
    details?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const resolveApiErrorMessage = (payload?: unknown, fallbackKey = 'api.unknown') => {
    if (!isRecord(payload) || typeof payload.code !== 'string') {
        return i18n.t(`errors:${fallbackKey}`);
    }

    const message = i18n.t(`errors:apiErrors.${payload.code}`);

    if (!isRecord(payload.details)) {
        return message;
    }

    const detailsMessage = Object.values(payload.details)
        .filter((value): value is string => typeof value === 'string' && Boolean(value))
        .join(', ');

    return detailsMessage ? `${message}, ${detailsMessage}` : message;
};

export const isUnauthorizedApiError = (error: unknown): boolean => {
    return getApiErrorStatus(error) === 401;
};

export const getApiErrorStatus = (error: unknown): number | undefined => {
    if (!isRecord(error) || error.isAxiosError !== true || !isRecord(error.response)) {
        return undefined;
    }

    const { status } = error.response;

    return typeof status === 'number' ? status : undefined;
};

export const isNetworkApiError = (error: unknown): boolean => {
    return (
        isRecord(error) &&
        error.isAxiosError === true &&
        error.response === undefined
    );
};
