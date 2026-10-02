import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

import type { UseInviteResult } from 'hooks/pwaHooks';

import InviteIllustrationAsset from 'assets/group-invite-empty-state.png';

import InviteActionRows from './InviteActionRows';

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
    invite: UseInviteResult;
}

const InviteEmptyState = ({ invite }: Props) => {
    const { t } = useTranslation('group');

    const onInviteFriends = (): Promise<void> => {
        if (invite.isNativeShareSupported) {
            return invite.onShare();
        }

        return invite.onCopyLink();
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
                            {t('page.expenses.inviteTitle')}
                        </Heading>
                        <Text size="2" color="gray" align="center">
                            {t('page.expenses.inviteDescription')}
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
                        {t('page.expenses.inviteAction')}
                    </InviteButton>
                </Flex>
            </InviteCard>

            <ShareDivider align="center" gap="3">
                <Text size="1" color="gray">
                    {t('page.expenses.shareVia')}
                </Text>
            </ShareDivider>

            <InviteActionRows invite={invite} />
        </Flex>
    );
};

export default InviteEmptyState;
