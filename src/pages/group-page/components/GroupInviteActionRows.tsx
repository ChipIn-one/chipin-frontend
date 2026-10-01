import { useTranslation } from 'react-i18next';

import type { Group } from 'api/chipin.types';
import { useGroupInvite } from 'hooks/pwaHooks';

import { InviteActionRows } from 'components/invite';

interface Props {
    group: Group;
}

const GroupInviteActionRows = ({ group }: Props) => {
    const { t } = useTranslation(['group', 'common']);
    const {
        inviteLink,
        isNativeShareSupported,
        isShareDone,
        isCopied,
        onShare,
        onCopyLink,
    } = useGroupInvite(group);
    const shareContent = {
        title: t('group:qr.shareTitle', { groupName: group.name }),
        text: t('group:qr.shareText', { groupName: group.name }),
    };

    return (
        <InviteActionRows
            inviteLink={inviteLink}
            isNativeShareSupported={isNativeShareSupported}
            isShareDone={isShareDone}
            isCopied={isCopied}
            onShare={onShare}
            onCopyLink={onCopyLink}
            shareContent={shareContent}
            inviteLabel={t('common:buttons.invitePeople')}
            copyLabel={t('group:page.settings.copyLinkTitle')}
            copiedLabel={t('common:copy.copied')}
            sharedLabel={t('common:copy.shared')}
            shareWarning={t('group:page.shareWarning')}
            qrLabel={t('group:page.settings.showQRTitle')}
            qrSubtitle={t('group:page.settings.showQRSubtitle')}
            qrTitle={t('group:qr.title')}
            qrAccessibleDescription={t('group:qr.description')}
            qrDescription={t('group:qr.joinDescription', { groupName: group.name })}
        />
    );
};

export default GroupInviteActionRows;
