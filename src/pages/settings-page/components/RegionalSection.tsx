import { LucideGlobe, LucideRotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
    Avatar,
    Box,
    Button,
    Card,
    Flex,
    Separator,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import type { UserSettings } from 'api/chipin.types';
import {
    matchLocale,
    resolveBrowserLocale,
    type SupportedLocale,
} from 'helpers/locale';
import { detectDeviceTimezone, formatUtcOffset, getAmPm24Time } from 'helpers/time';
import {
    selectIsUserTime24H,
    selectUserLanguage,
    useUsersStore,
} from 'store/users-store';

import LanguageSelector from 'components/LanguageSelector';
import SegmentedControl from 'components/SegmentedControl';

interface Props {
    isLoading: boolean;
}

const RegionalSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const { isUserTime24H, language, setUserSettings } = useUsersStore(
        useShallow(state => ({
            isUserTime24H: selectIsUserTime24H(state),
            language: selectUserLanguage(state),
            setUserSettings: state.setUserSettings,
        })),
    );

    const detectedTimezone = detectDeviceTimezone();
    const utcOffset = formatUtcOffset(new Date().getTimezoneOffset());
    const previewTime24 = getAmPm24Time(new Date(), true);
    const previewTime12 = getAmPm24Time(new Date(), false);
    const selectedLanguage = matchLocale(language) ?? 'en';

    const onTimeFormatChange = (value: string) => {
        setUserSettings({
            settings: { timeFormat: value as UserSettings['timeFormat'] },
        });
    };

    const onLanguageChange = (locale: SupportedLocale) => {
        setUserSettings({ settings: { language: locale } });
    };

    const onUseSystemLanguage = () => {
        onLanguageChange(resolveBrowserLocale());
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
                    <Flex
                        justify="between"
                        align={{ initial: 'start', sm: 'center' }}
                        direction={{ initial: 'column', sm: 'row' }}
                        gap="3"
                    >
                        <Flex direction="column">
                            <Text weight="medium">
                                <Skeleton loading={isLoading}>
                                    {t('regional.autoTimezone')}
                                </Skeleton>
                            </Text>
                            <Text size="2" color="gray">
                                <Skeleton loading={isLoading}>
                                    {t('regional.autoTimezoneHint')}
                                </Skeleton>
                            </Text>
                        </Flex>

                        <Skeleton loading={isLoading}>
                            <Flex align="center" gap="2">
                                <Text size="2" weight="medium">
                                    {utcOffset}
                                </Text>
                                <Separator orientation="vertical" size="2" />
                                <Text size="2" color="gray">
                                    {detectedTimezone}
                                </Text>
                            </Flex>
                        </Skeleton>
                    </Flex>

                    <Separator size="4" />

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
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>
                                {t('common:fields.interfaceLanguage')}
                            </Skeleton>
                        </Text>
                        <Flex
                            mt="2"
                            align={{ initial: 'stretch', sm: 'center' }}
                            direction={{ initial: 'column', sm: 'row' }}
                            gap="2"
                        >
                            <Box flexGrow="1">
                                <LanguageSelector
                                    value={selectedLanguage}
                                    isLoading={isLoading}
                                    onChange={onLanguageChange}
                                />
                            </Box>
                            <Button
                                type="button"
                                variant="soft"
                                color="gray"
                                size="3"
                                disabled={isLoading}
                                onClick={onUseSystemLanguage}
                            >
                                <LucideRotateCcw size={16} />
                                {t('regional.resetLanguage')}
                            </Button>
                        </Flex>
                    </Box>
                </Flex>
            </Flex>
        </Card>
    );
};

export default RegionalSection;
