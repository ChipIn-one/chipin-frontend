import { toast } from 'sonner';

import { MESSAGES } from 'constants/messages';

import { db } from './db';

export const saveAuthTokenDB = async (token: string) => {
    await db.auth.put({ id: 1, authToken: token }); // put = insert or update
};

export const getAuthTokenDB = async (): Promise<string | null> => {
    const record = await db.auth.get(1);
    return record?.authToken ?? null;
};

export const deleteAuthTokenDB = async () => {
    await db.auth.delete(1);
};

export const checkAndRemoveExpiredToken = async (): Promise<boolean> => {
    const auth = await db.auth.toCollection().first();
    if (!auth || !auth.authToken) {
        return false;
    }

    try {
        const [, payloadBase64] = auth.authToken.split('.');
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);

        if (payload.exp && Date.now() / 1000 >= payload.exp) {
            console.warn('JWT expired, removing from DB');
            toast.warning(MESSAGES.error.auth.SESSION_EXPIRED);
            await db.auth.clear();
            return false;
        }

        return true;
    } catch (err) {
        console.error('Invalid JWT format:', err);
        toast.error(MESSAGES.error.auth.INVALID_JWT);
        await db.auth.clear();
        return false;
    }
};
