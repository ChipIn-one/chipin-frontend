import {
    LucideCheck,
    LucideLink2,
    LucideQrCode,
    LucideShare2,
} from 'lucide-react';
import styled from 'styled-components';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { InviteShareContent } from 'helpers/share';

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
    copiedLabel: string;
    copyLabel: string;
    inviteLink: string;
    inviteLabel: string;
    isCopied: boolean;
    isNativeShareSupported: boolean;
    isShareDone: boolean;
    onCopyLink: () => Promise<void>;
    onShare: (content: InviteShareContent) => Promise<void>;
    qrAccessibleDescription: string;
    qrDescription: string;
    qrLabel: string;
    qrSubtitle: string;
    qrTitle: string;
    shareContent: InviteShareContent;
    sharedLabel: string;
    shareWarning: string;
}

const InviteActionRows = ({
    copiedLabel,
    copyLabel,
    inviteLabel,
    inviteLink,
    isCopied,
    isNativeShareSupported,
    isShareDone,
    onCopyLink,
    onShare,
    qrAccessibleDescription,
    qrDescription,
    qrLabel,
    qrSubtitle,
    qrTitle,
    shareContent,
    sharedLabel,
    shareWarning,
}: Props) => {
    let primaryIcon = <LucideLink2 size={16} />;
    let primaryLabel = isCopied ? copiedLabel : copyLabel;

    if (isNativeShareSupported) {
        primaryIcon = isShareDone
            ? <LucideCheck size={16} />
            : <LucideShare2 size={16} />;
        primaryLabel = isShareDone ? sharedLabel : inviteLabel;
    }

    const onPrimaryInvite = (): Promise<void> => {
        if (isNativeShareSupported) {
            return onShare(shareContent);
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
                                {shareWarning}
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
                                    {isCopied ? copiedLabel : copyLabel}
                                </Text>
                                <Text size="1" color="gray">
                                    {shareWarning}
                                </Text>
                            </Flex>
                        </Flex>
                    </InviteActionButton>
                </Card>
            )}

            <InviteQRModal
                qrLink={inviteLink}
                title={qrTitle}
                accessibleDescription={qrAccessibleDescription}
                qrDescription={qrDescription}
                triggerLabel={qrLabel}
            >
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
                                    {qrLabel}
                                </Text>
                                <Text size="1" color="gray">
                                    {qrSubtitle}
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
