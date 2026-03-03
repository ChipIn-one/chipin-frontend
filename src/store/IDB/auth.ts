import { db } from './db';

export const saveAuthTokenDB = async (token: string) => {
    await db.auth.put({ id: 1, authToken: token });
};

export const getAuthTokenDB = async (): Promise<string | null> => {
    const record = await db.auth.get(1);
    return record?.authToken ?? null;
};

export const deleteAuthTokenDB = async () => {
    await db.auth.delete(1);
};

export type TokenCheckResult =
    | { valid: true }
    | { valid: false; reason: 'missing' | 'expired' | 'invalid' | 'error' };

export const checkTokenValidity = async (): Promise<TokenCheckResult> => {
    const auth = await db.auth.get(1);

    if (!auth?.authToken) {
        return { valid: false, reason: 'missing' };
    }

    try {
        const parts = auth.authToken.split('.');
        if (parts.length < 2) {
            await deleteAuthTokenDB();
            return { valid: false, reason: 'invalid' };
        }

        const payloadBase64 = parts[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson) as { exp?: number };

        if (payload.exp && Date.now() / 1000 >= payload.exp) {
            await deleteAuthTokenDB();
            return { valid: false, reason: 'expired' };
        }

        return { valid: true };
    } catch {
        await deleteAuthTokenDB();
        return { valid: false, reason: 'invalid' };
    }
};
