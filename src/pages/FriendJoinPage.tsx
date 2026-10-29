import { useTranslation } from 'react-i18next';

import { useFriendInviteLink } from 'hooks/useFriendInviteLink';

import InviteJoinConfirmation from 'components/invite/InviteJoinConfirmation';

const FriendJoinPage = () => {
    const { t } = useTranslation('friends');
    const { status, errorMessage, confirm, cancel } = useFriendInviteLink();

    return (
        <InviteJoinConfirmation
            status={status}
            errorMessage={errorMessage}
            title={t('join.title')}
            description={t('join.description')}
            confirmLabel={t('join.confirm')}
            cancelLabel={t('join.cancel')}
            retryLabel={t('join.retry')}
            invalidTitle={t('join.invalidTitle')}
            goHomeLabel={t('join.goHome')}
            onConfirm={confirm}
            onCancel={cancel}
        />
    );
};

export default FriendJoinPage;
