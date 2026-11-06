import { Box, Container, Flex, Grid } from '@radix-ui/themes';

import { useCanAccessSolo, useSelfUserState } from 'hooks/useSelfUser';

import {
    AccountSection,
    AppSettingsSection,
    ExpensePreferencesSection,
    PrivacySecuritySection,
    RegionalSection,
    SettingsPageHeader,
    SoloPreferencesSection,
} from './components';

const SettingsPage = () => {
    const isLoading = !useSelfUserState().isFetched;
    const canAccessSolo = useCanAccessSolo();

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
                    {canAccessSolo && <SoloPreferencesSection isLoading={isLoading} />}
                    <AppSettingsSection isLoading={isLoading} />
                    <Box gridColumn={{ md: '1 / -1' }}>
                        <PrivacySecuritySection isLoading={isLoading} />
                    </Box>
                </Grid>
            </Flex>
        </Container>
    );
};

export default SettingsPage;
