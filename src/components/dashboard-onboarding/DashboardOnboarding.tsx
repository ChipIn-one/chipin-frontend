import type { ReactNode } from 'react';
import {
    LucideCirclePlus,
    LucideUserPlus,
    LucideUsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Box, Button, Flex, Heading, Text } from '@radix-ui/themes';

import { useFriendInvite } from 'hooks/pwaHooks';

import DashboardOnboardingIllustration from 'assets/dashboard-onboarding.png';
import Image from 'basics/Image';
import { CreateUpdateGroupModal } from 'components/modals/create-update-group-modal';

import { useConnect } from './internal/useConnect';

type OnboardingVariant =
    | 'newUser'
    | 'friendReady'
    | 'groupReady'
    | 'fullyReady'
    | 'groupNeedsPeople';

interface Props {
    hasFriendTarget: boolean;
    hasGroupTarget: boolean;
    hasGroups: boolean;
}

const ActionButton = styled(Button)`
    height: auto;
    min-height: var(--space-7);
    white-space: normal;
    text-align: center;
`;

const getVariant = ({
    hasFriendTarget,
    hasGroupTarget,
    hasGroups,
}: Props): OnboardingVariant => {
    if (hasFriendTarget && hasGroupTarget) {
        return 'fullyReady';
    }

    if (hasFriendTarget) {
        return 'friendReady';
    }

    if (hasGroupTarget) {
        return 'groupReady';
    }

    return hasGroups ? 'groupNeedsPeople' : 'newUser';
};

const DashboardOnboarding = (props: Props) => {
    const { t } = useTranslation(['dashboard', 'common']);
    const { inviteToken, openExpenseModal } = useConnect();
    const invite = useFriendInvite(inviteToken ?? '');
    const variant = getVariant(props);

    const onInviteFriend = (): Promise<void> => {
        if (!inviteToken) {
            return Promise.resolve();
        }

        if (invite.isNativeShareSupported) {
            return invite.onShare();
        }

        return invite.onCopyLink();
    };
    const onClickAddExpense = () => {
        openExpenseModal();
    };

    const createGroupAction = (
        <CreateUpdateGroupModal type="create">
            <ActionButton type="button" size="3" variant="soft">
                <LucideUsersRound size={18} />
                {t('common:buttons.createGroup')}
            </ActionButton>
        </CreateUpdateGroupModal>
    );

    const inviteFriendAction = (
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
    );

    const addExpenseAction = (
        <ActionButton
            type="button"
            size="3"
            onClick={onClickAddExpense}
        >
            <LucideCirclePlus size={18} />
            {t('common:buttons.addExpense')}
        </ActionButton>
    );

    let actions: ReactNode;

    if (variant === 'fullyReady') {
        actions = addExpenseAction;
    } else if (variant === 'friendReady') {
        actions = (
            <>
                {addExpenseAction}
                {createGroupAction}
            </>
        );
    } else if (variant === 'groupReady') {
        actions = (
            <>
                {addExpenseAction}
                {inviteFriendAction}
            </>
        );
    } else if (variant === 'groupNeedsPeople') {
        actions = (
            <>
                <ActionButton
                    type="button"
                    size="3"
                    disabled={!inviteToken}
                    onClick={onInviteFriend}
                >
                    <LucideUserPlus size={18} />
                    {t('onboarding.actions.inviteFriend')}
                </ActionButton>
                {createGroupAction}
            </>
        );
    } else {
        actions = (
            <>
                <CreateUpdateGroupModal type="create">
                    <ActionButton type="button" size="3">
                        <LucideUsersRound size={18} />
                        {t('common:buttons.createGroup')}
                    </ActionButton>
                </CreateUpdateGroupModal>
                {inviteFriendAction}
            </>
        );
    }

    return (
        <Flex
            direction={{ initial: 'column', md: 'row' }}
            align={{ initial: 'center', md: 'start' }}
            justify="center"
            gap={{ initial: '5', md: '6' }}
            width="100%"
            maxWidth="44rem"
            mx="auto"
            py={{ initial: '5', sm: '7' }}
        >
            <Box
                width={{ initial: '100%', md: '16rem' }}
                maxWidth="22rem"
                flexShrink="0"
            >
                <Image
                    src={DashboardOnboardingIllustration}
                    alt=""
                    aria-hidden="true"
                    decoding="async"
                    width="100%"
                    height="auto"
                />
            </Box>

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
                        {t(`onboarding.${variant}.title`)}
                    </Heading>
                    <Text
                        as="p"
                        size={{ initial: '2', sm: '3' }}
                        color="gray"
                        align={{ initial: 'center', md: 'left' }}
                    >
                        {t(`onboarding.${variant}.description`)}
                    </Text>
                </Flex>

                <Flex
                    direction={{ initial: 'column', sm: 'row' }}
                    align={{ initial: 'stretch', sm: 'center' }}
                    gap="3"
                    width={{ initial: '100%', sm: 'auto' }}
                >
                    {actions}
                </Flex>
            </Flex>
        </Flex>
    );
};

export { DashboardOnboarding };
