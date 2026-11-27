import { Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { ROUTES } from 'constants/routes';
import { useIsUserAdmin, useSelfUserState } from 'hooks/useSelfUser';

import { UserAvatar } from 'basics';
import { DevMenu } from 'components/DevMenu';
import { NavButton } from 'components/NavButton';

import { ViewModeSwitch } from '../ViewModeSwitch';

import styles from './DashboardHeader.module.css';

const DashboardHeader: React.FC = () => {
    const { t } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');
    const { user, isLoading: isUserLoading } = useSelfUserState();
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
                    <Heading className={styles.greeting} size="5">
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

export { DashboardHeader };
