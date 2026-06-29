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
