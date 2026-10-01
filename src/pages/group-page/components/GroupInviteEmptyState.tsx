import { useTranslation } from 'react-i18next';

import type { Group } from 'api/chipin.types';
import { useGroupInvite } from 'hooks/pwaHooks';

import { InviteEmptyState } from 'components/invite';

import GroupInviteActionRows from './GroupInviteActionRows';

interface Props {
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const {
        isNativeShareSupported,
        onShare,
        onCopyLink,
    } = useGroupInvite(group);
    const shareContent = {
        title: t('qr.shareTitle', { groupName: group.name }),
        text: t('qr.shareText', { groupName: group.name }),
    };

    return (
        <InviteEmptyState
            title={t('page.expenses.inviteTitle')}
            description={t('page.expenses.inviteDescription')}
            actionLabel={t('page.expenses.inviteAction')}
            shareViaLabel={t('page.expenses.shareVia')}
            isNativeShareSupported={isNativeShareSupported}
            onShare={onShare}
            onCopyLink={onCopyLink}
            shareContent={shareContent}
            actionRows={<GroupInviteActionRows group={group} />}
        />
    );
};

export default GroupInviteEmptyState;
