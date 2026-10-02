import {
    LucideCheck,
    LucideLink2,
    LucideQrCode,
    LucideShare2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { UseInviteResult } from 'hooks/pwaHooks';

import InviteQRModal from './InviteQRModal';

const InviteActionButton = styled.button`
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
`;

interface Props {
    invite: UseInviteResult;
}

const InviteActionRows = ({ invite }: Props) => {
    const { t } = useTranslation(['group', 'common']);
    const {
        inviteLink,
        isNativeShareSupported,
        isShareDone,
        isCopied,
        qr,
        onShare,
        onCopyLink,
    } = invite;

    let primaryIcon = <LucideLink2 size={16} />;
    let primaryLabel = isCopied
        ? t('common:copy.copied')
        : t('group:page.settings.copyLinkTitle');

    if (isNativeShareSupported) {
        primaryIcon = isShareDone
            ? <LucideCheck size={16} />
            : <LucideShare2 size={16} />;
        primaryLabel = isShareDone
            ? t('common:copy.shared')
            : t('common:buttons.invitePeople');
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
                <InviteActionButton type="button" onClick={onPrimaryInvite}>
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
                </InviteActionButton>
            </Card>

            {isNativeShareSupported && (
                <Card asChild size="2">
                    <InviteActionButton type="button" onClick={onCopyLink}>
                        <Flex align="center" gap="3" p="4">
                            <Avatar
                                size="3"
                                radius="medium"
                                variant="soft"
                                color="indigo"
                                fallback={
                                    isCopied
                                        ? <LucideCheck size={16} />
                                        : <LucideLink2 size={16} />
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
                    </InviteActionButton>
                </Card>
            )}

            <InviteQRModal qrLink={inviteLink} content={qr}>
                <Card asChild size="2">
                    <InviteActionButton type="button">
                        <Flex align="center" gap="3" p="4">
                            <Avatar
                                size="3"
                                radius="medium"
                                variant="soft"
                                color="violet"
                                fallback={<LucideQrCode size={16} />}
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
                    </InviteActionButton>
                </Card>
            </InviteQRModal>
        </Flex>
    );
};

export default InviteActionRows;
