import { useTranslation } from 'react-i18next';

import { useFriendInvite } from 'hooks/pwaHooks';
import { useUsersStore } from 'store/users-store';

import { InviteEmptyState } from 'components/invite';

import FriendInviteActionRows from './FriendInviteActionRows';

const FriendInviteEmptyState = () => {
    const { t } = useTranslation(['friends', 'group']);
    const user = useUsersStore(state => state.user);
    const {
        isNativeShareSupported,
        onShare,
        onCopyLink,
    } = useFriendInvite(user?.inviteToken ?? '');

    if (!user?.inviteToken) {
        return null;
    }

    const shareContent = {
        title: t('friends:invite.shareTitle'),
        text: t('friends:invite.shareText'),
    };

    return (
        <InviteEmptyState
            title={t('group:page.expenses.inviteTitle')}
            description={t('group:page.expenses.inviteDescription')}
            actionLabel={t('group:page.expenses.inviteAction')}
            shareViaLabel={t('group:page.expenses.shareVia')}
            isNativeShareSupported={isNativeShareSupported}
            onShare={onShare}
            onCopyLink={onCopyLink}
            shareContent={shareContent}
            actionRows={<FriendInviteActionRows />}
        />
    );
};

export default FriendInviteEmptyState;
