import { Box, Container, Flex, Grid } from '@radix-ui/themes';

import { selectUserSelfFetched, selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { MobileNavBar } from 'components/nav-bars';

import {
    AccountSection,
    AppSettingsSection,
    ExpensePreferencesSection,
    NotificationsSection,
    PrivacySecuritySection,
    RegionalSection,
    SettingsPageHeader,
    SoloPreferencesSection,
} from './components';

const SettingsPage = () => {
    const isUserLoading = useLoadingStore(selectUserSelfLoading);
    const isUserFetched = useLoadingStore(selectUserSelfFetched);
    const isLoading = isUserLoading || !isUserFetched;

    return (
        <Container size="4" pb={{ initial: '9', sm: '4' }}>
            <Box display={{ initial: 'block', lg: 'none' }}>
                <SettingsPageHeader isLoading={isLoading} />
            </Box>
            <Flex direction="column" gap="6">
                <Grid columns={{ initial: '1', md: '2' }} gap="5">
                    <AccountSection isLoading={isLoading} />
                    <RegionalSection isLoading={isLoading} />
                    <ExpensePreferencesSection isLoading={isLoading} />
                    <SoloPreferencesSection isLoading={isLoading} />
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
