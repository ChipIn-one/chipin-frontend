import { useState } from 'react';
import { UserAvatar } from 'basics';
import { LucideBell, LucideGlobe, LucideLogOut, LucideSettings2, LucideShield } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
    Avatar,
    Box,
    Button,
    Card,
    Code,
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
import { usePreferredLanguage } from '@uidotdev/usehooks';

import { APP_VERSION } from 'constants/version';
import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/usersStore';

import CurrencySelect from 'components/CurrencySelect';
import MobileNavBar from 'components/nav-bars/MobileNavBar';

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
    const { t, i18n } = useTranslation('settings');
    const { theme, setTheme } = useTheme();

    const { signOut } = useAuthStore();
    const { user } = useUsersStore();

    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [isTimezoneAuto, setIsTimezoneAuto] = useState(true);
    const [timezone, setTimezone] = useState(currentTimezone);
    const [isSimplifyDebtsEnabled, setIsSimplifyDebtsEnabled] = useState(true);

    // TODO: Set default language of user, handle first type, hangle localstorage, and user settings
    const defaultLanguage = usePreferredLanguage();
    const selectedLanguage = languageOptions.includes(
        defaultLanguage as (typeof languageOptions)[number],
    )
        ? defaultLanguage
        : 'en';

    const onLanguageChange = (value: string) => {
        void i18n.changeLanguage(value);
    };

    const selectedTheme = (theme as 'light' | 'dark' | 'system' | undefined) || 'system';
    const onLogoutAllDevices = () => {
        toast.info(t('toasts:settings.logoutAllDevicesSoon'));
    };
    const onDeleteAccount = () => {
        toast.info(t('toasts:settings.deleteAccountSoon'));
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
                    <Heading size="7">{t('title')}</Heading>
                    <Text color="gray" as="p" mt="2">
                        {t('subtitle')}
                    </Text>
                </Box>

                <Grid columns={{ initial: '1', md: '2' }} gap="5">
                    <Card size="3">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <UserAvatar size="3" />
                                <Box>
                                    <Text weight="medium">{t('account.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('account.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="3">
                                <Box>
                                    <Text size="2" color="gray">
                                        {t('common:fields.displayName')}
                                    </Text>
                                    <TextField.Root
                                        mt="2"
                                        size="3"
                                        value={user?.displayName || ''}
                                        placeholder={t('account.displayNamePlaceholder')}
                                        readOnly
                                    />
                                </Box>
                                <Box>
                                    <Text size="2" color="gray">
                                        {t('common:fields.email')}
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
                                    <Text weight="medium">{t('regional.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('regional.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="4">
                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">{t('regional.autoTimezone')}</Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('regional.autoTimezoneHint', {
                                                timezone: currentTimezone,
                                            })}
                                        </Text>
                                    </Box>
                                    <Switch
                                        checked={isTimezoneAuto}
                                        onCheckedChange={setIsTimezoneAuto}
                                        aria-label={t('regional.autoTimezone')}
                                    />
                                </Flex>

                                <Box>
                                    <Text size="2" color="gray">
                                        {t('common:fields.timezone')}
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

                                <Text size="2" color="gray">
                                    {t('common:fields.defaultCurrency')}
                                </Text>
                                <CurrencySelect />

                                <Box>
                                    <Text size="2" color="gray">
                                        {t('common:fields.interfaceLanguage')}
                                    </Text>
                                    <Select.Root
                                        value={selectedLanguage}
                                        onValueChange={onLanguageChange}
                                    >
                                        <Select.Trigger />
                                        <Select.Content>
                                            {languageOptions.map(option => (
                                                <Select.Item key={option} value={option}>
                                                    {t(`language.options.${option}`)}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                    <Text size="2" color="gray" as="p">
                                        {t('regional.languageHint')}
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
                                    <Text weight="medium">{t('notifications.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('notifications.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex justify="between" align="center" gap="3">
                                <Box>
                                    <Text weight="medium">{t('notifications.pushTitle')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('notifications.pushDescription')}
                                    </Text>
                                </Box>
                                <Switch aria-label={t('notifications.pushTitle')} />
                            </Flex>

                            <Flex justify="between" align="center" gap="3">
                                <Box>
                                    <Text weight="medium">{t('notifications.emailTitle')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('notifications.emailDescription')}
                                    </Text>
                                </Box>
                                <Switch aria-label={t('notifications.emailTitle')} />
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
                                    <Text weight="medium">{t('app.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('app.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="4">
                                <Box>
                                    <Text weight="medium">{t('app.themeTitle')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('app.themeDescription')}
                                    </Text>
                                </Box>

                                <SegmentedControl.Root
                                    value={selectedTheme}
                                    onValueChange={onThemeChange}
                                >
                                    <SegmentedControl.Item value="dark">
                                        {t('app.themeOptions.dark')}
                                    </SegmentedControl.Item>
                                    <SegmentedControl.Item value="light">
                                        {t('app.themeOptions.light')}
                                    </SegmentedControl.Item>
                                    <SegmentedControl.Item value="system">
                                        {t('app.themeOptions.system')}
                                    </SegmentedControl.Item>
                                </SegmentedControl.Root>

                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">{t('app.simplifyDebtsTitle')}</Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('app.simplifyDebtsDescription')}
                                        </Text>
                                    </Box>
                                    <Switch
                                        checked={isSimplifyDebtsEnabled}
                                        onCheckedChange={setIsSimplifyDebtsEnabled}
                                        aria-label={t('app.simplifyDebtsTitle')}
                                    />
                                </Flex>

                                <Box>
                                    <Text weight="medium">{t('app.versionTitle')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('app.versionDescription')}
                                    </Text>
                                    <Box mt="2">
                                        <Code>{APP_VERSION}</Code>
                                    </Box>
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
                                    fallback={<LucideShield size={20} />}
                                />
                                <Box>
                                    <Text weight="medium">{t('security.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('security.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Flex direction="column" gap="3">
                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">
                                            {t('security.logoutAllDevicesTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('security.logoutAllDevicesDescription')}
                                        </Text>
                                    </Box>
                                    <Button
                                        variant="soft"
                                        color="amber"
                                        onClick={onLogoutAllDevices}
                                    >
                                        {t('security.logoutAllDevicesButton')}
                                    </Button>
                                </Flex>

                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">
                                            {t('security.deleteAccountTitle')}
                                        </Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('security.deleteAccountDescription')}
                                        </Text>
                                    </Box>
                                    <Button variant="soft" color="red" onClick={onDeleteAccount}>
                                        {t('security.deleteAccountButton')}
                                    </Button>
                                </Flex>

                                <Flex justify="between" align="center" gap="3">
                                    <Box>
                                        <Text weight="medium">{t('common:buttons.signOut')}</Text>
                                        <Text size="2" color="gray" as="p">
                                            {t('security.signOutDescription')}
                                        </Text>
                                    </Box>
                                    <Button onClick={signOut} color="red">
                                        <LucideLogOut size={16} />
                                        {t('common:buttons.signOut')}
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
