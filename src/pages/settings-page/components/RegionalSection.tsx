import { LucideGlobe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Card, Flex, Separator, Skeleton, Text } from '@radix-ui/themes';

import type { UserSettings } from 'api/chipin.types';
import { matchLocale, onChangeLocale, SUPPORTED_LOCALES, SupportedLocale } from 'helpers/locale';
import { detectDeviceTimezone, getAmPm24Time } from 'helpers/time';
import {
    selectIsUserTime24H,
    selectUserCurrency,
    selectUserLanguage,
} from 'store/usersSelectors';
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
    const isUserTime24H = useUsersStore(selectIsUserTime24H);
    const language = useUsersStore(selectUserLanguage);

    const detectedTimezone = detectDeviceTimezone();

    const previewTime24 = getAmPm24Time(new Date(), true);
    const previewTime12 = getAmPm24Time(new Date(), false);

    const selectedLanguage = matchLocale(language) ?? 'en';

    const onTimeFormatChange = (value: string) => {
        setUserSettings({
            settings: { timeFormat: value as UserSettings['timeFormat'] },
        });
    };

    const onDefaultCurrencyChange = (value: string) => {
        setUserSettings({ settings: { defaultCurrency: value } });
    };

    const onLanguageChange = (value: string) => {
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
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('regional.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('regional.description')}
                            </Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="4">
                    <Flex justify="between" align="center" gap="3">
                        <Flex direction="column">
                            <Text weight="medium">
                                <Skeleton loading={isLoading}>
                                    {t('regional.autoTimezone')}
                                </Skeleton>
                            </Text>
                            <Text size="2" color="gray">
                                <Skeleton loading={isLoading}>
                                    {t('regional.autoTimezoneHint', { timezone: detectedTimezone })}
                                </Skeleton>
                            </Text>
                        </Flex>
                    </Flex>

                    <Box>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('common:fields.timezone')}
                            </Skeleton>
                        </Text>
                    </Box>

                    <Flex
                        justify="between"
                        align={{ initial: 'start', sm: 'center' }}
                        direction={{ initial: 'column', sm: 'row' }}
                        gap="3"
                    >
                        <Flex direction="column">
                            <Text weight="medium">
                                <Skeleton loading={isLoading}>
                                    {t('regional.timeFormatTitle')}
                                </Skeleton>
                            </Text>
                            <Text size="2" color="gray">
                                <Skeleton loading={isLoading}>
                                    {t('regional.timeFormatDescription')}
                                </Skeleton>
                            </Text>
                        </Flex>
                        <Skeleton loading={isLoading}>
                            <SegmentedControl
                                value={isUserTime24H ? '24h' : '12h'}
                                onValueChange={onTimeFormatChange}
                                items={[
                                    { value: '12h', label: previewTime12 },
                                    { value: '24h', label: previewTime24 },
                                ]}
                            />
                        </Skeleton>
                    </Flex>

                    <Separator size="4" />

                    <Box>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('common:fields.defaultCurrency')}
                            </Skeleton>
                        </Text>
                        <Box mt="2">
                            <CurrencySelect
                                currency={defaultCurrency}
                                isLoading={isLoading}
                                onChange={onDefaultCurrencyChange}
                            />
                        </Box>
                    </Box>

                    <Separator size="4" />

                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>
                                {t('common:fields.interfaceLanguage')}
                            </Skeleton>
                        </Text>
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
                                onChange={onLanguageChange}
                                renderValue={item => {
                                    return item?.label;
                                }}
                            />
                        </Box>
                        <Box mt="1">
                            <Text size="2" color="gray">
                                <Skeleton loading={isLoading}>
                                    {t('regional.languageHint')}
                                </Skeleton>
                            </Text>
                        </Box>
                    </Flex>
                </Flex>
            </Flex>
        </Card>
    );
};

export default RegionalSection;
