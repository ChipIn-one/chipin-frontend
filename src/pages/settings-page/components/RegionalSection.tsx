import { LucideGlobe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Card, Flex, Separator, Skeleton, Text } from '@radix-ui/themes';

import type { UserSettings } from 'api/chipin.types';
import { matchLocale, onChangeLocale, SUPPORTED_LOCALES, SupportedLocale } from 'helpers/locale';
import { detectDeviceTimezone, getAmPm24Time } from 'helpers/time';
import { selectUserCurrency, selectUserLanguage, selectUserTimeFormat } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import CurrencySelect from 'components/CurrencySelect';
import SegmentedControl from 'components/SegmentedControl';
import Select, { SelectItem } from 'components/Select';

interface Props {
    isLoading: boolean;
}

const RegionalSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const setUserSettings = useUsersStore(s => s.setUserSettings);
    const defaultCurrency = useUsersStore(selectUserCurrency);
    const timeFormat = useUsersStore(selectUserTimeFormat);
    const language = useUsersStore(selectUserLanguage);

    const detectedTimezone = detectDeviceTimezone();

    const previewTime24 = getAmPm24Time(new Date(), true);
    const previewTime12 = getAmPm24Time(new Date(), false);

    const selectedLanguage = matchLocale(language) ?? 'en';

    const handleTimeFormatChange = (value: string) => {
        setUserSettings({
            settings: { timeFormat: value as UserSettings['timeFormat'] },
        });
    };

    const handleDefaultCurrencyChange = (value: string) => {
        setUserSettings({ settings: { defaultCurrency: value } });
    };

    const handleLanguageChange = (value: string) => {
        const locale = value as SupportedLocale;

        setUserSettings({ settings: { language: locale } });
        onChangeLocale(locale);
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
                                value={timeFormat}
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
                            <CurrencySelect
                                currency={defaultCurrency}
                                isLoading={isLoading}
                                onChange={handleDefaultCurrencyChange}
                            />
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
