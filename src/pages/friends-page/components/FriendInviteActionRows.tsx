import { useTranslation } from 'react-i18next';

import { useFriendInvite } from 'hooks/pwaHooks';
import { useUsersStore } from 'store/users-store';

import { InviteActionRows } from 'components/invite';

const FriendInviteActionRows = () => {
    const { t } = useTranslation(['friends', 'group', 'common']);
    const user = useUsersStore(state => state.user);
    const {
        inviteLink,
        isNativeShareSupported,
        isShareDone,
        isCopied,
        onShare,
        onCopyLink,
    } = useFriendInvite(user?.inviteToken ?? '');

    if (!user?.inviteToken) {
        return null;
    }

    return (
        <InviteActionRows
            inviteLink={inviteLink}
            isNativeShareSupported={isNativeShareSupported}
            isShareDone={isShareDone}
            isCopied={isCopied}
            onShare={onShare}
            onCopyLink={onCopyLink}
            shareContent={{
                title: t('friends:invite.shareTitle'),
                text: t('friends:invite.shareText'),
            }}
            inviteLabel={t('group:page.expenses.inviteAction')}
            copyLabel={t('group:page.settings.copyLinkTitle')}
            copiedLabel={t('common:copy.copied')}
            sharedLabel={t('common:copy.shared')}
            shareWarning={t('group:page.shareWarning')}
            qrLabel={t('group:page.settings.showQRTitle')}
            qrSubtitle={t('friends:invite.showQRSubtitle')}
            qrTitle={t('friends:invite.qrTitle')}
            qrAccessibleDescription={t('friends:invite.qrDescription')}
            qrDescription={t('friends:invite.qrJoinDescription')}
        />
    );
};

export default FriendInviteActionRows;
