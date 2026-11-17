import { useTranslation } from 'react-i18next';

import { useJoinInviteLink } from 'hooks/useJoinInviteLink';

import InviteJoinConfirmation from 'components/invite/InviteJoinConfirmation';

const GroupJoinPage = () => {
    const { t } = useTranslation('group');
    const { status, errorMessage, confirm, cancel } = useJoinInviteLink();

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

export default GroupJoinPage;
