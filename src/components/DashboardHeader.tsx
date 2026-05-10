import { useTranslation } from 'react-i18next';

import { Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import ViewModeSwitch from './ViewModeSwitch';

const DashboardHeader: React.FC = () => {
    const { t } = useTranslation('dashboard');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);

    const user = useUsersStore(s => s.user);

    return (
        <Flex justify="between" align="center" mb="4">
            <Box>
                <Skeleton loading={isUserLoading} width="180px" height="var(--space-5)">
                    <Heading size={{ initial: '4', sm: '5' }}>
                        {t('header.greeting', {
                            name: user?.firstName ?? user?.displayName ?? '',
                        })}
                    </Heading>
                </Skeleton>
                <Skeleton loading={isUserLoading} width="220px" height="var(--space-4)">
                    <Text size={{ initial: '2', sm: '3' }} color="gray" as="p" mt="1">
                        {t('header.overview')}
                    </Text>
                </Skeleton>
            </Box>
            <ViewModeSwitch />
        </Flex>
    );
};

export default DashboardHeader;
