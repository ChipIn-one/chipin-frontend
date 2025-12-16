import { useEffect } from 'react';
import { toast } from 'sonner';

import { Spinner } from '@radix-ui/themes';
import { useNetworkState } from '@uidotdev/usehooks';

import { MESSAGES } from 'constants/messages';
import { TOASTS_IDS } from 'constants/toasts';

export const useCheckOnlineStatus = () => {
    const { online } = useNetworkState();

    useEffect(() => {
        // Fired when connection is lost
        if (!online) {
            toast.warning(MESSAGES.warning.common.disconnect, {
                id: TOASTS_IDS.connectionStatus,
                icon: <Spinner size="1" />,
                description: MESSAGES.warning.common.disconnectDescription,
                duration: Infinity,
            });
        } else {
            toast.dismiss(TOASTS_IDS.connectionStatus);
            toast.success(MESSAGES.success.common.reconnected);
        }
    }, [online]);
};
