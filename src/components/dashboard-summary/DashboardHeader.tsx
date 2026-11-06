import { Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { ROUTES } from 'constants/routes';
import { useIsUserAdmin, useSelfUser } from 'hooks/useSelfUser';
import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { UserAvatar } from 'basics';
import { NavButton } from 'basics/buttons';
import DevMenu from 'components/DevMenu';

import ViewModeSwitch from '../ViewModeSwitch';

const GreetingHeading = styled(Heading)`
    overflow-wrap: anywhere;
`;

const DashboardHeader: React.FC = () => {
    const { t } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);

    const user = useSelfUser();
    const canShowDevMenu = useIsUserAdmin();

    return (
        <Flex justify="between" align="center" gap="2">
            <Flex align="center" gap="2" minWidth="0">
                <Box flexShrink="0">
                    <NavButton
                        to={ROUTES.SETTINGS}
                        aria-label={t('common:nav.settings')}
                        variant="ghost"
                        radius="full"
                    >
                        <UserAvatar size="3" user={user ?? undefined} isLoading={isUserLoading} />
                    </NavButton>
                </Box>

                <Box minWidth="0">
                    <GreetingHeading size="5">
                        <Skeleton loading={isUserLoading}>
                            {isUserLoading
                                ? tSkeletons('dashboardHeader.greeting')
                                : t('header.greeting', {
                                      name: user?.displayName ?? '',
                                  })}
                        </Skeleton>
                    </GreetingHeading>
                    <Text size={{ initial: '2', sm: '3' }} color="gray" as="span">
                        <Skeleton loading={isUserLoading}>
                            {isUserLoading
                                ? tSkeletons('dashboardHeader.overview')
                                : t('header.overview')}
                        </Skeleton>
                    </Text>
                </Box>
            </Flex>

            <Flex align="center" gap="2" display={{ initial: 'flex', lg: 'none' }}>
                <ViewModeSwitch />
                {canShowDevMenu && (
                    <Box display={{ initial: 'block', sm: 'none' }}>
                        <DevMenu />
                    </Box>
                )}
            </Flex>
        </Flex>
    );
};

export default DashboardHeader;
