import { useEffect } from 'react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { AUTH_STATUS, UNAUTH_REASON } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

export const useAuthToasts = () => {
    const { status, unauthReason: reason } = useAuthStore(
        useShallow(s => ({ status: s.status, unauthReason: s.unauthReason })),
    );

    useEffect(() => {
        if (status !== AUTH_STATUS.UNAUTHENTICATED || !reason) {
            return;
        }

        if (reason === UNAUTH_REASON.EXPIRED) {
            toast.warning(i18n.t('toasts:auth.sessionExpired'));
        }

        if (reason === UNAUTH_REASON.INVALID) {
            toast.error(i18n.t('toasts:auth.invalidJwt'));
        }

        if (reason === UNAUTH_REASON.PERSISTENCE_ERROR) {
            toast.error(i18n.t('toasts:auth.tokenPersistenceFailed'));
        }
    }, [status, reason]);
};
