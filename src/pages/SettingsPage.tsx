import { useState } from 'react';
import {
    LucideBell,
    LucideGlobe,
    LucideLanguages,
    LucideLogOut,
    LucideShield,
    LucideUser,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Heading,
    Select,
    Separator,
    Switch,
    Text,
    TextField,
} from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';
import { useUsersStore } from 'store/usersStore';

import MobileNavBar from 'components/Navs/MobileNavBar';

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

const currencyOptions = ['USD', 'EUR', 'RUB', 'KZT', 'GBP'];
const languageOptions = ['en', 'ru'] as const;

const SettingsPage = () => {
    const { t, i18n } = useTranslation();

    const { signOut } = useAuthStore();
    const { user } = useUsersStore();

    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [isTimezoneAuto, setIsTimezoneAuto] = useState(true);
    const [timezone, setTimezone] = useState(currentTimezone);
    const [currency, setCurrency] = useState('USD');

    const normalizedLanguage = i18n.language.split('-')[0];
    const selectedLanguage = languageOptions.includes(
        normalizedLanguage as (typeof languageOptions)[number],
    )
        ? normalizedLanguage
        : 'en';

    const onLanguageChange = (value: string) => {
        void i18n.changeLanguage(value);
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
                                <Avatar
                                    variant="soft"
                                    size="3"
                                    color="mint"
                                    fallback={<LucideUser size={20} />}
                                />
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
                                            {currencyOptions.map(option => (
                                                <Select.Item key={option} value={option}>
                                                    {t(`settings.regional.currencies.${option}`)}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
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
                                    fallback={<LucideLanguages size={20} />}
                                />
                                <Box>
                                    <Text weight="medium">{t('settings.language.title')}</Text>
                                    <Text size="2" color="gray" as="p">
                                        {t('settings.language.description')}
                                    </Text>
                                </Box>
                            </Flex>

                            <Separator size="4" />

                            <Box>
                                <Text size="2" color="gray">
                                    {t('settings.language.selectorLabel')}
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
                            </Box>
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

                            <Text size="2" color="gray">
                                {t('settings.security.placeholder')}
                            </Text>
                        </Flex>
                    </Card>
                </Grid>

                <Flex justify="end">
                    <Button onClick={signOut} color="red">
                        <LucideLogOut size={16} />
                        {t('settings.signOut')}
                    </Button>
                </Flex>
            </Flex>
            <MobileNavBar />
        </Container>
    );
};

export default SettingsPage;
