import { useTranslation } from 'react-i18next';

import { useJoinInviteLink } from 'hooks/useJoinInviteLink';

import { InviteJoinConfirmation } from 'components/invite/InviteJoinConfirmation';

const GroupJoinPage = () => {
    const { t } = useTranslation('group');
    const { status, errorMessage, confirm, cancel } = useJoinInviteLink();

    return (
        <InviteJoinConfirmation
            variant="group"
            status={status}
            errorMessage={errorMessage}
            title={t('join.title')}
            description={t('join.description')}
            confirmLabel={t('join.confirm')}
            cancelLabel={t('join.cancel')}
            retryLabel={t('join.retry')}
            invalidTitle={t('join.invalidTitle')}
            invalidDescription={t('join.invalidDescription')}
            goHomeLabel={t('join.goHome')}
            onConfirm={confirm}
            onCancel={cancel}
        />
    );
};

export { GroupJoinPage };
