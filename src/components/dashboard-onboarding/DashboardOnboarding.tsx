import {
    LucideUserPlus,
    LucideUsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';

import { useFriendInvite } from 'hooks/pwaHooks';

import DashboardOnboardingIllustration from 'assets/dashboard-onboarding.png';
import { CreateUpdateGroupModal } from 'components/modals/create-update-group-modal';

import { useConnect } from './internal/useConnect';

const ActionButton = styled(Button)`
    height: auto;
    min-height: var(--space-7);
    white-space: normal;
    text-align: center;
`;

const OnboardingCard = styled(Card)`
    width: 100%;
    max-width: 44rem;
    margin-inline: auto;
`;

const OnboardingIllustration = styled.img`
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
`;

const DashboardOnboarding = () => {
    const { t } = useTranslation(['dashboard', 'common']);
    const { inviteToken } = useConnect();
    const invite = useFriendInvite(inviteToken ?? '');

    const onInviteFriend = (): Promise<void> => {
        if (!inviteToken) {
            return Promise.resolve();
        }

        return invite.isNativeShareSupported
            ? invite.onShare()
            : invite.onCopyLink();
    };

    return (
        <OnboardingCard
            size={{ initial: '2', md: '3' }}
            data-testid="dashboard-onboarding-card"
        >
            <Flex
                direction={{ initial: 'column', md: 'row' }}
                align={{ initial: 'center', md: 'start' }}
                justify="center"
                gap={{ initial: '5', md: '6' }}
                width="100%"
            >
                <Flex
                    width={{ initial: '100%', md: '16rem' }}
                    maxWidth="22rem"
                    flexShrink="0"
                >
                    <OnboardingIllustration
                        src={DashboardOnboardingIllustration}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                        data-testid="onboarding-illustration"
                    />
                </Flex>

                <Flex
                    direction="column"
                    align={{ initial: 'center', md: 'start' }}
                    gap="4"
                    width="100%"
                    maxWidth="24rem"
                >
                    <Flex direction="column" gap="2">
                        <Heading
                            as="h1"
                            size={{ initial: '6', sm: '7' }}
                            align={{ initial: 'center', md: 'left' }}
                        >
                            {t('onboarding.welcome.title')}
                        </Heading>
                        <Text
                            as="p"
                            size={{ initial: '2', sm: '3' }}
                            color="gray"
                            align={{ initial: 'center', md: 'left' }}
                        >
                            {t('onboarding.welcome.description')}
                        </Text>
                    </Flex>

                    <Flex
                        direction={{ initial: 'column', sm: 'row' }}
                        align={{ initial: 'stretch', sm: 'center' }}
                        gap="3"
                        width={{ initial: '100%', sm: 'auto' }}
                    >
                        <CreateUpdateGroupModal type="create">
                            <ActionButton type="button" size="3">
                                <LucideUsersRound size={18} />
                                {t('common:buttons.createGroup')}
                            </ActionButton>
                        </CreateUpdateGroupModal>
                        <ActionButton
                            type="button"
                            size="3"
                            variant="soft"
                            disabled={!inviteToken}
                            onClick={onInviteFriend}
                        >
                            <LucideUserPlus size={18} />
                            {t('onboarding.actions.inviteFriend')}
                        </ActionButton>
                    </Flex>
                </Flex>
            </Flex>
        </OnboardingCard>
    );
};

export { DashboardOnboarding };
