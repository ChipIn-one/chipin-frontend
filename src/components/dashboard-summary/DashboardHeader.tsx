import { useTranslation } from 'react-i18next';

import { Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import ViewModeSwitch from '../ViewModeSwitch';

const DashboardHeader: React.FC = () => {
    const { t } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);

    const user = useUsersStore(s => s.user);

    return (
        <Box mb="4">
            <Flex justify="between" align="center" mb={{ initial: '0', sm: '4' }} gap="2">
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
                <ViewModeSwitch />
            </Flex>
        </Box>
    );
};

export default DashboardHeader;
