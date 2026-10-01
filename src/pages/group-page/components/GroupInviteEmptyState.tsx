import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { useGroupInvite } from 'hooks/pwaHooks';

import GroupInviteIllustration from 'assets/group-invite-empty-state.png';

import GroupInviteActionRows from './GroupInviteActionRows';

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
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const {
        isNativeShareSupported,
        handleShare: onShare,
        handleCopyLink: onCopyLink,
    } = useGroupInvite(group);
    const shareTitle = t('qr.shareText', { groupName: group.name });

    const onInviteFriends = (): Promise<void> => {
        if (isNativeShareSupported) {
            return onShare(shareTitle);
        }

        return onCopyLink();
    };

    return (
        <Flex direction="column" gap="3">
            <InviteCard size="3">
                <Flex direction="column" align="center" gap="3">
                    <InviteIllustration
                        src={GroupInviteIllustration}
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

            <GroupInviteActionRows group={group} />
        </Flex>
    );
};

export default GroupInviteEmptyState;
