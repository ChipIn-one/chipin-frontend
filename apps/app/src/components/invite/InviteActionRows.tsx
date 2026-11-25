import { Avatar, Card, Flex, Text } from '@radix-ui/themes';
import { CheckIcon, Link2Icon, QrCodeIcon, Share2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { UseInviteResult } from 'hooks/pwaHooks';

import InviteQRModal from './InviteQRModal';

import styles from './InviteActionRows.module.css';

interface Props {
    invite: UseInviteResult;
}

const InviteActionRows = ({ invite }: Props) => {
    const { t } = useTranslation(['group', 'common']);
    const { inviteLink, isNativeShareSupported, isShareDone, isCopied, qr, onShare, onCopyLink } =
        invite;

    let primaryIcon = <Link2Icon size={16} />;
    let primaryLabel = isCopied ? t('common:copy.copied') : t('group:page.settings.copyLinkTitle');

    if (isNativeShareSupported) {
        primaryIcon = isShareDone ? <CheckIcon size={16} /> : <Share2Icon size={16} />;
        primaryLabel = isShareDone ? t('common:copy.shared') : t('common:buttons.invitePeople');
    }

    const onPrimaryInvite = (): Promise<void> => {
        if (isNativeShareSupported) {
            return onShare();
        }

        return onCopyLink();
    };

    return (
        <Flex direction="column" gap="2">
            <Card asChild size="2">
                <button
                    className={styles.actionButton}
                    type="button"
                    onClick={() => void onPrimaryInvite()}
                >
                    <Flex align="center" gap="3" p="4">
                        <Avatar
                            size="3"
                            radius="medium"
                            variant="soft"
                            color="indigo"
                            fallback={primaryIcon}
                        />
                        <Flex direction="column" gap="1">
                            <Text size="2" weight="medium">
                                {primaryLabel}
                            </Text>
                            <Text size="1" color="gray">
                                {t('group:page.shareWarning')}
                            </Text>
                        </Flex>
                    </Flex>
                </button>
            </Card>

            {isNativeShareSupported && (
                <Card asChild size="2">
                    <button
                        className={styles.actionButton}
                        type="button"
                        onClick={() => void onCopyLink()}
                    >
                        <Flex align="center" gap="3" p="4">
                            <Avatar
                                size="3"
                                radius="medium"
                                variant="soft"
                                color="indigo"
                                fallback={
                                    isCopied ? <CheckIcon size={16} /> : <Link2Icon size={16} />
                                }
                            />
                            <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                    {isCopied
                                        ? t('common:copy.copied')
                                        : t('group:page.settings.copyLinkTitle')}
                                </Text>
                                <Text size="1" color="gray">
                                    {t('group:page.shareWarning')}
                                </Text>
                            </Flex>
                        </Flex>
                    </button>
                </Card>
            )}

            <InviteQRModal qrLink={inviteLink} content={qr}>
                <Card asChild size="2">
                    <button className={styles.actionButton} type="button">
                        <Flex align="center" gap="3" p="4">
                            <Avatar
                                size="3"
                                radius="medium"
                                variant="soft"
                                color="violet"
                                fallback={<QrCodeIcon size={16} />}
                            />
                            <Flex direction="column" gap="1">
                                <Text size="2" weight="medium">
                                    {t('group:page.settings.showQRTitle')}
                                </Text>
                                <Text size="1" color="gray">
                                    {qr.subtitle}
                                </Text>
                            </Flex>
                        </Flex>
                    </button>
                </Card>
            </InviteQRModal>
        </Flex>
    );
};

export { InviteActionRows };
