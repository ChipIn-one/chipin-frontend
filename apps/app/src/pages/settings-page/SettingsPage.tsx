import { Box, Callout, Container, Flex, Grid } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { useRequiresOnline } from 'hooks/useRequiresOnline';
import { useCanAccessSolo, useSelfUserState } from 'hooks/useSelfUser';

import { OnlineOnlyGroup } from 'components/online-only';

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
    const { t } = useTranslation('common');
    // §2.9: the user settings (`PATCH /users/self`) are changed only online.
    const isSettingsBlocked = useRequiresOnline(ONLINE_ONLY_ACTIONS.userSettings);

    return (
        <Container size="4" pb={{ initial: '9', sm: '4' }}>
            <SettingsPageHeader isLoading={isLoading} />
            <Flex direction="column" gap="6">
                {isSettingsBlocked && (
                    <Callout.Root color="gray" size="1" role="status">
                        <Callout.Text>{t('outbox.settingsOnlineRequired')}</Callout.Text>
                    </Callout.Root>
                )}
                <Grid columns={{ initial: '1', md: '2' }} gap="5">
                    <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                        <AccountSection isLoading={isLoading} />
                    </OnlineOnlyGroup>
                    <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                        <RegionalSection isLoading={isLoading} />
                    </OnlineOnlyGroup>
                    <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                        <ExpensePreferencesSection isLoading={isLoading} />
                    </OnlineOnlyGroup>
                    {canAccessSolo && (
                        <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                            <SoloPreferencesSection isLoading={isLoading} />
                        </OnlineOnlyGroup>
                    )}
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
