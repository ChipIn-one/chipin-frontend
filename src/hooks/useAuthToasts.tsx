import { useEffect } from 'react';
import { toast } from 'sonner';

import { MESSAGES } from 'constants/messages';
import { useAuthStore } from 'store/authStore';

export const useAuthToasts = () => {
    const { status, unauthReason: reason } = useAuthStore(store => store);

    useEffect(() => {
        if (status !== 'unauthenticated' || !reason) {
            return;
        }

        if (reason === 'expired') {
            toast.warning(MESSAGES.error.auth.SESSION_EXPIRED);
        }

        if (reason === 'invalid') {
            toast.error(MESSAGES.error.auth.INVALID_JWT);
        }
    }, [status, reason]);
};
