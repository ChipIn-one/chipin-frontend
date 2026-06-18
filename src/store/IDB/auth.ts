import { db } from './db';

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export const saveAuthTokensDB = async ({ accessToken, refreshToken }: AuthTokens) => {
    await db.auth.put({ id: 1, accessToken, refreshToken });
};

export const getAccessTokenDB = async (): Promise<string | null> => {
    const record = await db.auth.get(1);
    return record?.accessToken ?? null;
};

export const deleteAuthTokensDB = async () => {
    await db.auth.delete(1);
};

export type TokenCheckResult =
    | { valid: true }
    | { valid: false; reason: 'missing' | 'expired' | 'invalid' | 'error' };

export const checkTokenValidity = async (): Promise<TokenCheckResult> => {
    const auth = await db.auth.get(1);

    if (!auth?.accessToken || !auth.refreshToken) {
        return { valid: false, reason: 'missing' };
    }

    try {
        const parts = auth.accessToken.split('.');
        if (parts.length < 2) {
            await deleteAuthTokensDB();
            return { valid: false, reason: 'invalid' };
        }

        const payloadBase64 = parts[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson) as { exp?: number };

        if (payload.exp && Date.now() / 1000 >= payload.exp) {
            await deleteAuthTokensDB();
            return { valid: false, reason: 'expired' };
        }

        return { valid: true };
    } catch {
        await deleteAuthTokensDB();
        return { valid: false, reason: 'invalid' };
    }
};
