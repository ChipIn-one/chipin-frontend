import { useTranslation } from 'react-i18next';

import { Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import ViewModeSwitch from '../ViewModeSwitch';

const DashboardHeader: React.FC = () => {
    const { t } = useTranslation('dashboard');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);

    const user = useUsersStore(s => s.user);

    return (
        <Box mb="4">
            <Flex justify="between" align="center" mb={{ initial: '0', sm: '4' }} gap="2">
                <Box>
                    <Skeleton loading={isUserLoading} width="180px" height="var(--space-5)">
                        <Heading size="5">
                            {t('header.greeting', {
                                name: user?.firstName ?? user?.displayName ?? '',
                            })}
                        </Heading>
                    </Skeleton>
                    <Skeleton loading={isUserLoading} width="220px" height="var(--space-4)">
                        <Text size={{ initial: '2', sm: '3' }} color="gray" as="span">
                            {t('header.overview')}
                        </Text>
                    </Skeleton>
                </Box>
                <ViewModeSwitch />
            </Flex>
        </Box>
    );
};

export default DashboardHeader;
