import i18n from 'i18next';

type ApiErrorPayload = {
    code?: string;
    details?: Record<string, unknown>;
    error?: {
        id?: string;
        params?: Record<string, unknown>;
    };
};

export const resolveApiErrorMessage = (payload?: ApiErrorPayload, fallbackKey = 'api.unknown') => {
    const errorId = payload?.code ?? payload?.error?.id;
    const params = payload?.details ?? payload?.error?.params;

    if (errorId) {
        const key = `errors:${errorId}`;
        const translated = i18n.t(key, params);

        if (translated !== key) {
            return translated;
        }
    }

    return i18n.t(`errors:${fallbackKey}`);
};
