import i18n from 'i18next';

export interface ApiErrorPayload {
    code?: string;
    details?: Record<string, unknown>;
}

export interface RequestError extends ApiErrorPayload {
    message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const getApiErrorResponse = (error: unknown): Record<string, unknown> | undefined => {
    return isRecord(error) && isRecord(error.response) ? error.response : undefined;
};

export const getApiErrorPayload = (error: unknown): ApiErrorPayload | undefined => {
    const payload = getApiErrorResponse(error)?.data;

    if (!isRecord(payload)) {
        return undefined;
    }

    const code = typeof payload.code === 'string' ? payload.code : undefined;
    const details = isRecord(payload.details) ? payload.details : undefined;

    return code || details ? { ...(code && { code }), ...(details && { details }) } : undefined;
};

const getErrorMessage = (error: unknown): string | undefined => {
    return isRecord(error) && typeof error.message === 'string' ? error.message : undefined;
};

const resolveApiErrorPayloadMessage = (payload: unknown, fallbackMessage: string): string => {
    if (!isRecord(payload) || typeof payload.code !== 'string') {
        return fallbackMessage;
    }

    const messageKey = `errors:apiErrors.${payload.code}`;
    const message = i18n.exists(messageKey) ? i18n.t(messageKey) : fallbackMessage;

    if (!isRecord(payload.details)) {
        return message;
    }

    const details: string[] = [];

    for (const field in payload.details) {
        if (!Object.prototype.hasOwnProperty.call(payload.details, field)) {
            continue;
        }

        const value = payload.details[field];

        if (typeof value === 'string' && value) {
            details.push(value);
        }
    }

    const detailsMessage = details.join(', ');

    return detailsMessage ? `${message}, ${detailsMessage}` : message;
};

export const resolveApiErrorMessage = (
    payload?: unknown,
    fallbackKey = 'api.unknown',
): string => {
    return resolveApiErrorPayloadMessage(payload, i18n.t(`errors:${fallbackKey}`));
};

export const resolveApiErrorMessageFromError = (
    error: unknown,
    fallbackMessage: string,
): string => {
    return resolveApiErrorPayloadMessage(getApiErrorPayload(error), fallbackMessage);
};

export const normalizeApiError = (error: unknown): RequestError => {
    const response = getApiErrorResponse(error);
    const payload = getApiErrorPayload(error);
    const defaultMessage = i18n.t('toasts:common.requestFailed', {
        defaultValue: 'Request failed',
    });
    const fallbackMessage = response === undefined
        ? (getErrorMessage(error) ?? defaultMessage)
        : defaultMessage;

    return {
        ...(payload ?? {}),
        message: resolveApiErrorPayloadMessage(payload, fallbackMessage),
    };
};

export const isUnauthorizedApiError = (error: unknown): boolean => {
    return getApiErrorStatus(error) === 401;
};

export const getApiErrorStatus = (error: unknown): number | undefined => {
    if (!isRecord(error) || error.isAxiosError !== true) {
        return undefined;
    }

    const status = getApiErrorResponse(error)?.status;

    return typeof status === 'number' ? status : undefined;
};

export const isNetworkApiError = (error: unknown): boolean => {
    return (
        isRecord(error) &&
        error.isAxiosError === true &&
        getApiErrorResponse(error) === undefined
    );
};
