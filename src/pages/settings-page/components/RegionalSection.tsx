import { useState } from 'react';
import { LucideGlobe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Card, Flex, Separator, Skeleton, Text } from '@radix-ui/themes';

import { onChangeLocale, SUPPORTED_LOCALES, SupportedLocale } from 'helpers/locale';
import { detectDeviceTimezone, getAmPm24Time } from 'helpers/time';

import CurrencySelect from 'components/CurrencySelect';
import SegmentedControl from 'components/SegmentedControl';
import Select, { SelectItem } from 'components/Select';

interface Props {
    isLoading: boolean;
}

const RegionalSection = ({ isLoading }: Props) => {
    const { t, i18n } = useTranslation('settings');

    const detectedTimezone = detectDeviceTimezone();
    const [isTimeFormat24h, setIsTimeFormat24h] = useState(false);

    const previewTime24 = getAmPm24Time(new Date(), true);
    const previewTime12 = getAmPm24Time(new Date(), false);

    const selectedLanguage: SupportedLocale = SUPPORTED_LOCALES.includes(
        i18n.language as SupportedLocale,
    )
        ? (i18n.language as SupportedLocale)
        : 'en';

    const handleTimeFormatChange = (value: string) => {
        setIsTimeFormat24h(value === '24h');
    };

    const handleLanguageChange = (value: string) => {
        onChangeLocale(value as SupportedLocale);
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
                    </Flex>

                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray">
                                {t('common:fields.timezone')}
                            </Text>
                        </Skeleton>
                    </Box>

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
                        </Box>
                        <Skeleton loading={isLoading}>
                            <SegmentedControl
                                value={isTimeFormat24h ? '24h' : '12h'}
                                onValueChange={handleTimeFormatChange}
                                items={[
                                    { value: '12h', label: previewTime12 },
                                    { value: '24h', label: previewTime24 },
                                ]}
                            />
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
                            <Select
                                items={SUPPORTED_LOCALES.map(option => {
                                    return {
                                        value: option,
                                        label: t(`language.options.${option}`),
                                    } satisfies SelectItem;
                                })}
                                size="2"
                                value={selectedLanguage}
                                onChange={handleLanguageChange}
                                renderValue={item => {
                                    return item?.label;
                                }}
                            />
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
