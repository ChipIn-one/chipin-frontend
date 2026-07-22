import { UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';

import { Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectIsUserAdmin } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import { NavButton } from 'basics/buttons';
import DevMenu from 'components/DevMenu';

import ViewModeSwitch from '../ViewModeSwitch';

const DashboardHeader: React.FC = () => {
    const { t } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);

    const user = useUsersStore(s => s.user);
    const canShowDevMenu = useUsersStore(selectIsUserAdmin);

    return (
        <Flex justify="between" align="center" gap="2">
            <Flex align="center" gap="2" minWidth="0">
                <Box display={{ initial: 'block', sm: 'none' }}>
                    <NavButton to={ROUTES.SETTINGS} variant="ghost" radius="full">
                        <UserAvatar
                            size="3"
                            user={user ?? undefined}
                            isLoading={isUserLoading}
                        />
                    </NavButton>
                </Box>

                <Box>
                    <Heading size="5">
                        <Skeleton loading={isUserLoading}>
                            {isUserLoading
                                ? tSkeletons('dashboardHeader.greeting')
                                : t('header.greeting', {
                                      name: user?.displayName ?? '',
                                  })}
                        </Skeleton>
                    </Heading>
                    <Text size={{ initial: '2', sm: '3' }} color="gray" as="span">
                        <Skeleton loading={isUserLoading}>
                            {isUserLoading
                                ? tSkeletons('dashboardHeader.overview')
                                : t('header.overview')}
                        </Skeleton>
                    </Text>
                </Box>
            </Flex>

            <Flex align="center" gap="2">
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
