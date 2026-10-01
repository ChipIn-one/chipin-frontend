import { LucideUserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

import type { InviteShareContent } from 'hooks/pwaHooks';

import InviteIllustrationAsset from 'assets/group-invite-empty-state.png';

const InviteCard = styled(Card)`
    overflow: hidden;
    background:
        radial-gradient(circle at top, var(--green-a4), transparent 68%),
        var(--color-panel-solid);
`;

const InviteIllustration = styled.img`
    display: block;
    width: min(100%, 20rem);
    height: auto;
    margin: 0 auto;
`;

const InviteButton = styled(Button)`
    width: 100%;
`;

const ShareDivider = styled(Flex)`
    width: 100%;

    &::before,
    &::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--gray-a6);
    }
`;

interface Props {
    actionLabel: string;
    actionRows: ReactNode;
    description: string;
    isNativeShareSupported: boolean;
    onCopyLink: () => Promise<void>;
    onShare: (content: InviteShareContent) => Promise<void>;
    shareContent: InviteShareContent;
    shareViaLabel: string;
    title: string;
}

const InviteEmptyState = ({
    actionLabel,
    actionRows,
    description,
    isNativeShareSupported,
    onCopyLink,
    onShare,
    shareContent,
    shareViaLabel,
    title,
}: Props) => {
    const onInviteFriends = (): Promise<void> => {
        if (isNativeShareSupported) {
            return onShare(shareContent);
        }

        return onCopyLink();
    };

    return (
        <Flex direction="column" gap="3">
            <InviteCard size="3">
                <Flex direction="column" align="center" gap="3">
                    <InviteIllustration
                        src={InviteIllustrationAsset}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                    />

                    <Flex direction="column" align="center" gap="1">
                        <Heading as="h3" size="5" align="center">
                            {title}
                        </Heading>
                        <Text size="2" color="gray" align="center">
                            {description}
                        </Text>
                    </Flex>

                    <InviteButton
                        type="button"
                        size="3"
                        color="green"
                        radius="full"
                        onClick={onInviteFriends}
                    >
                        <LucideUserPlus size={18} />
                        {actionLabel}
                    </InviteButton>
                </Flex>
            </InviteCard>

            <ShareDivider align="center" gap="3">
                <Text size="1" color="gray">
                    {shareViaLabel}
                </Text>
            </ShareDivider>

            {actionRows}
        </Flex>
    );
};

export default InviteEmptyState;
