import { PROP_COLOR } from '@chipin/tokens/theme';
import { useTranslation } from 'react-i18next';

import { useAccountSwitchConfirmStore } from 'store/accountSwitchConfirmStore';

import { BaseAlertDialog } from 'components/modals';

/**
 * The account-switch dialog of spec 03 §1.5 (03-16a part C), shown by the tab that signs Y in over
 * X's unsent operations: "Delete and sign in" deletes X's data and goes on, Cancel signs Y out and
 * keeps X's data. Mounted by the OAuth callback page only with offline writes on.
 */
export const AccountSwitchDialog = () => {
    const { t } = useTranslation('common');
    const request = useAccountSwitchConfirmStore(state => state.request);
    const answer = useAccountSwitchConfirmStore(state => state.answer);
    const count = request?.count ?? null;

    return (
        <BaseAlertDialog
            isOpened={request !== null}
            setIsOpened={isOpen => {
                // Closing it any other way (Cancel, the overlay) is the Cancel answer.
                if (!isOpen && useAccountSwitchConfirmStore.getState().request !== null) {
                    answer(false);
                }
            }}
            title={t('outbox.accountSwitchTitle')}
            description={
                count === null
                    ? t('outbox.accountSwitchDescriptionUnknown')
                    : t('outbox.accountSwitchDescription', { count })
            }
            actionLabel={t('outbox.accountSwitchConfirm')}
            actionColor={PROP_COLOR.danger}
            onAction={() => {
                answer(true);
                return Promise.resolve();
            }}
        />
    );
};
