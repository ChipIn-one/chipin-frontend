import { useState } from 'react';
import {
    LucideBell,
    LucideGlobe,
    LucideLogOut,
    LucideSettings2,
    LucideShield,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import {
    Avatar,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Heading,
    SegmentedControl,
    Select,
    Separator,
    Switch,
    Text,
    TextField,
} from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';
import { selectAvailableCurrencies } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { useUsersStore } from 'store/usersStore';

import MobileNavBar from 'components/Navs/MobileNavBar';
import UserAvatar from 'components/UserAvatar';

const timezoneOptions = [
    'UTC',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Almaty',
    'Asia/Dubai',
    'Asia/Tokyo',
    'America/New_York',
    'America/Los_Angeles',
];

const languageOptions = ['en', 'ru'] as const;

const SettingsPage = () => {
    const { t, i18n } = useTranslation();
    const { theme, setTheme } = useTheme();

    const { signOut } = useAuthStore();
    const availableCurrencies = useDashboardStore(useShallow(selectAvailableCurrencies));
    const { user } = useUsersStore();

    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [isTimezoneAuto, setIsTimezoneAuto] = useState(true);
    const [timezone, setTimezone] = useState(currentTimezone);
    const [currency, setCurrency] = useState('USD');
    const [isSimplifyDebtsEnabled, setIsSimplifyDebtsEnabled] = useState(true);

    const normalizedLanguage = i18n.language.split('-')[0];
    const selectedLanguage = languageOptions.includes(
        normalizedLanguage as (typeof languageOptions)[number],
    )
        ? normalizedLanguage
        : 'en';

    const onLanguageChange = (value: string) => {
        void i18n.changeLanguage(value);
    };

    const selectedTheme = (theme as 'light' | 'dark' | 'system' | undefined) || 'system';
    const onLogoutAllDevices = () => {
        toast.info(t('settings.security.logoutAllDevicesSoon'));
    };
    const onDeleteAccount = () => {
        toast.info(t('settings.security.deleteAccountSoon'));
    };
    const onThemeChange = (value: string) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
            setTheme(value);
        }
    };

    return (
        <Container size="4" pb={{ initial: '9', sm: '4' }}>
            <Flex direction="column" gap="6">
                <Box>
                    <Heading size="7">{t('settings.title')}</Heading>
                    <Text color="gray" as="p" mt="2">
                        {t('settings.subtitle')}
                    </Text>
                </Box>

                <Grid columns={{ initial: '1', md: '2' }} gap="5">
                    <Card size="3">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <UserAvatar size="3" />
                                <Box>
                                    <Text weight="medium">{t('settings.account.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.account.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="3">
                                <Box>
                                    <Text size="2" color="gray">
                                        {t('settings.account.displayNameLabel')}
                                    </Text>
                                    <TextField.Root
                                        mt="2"
                                        size="3"
                                        value={user?.displayName || ''}
                                        placeholder={t('settings.account.displayNamePlaceholder')}
                                        readOnly
                                    />
                                </Box>
                                <Box>
                                    <Text size="2" color="gray">
                                        {t('settings.account.emailLabel')}
                                    </Text>
                                    <TextField.Root
                                        mt="2"
                                        size="3"
                                        value={user?.email || ''}
                                        readOnly
                                    />
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="3">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <Avatar
                                    variant="soft"
                                    size="3"
                                    color="mint"
                                    fallback={<LucideGlobe size={20} />}
                                />
                                <Box>
                                    <Text weight="medium">{t('settings.regional.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.regional.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="4">
                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">
                                            {t('settings.regional.autoTimezone')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('settings.regional.autoTimezoneHint', {
                                                timezone: currentTimezone,
                                            })}
                                        </Text>
                                    </Box>
                                    <Switch
                                        checked={isTimezoneAuto}
                                        onCheckedChange={setIsTimezoneAuto}
                                        aria-label={t('settings.regional.autoTimezone')}
                                    />
                                </Flex>

                                <Box>
                                    <Text size="2" color="gray">
                                        {t('settings.regional.timezoneLabel')}
                                    </Text>
                                    <Select.Root
                                        value={timezone}
                                        onValueChange={setTimezone}
                                        disabled={isTimezoneAuto}
                                    >
                                        <Select.Trigger />
                                        <Select.Content>
                                            {timezoneOptions.map(option => (
                                                <Select.Item key={option} value={option}>
                                                    {option}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                </Box>

                                <Box>
                                    <Text size="2" color="gray">
                                        {t('settings.regional.currencyLabel')}
                                    </Text>
                                    <Select.Root value={currency} onValueChange={setCurrency}>
                                        <Select.Trigger />
                                        <Select.Content>
                                            {availableCurrencies.map(option => (
                                                <Select.Item key={option} value={option}>
                                                    {t(`settings.regional.currencies.${option}`)}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                </Box>
                                <Box>
                                    <Text size="2" color="gray">
                                        {t('settings.regional.languageLabel')}
                                    </Text>
                                    <Select.Root
                                        value={selectedLanguage}
                                        onValueChange={onLanguageChange}
                                    >
                                        <Select.Trigger />
                                        <Select.Content>
                                            {languageOptions.map(option => (
                                                <Select.Item key={option} value={option}>
                                                    {t(`settings.language.options.${option}`)}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.regional.languageHint')}
                                    </Text>
                                </Box>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="3">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <Avatar
                                    variant="soft"
                                    size="3"
                                    color="mint"
                                    fallback={<LucideBell size={20} />}
                                />
                                <Box>
                                    <Text weight="medium">{t('settings.notifications.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.notifications.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex justify="between" align="center" gap="3">
                                <Box>
                                    <Text weight="medium">
                                        {t('settings.notifications.pushTitle')}
                                    </Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.notifications.pushDescription')}
                                    </Text>
                                </Box>
                                <Switch aria-label={t('settings.notifications.pushTitle')} />
                            </Flex>

                            <Flex justify="between" align="center" gap="3">
                                <Box>
                                    <Text weight="medium">
                                        {t('settings.notifications.emailTitle')}
                                    </Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.notifications.emailDescription')}
                                    </Text>
                                </Box>
                                <Switch aria-label={t('settings.notifications.emailTitle')} />
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="3">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <Avatar
                                    variant="soft"
                                    size="3"
                                    color="mint"
                                    fallback={<LucideSettings2 size={20} />}
                                />
                                <Box>
                                    <Text weight="medium">{t('settings.app.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.app.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="4">
                                <Box>
                                    <Text weight="medium">{t('settings.app.themeTitle')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.app.themeDescription')}
                                    </Text>
                                </Box>

                                <SegmentedControl.Root value={selectedTheme} onValueChange={onThemeChange}>
                                    <SegmentedControl.Item value="dark">
                                        {t('settings.app.themeOptions.dark')}
                                    </SegmentedControl.Item>
                                    <SegmentedControl.Item value="light">
                                        {t('settings.app.themeOptions.light')}
                                    </SegmentedControl.Item>
                                    <SegmentedControl.Item value="system">
                                        {t('settings.app.themeOptions.system')}
                                    </SegmentedControl.Item>
                                </SegmentedControl.Root>

                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">
                                            {t('settings.app.simplifyDebtsTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('settings.app.simplifyDebtsDescription')}
                                        </Text>
                                    </Box>
                                    <Switch
                                        checked={isSimplifyDebtsEnabled}
                                        onCheckedChange={setIsSimplifyDebtsEnabled}
                                        aria-label={t('settings.app.simplifyDebtsTitle')}
                                    />
                                </Flex>
                            </Flex>
                        </Flex>
                    </Card>

                    <Card size="3">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <Avatar
                                    variant="soft"
                                    size="3"
                                    color="mint"
                                    fallback={<LucideShield size={20} />}
                                />
                                <Box>
                                    <Text weight="medium">{t('settings.security.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.security.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="3">
                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">
                                            {t('settings.security.logoutAllDevicesTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('settings.security.logoutAllDevicesDescription')}
                                        </Text>
                                    </Box>
                                    <Button variant="soft" color="amber" onClick={onLogoutAllDevices}>
                                        {t('settings.security.logoutAllDevicesButton')}
                                    </Button>
                                </Flex>

                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">
                                            {t('settings.security.deleteAccountTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('settings.security.deleteAccountDescription')}
                                        </Text>
                                    </Box>
                                    <Button variant="soft" color="red" onClick={onDeleteAccount}>
                                        {t('settings.security.deleteAccountButton')}
                                    </Button>
                                </Flex>

                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">{t('settings.signOut')}</Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('settings.security.signOutDescription')}
                                        </Text>
                                    </Box>
                                    <Button onClick={signOut} color="red">
                                        <LucideLogOut size={16} />
                                        {t('settings.signOut')}
                                    </Button>
                                </Flex>
                            </Flex>
                        </Flex>
                    </Card>
                </Grid>
            </Flex>
            <MobileNavBar />
        </Container>
    );
};

export default SettingsPage;
