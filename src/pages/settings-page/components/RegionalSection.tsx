import { useState } from 'react';
import { LucideGlobe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Box,
    Card,
    Flex,
    SegmentedControl,
    Select,
    Separator,
    Skeleton,
    Switch,
    Text,
} from '@radix-ui/themes';

import CurrencySelect from 'components/CurrencySelect';

const TIMEZONE_OPTIONS = [
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

const LANGUAGE_OPTIONS = ['en', 'ru'] as const;

interface Props {
    isLoading: boolean;
}

const RegionalSection = ({ isLoading }: Props) => {
    const { t, i18n } = useTranslation('settings');

    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const [isTimezoneAuto, setIsTimezoneAuto] = useState(true);
    const [timezone, setTimezone] = useState(detectedTimezone);
    const [isTimeFormat24h, setIsTimeFormat24h] = useState(false);

    const effectiveTimezone = isTimezoneAuto ? detectedTimezone : timezone;

    const previewTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: !isTimeFormat24h,
        timeZone: effectiveTimezone,
    });

    const normalizedLanguage = i18n.language.split('-')[0] as (typeof LANGUAGE_OPTIONS)[number];
    const selectedLanguage = LANGUAGE_OPTIONS.includes(normalizedLanguage)
        ? normalizedLanguage
        : 'en';

    const handleTimezoneAutoChange = (checked: boolean) => {
        setIsTimezoneAuto(checked);
        if (checked) {
            setTimezone(detectedTimezone);
        }
    };

    const handleTimeFormatChange = (value: string) => {
        setIsTimeFormat24h(value === '24h');
    };

    const handleLanguageChange = (value: string) => {
        void i18n.changeLanguage(value);
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="mint"
                            fallback={<LucideGlobe size={20} />}
                        />
                    </Skeleton>
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('regional.title')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('regional.description')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="4">
                    <Flex justify="between" align="center" gap="3">
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Text weight="medium">{t('regional.autoTimezone')}</Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray" as="p">
                                    {t('regional.autoTimezoneHint', { timezone: detectedTimezone })}
                                </Text>
                            </Skeleton>
                        </Box>
                        <Skeleton loading={isLoading}>
                            <Switch
                                checked={isTimezoneAuto}
                                onCheckedChange={handleTimezoneAutoChange}
                                aria-label={t('regional.autoTimezone')}
                            />
                        </Skeleton>
                    </Flex>

                    {!isTimezoneAuto && (
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray">
                                    {t('common:fields.timezone')}
                                </Text>
                            </Skeleton>
                            <Box mt="2">
                                <Skeleton loading={isLoading}>
                                    <Select.Root
                                        size="2"
                                        value={timezone}
                                        onValueChange={setTimezone}
                                    >
                                        <Select.Trigger />
                                        <Select.Content>
                                            {TIMEZONE_OPTIONS.map(option => (
                                                <Select.Item key={option} value={option}>
                                                    {option}
                                                </Select.Item>
                                            ))}
                                        </Select.Content>
                                    </Select.Root>
                                </Skeleton>
                            </Box>
                        </Box>
                    )}

                    <Flex
                        justify="between"
                        align={{ initial: 'start', sm: 'center' }}
                        direction={{ initial: 'column', sm: 'row' }}
                        gap="3"
                    >
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Text weight="medium">{t('regional.timeFormatTitle')}</Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray" as="p">
                                    {t('regional.timeFormatDescription')}
                                </Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray" as="p" mt="1">
                                    {t('regional.timeFormatPreview')}{' '}
                                    <Text weight="bold" size="2">
                                        {previewTime}
                                    </Text>
                                </Text>
                            </Skeleton>
                        </Box>
                        <Skeleton loading={isLoading}>
                            <SegmentedControl.Root
                                value={isTimeFormat24h ? '24h' : '12h'}
                                onValueChange={handleTimeFormatChange}
                            >
                                <SegmentedControl.Item value="12h">
                                    {t('regional.timeFormat12h')}
                                </SegmentedControl.Item>
                                <SegmentedControl.Item value="24h">
                                    {t('regional.timeFormat24h')}
                                </SegmentedControl.Item>
                            </SegmentedControl.Root>
                        </Skeleton>
                    </Flex>

                    <Separator size="4" />

                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray">
                                {t('common:fields.defaultCurrency')}
                            </Text>
                        </Skeleton>
                        <Box mt="2">
                            <CurrencySelect isLoading={isLoading} />
                        </Box>
                    </Box>

                    <Separator size="4" />

                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('common:fields.interfaceLanguage')}</Text>
                        </Skeleton>
                        <Box mt="2">
                            <Select.Root
                                size="2"
                                value={selectedLanguage}
                                onValueChange={handleLanguageChange}
                            >
                                <Skeleton loading={isLoading}>
                                    <Select.Trigger>
                                        {t(`language.options.${selectedLanguage}`)}
                                    </Select.Trigger>
                                </Skeleton>
                                <Select.Content>
                                    {LANGUAGE_OPTIONS.map(option => (
                                        <Select.Item key={option} value={option}>
                                            {t(`language.options.${option}`)}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Root>
                        </Box>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p" mt="1">
                                {t('regional.languageHint')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>
            </Flex>
        </Card>
    );
};

export default RegionalSection;
