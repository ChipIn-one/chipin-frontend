import i18n from 'i18next';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { useAuthStore } from 'store/authStore';

export const useAuthToasts = () => {
    const { status, unauthReason: reason } = useAuthStore(store => store);

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
