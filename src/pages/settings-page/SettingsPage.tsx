import { LucideSettings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Container, Flex, Grid, Heading, Skeleton, Text } from '@radix-ui/themes';

import { selectUserSelfFetched, selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import MobileNavBar from 'components/nav-bars/MobileNavBar';

import AccountSection from './components/AccountSection';
import AppSettingsSection from './components/AppSettingsSection';
import NotificationsSection from './components/NotificationsSection';
import PrivacySecuritySection from './components/PrivacySecuritySection';
import RegionalSection from './components/RegionalSection';

const SettingsPage = () => {
    const { t } = useTranslation('settings');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const isLoading = isUserLoading || !isUserFetched;

    return (
        <Container size="4" pb={{ initial: '9', sm: '4' }}>
            <Flex direction="column" gap="6">
                <Flex align="center" gap="4">
                    <Skeleton loading={isLoading}>
                        <Avatar size="5" color="mint" fallback={<LucideSettings size={32} />} />
                    </Skeleton>
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Heading size="7">{t('title')}</Heading>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text color="gray" as="p" mt="1">
                                {t('subtitle')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>

                <Grid columns={{ initial: '1', md: '2' }} gap="5">
                    <AccountSection isLoading={isLoading} />
                    <RegionalSection isLoading={isLoading} />
                    <NotificationsSection isLoading={isLoading} />
                    <AppSettingsSection isLoading={isLoading} />
                    <Box gridColumn={{ md: '1 / -1' }}>
                        <PrivacySecuritySection isLoading={isLoading} />
                    </Box>
                </Grid>
            </Flex>

            <MobileNavBar />
        </Container>
    );
};

export default SettingsPage;
