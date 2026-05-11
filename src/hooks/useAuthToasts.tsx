import { useEffect } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from 'store/authStore';

export const useAuthToasts = () => {
    const { status, unauthReason: reason } = useAuthStore(
        useShallow(s => ({ status: s.status, unauthReason: s.unauthReason })),
    );

    useEffect(() => {
        if (status !== 'unauthenticated' || !reason) {
            return;
        }

        if (reason === 'expired') {
            toast.warning(i18n.t('toasts:auth.sessionExpired'));
        }

        if (reason === 'invalid') {
            toast.error(i18n.t('toasts:auth.invalidJwt'));
        }
    }, [status, reason]);
};
