import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isUnsentOpsConfirmOn, readSignOutOutboxCount } from 'hooks/unsentOpsConfirm';
import { useAuthStore } from 'store/authStore';

import { BaseAlertDialog } from 'components/modals';

interface Confirm {
    isOpen: boolean;
    /** The unsent operations to delete; null when they could not be counted. */
    count: number | null;
}

interface SignOutConfirm {
    /** The sign-out of a button: asks first while unsent operations would be deleted. */
    requestSignOut: () => void;
    /** The confirm dialog; render it next to the button (null with offline writes off). */
    dialog: ReactNode;
}

/**
 * Spec 03 §1.5 row `signOut()` (03-16a part C), for every sign-out button: with offline writes on,
 * the user's stored outbox is counted first; N > 0 (or a failed count) asks "N unsent operations
 * will be deleted. Sign out?", Cancel keeps everything. Offline writes off: it signs out at once,
 * as before the outbox, and renders no dialog.
 */
export const useSignOutConfirm = (): SignOutConfirm => {
    const { t } = useTranslation('common');
    const signOut = useAuthStore(state => state.signOut);
    const [confirm, setConfirm] = useState<Confirm>({ isOpen: false, count: null });

    const requestSignOut = (): void => {
        if (!isUnsentOpsConfirmOn()) {
            void signOut();
            return;
        }
        void readSignOutOutboxCount().then(count => {
            if (count === 0) {
                return signOut();
            }
            setConfirm({ isOpen: true, count });
            return undefined;
        });
    };

    const dialog = isUnsentOpsConfirmOn() ? (
        <BaseAlertDialog
            isOpened={confirm.isOpen}
            setIsOpened={isOpen => {
                setConfirm(current => ({ ...current, isOpen }));
            }}
            title={t('buttons.signOut')}
            description={
                confirm.count === null
                    ? t('outbox.signOutDescriptionUnknown')
                    : t('outbox.signOutDescription', { count: confirm.count })
            }
            actionLabel={t('buttons.signOut')}
            actionColor="red"
            onAction={signOut}
        />
    ) : null;

    return { requestSignOut, dialog };
};
