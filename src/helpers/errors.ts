import i18n from 'i18next';

type ApiErrorPayload = {
    error?: {
        id?: string;
        params?: Record<string, unknown>;
    };
};

export const resolveApiErrorMessage = (payload?: ApiErrorPayload, fallbackKey = 'api.unknown') => {
    const errorId = payload?.error?.id;
    const params = payload?.error?.params;

    if (errorId) {
        const key = `apiErrors:${errorId}`;
        const translated = i18n.t(key, params);

        if (translated !== key) {
            return translated;
        }
    }

    return i18n.t(`apiErrors:${fallbackKey}`);
};
