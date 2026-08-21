import {
    LucideMonitor,
    LucideMoon,
    LucideRefreshCw,
    LucideSettings2,
    LucideSun,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
    Avatar,
    Button,
    Card,
    Code,
    Flex,
    Separator,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import { APP_VERSION } from 'constants/version';
import { applySwUpdate } from 'helpers/swUpdates';
import type { ThemeName } from 'helpers/theme';
import { usePwaStore } from 'store/pwaStore';
import { selectUserTheme, useUsersStore } from 'store/users-store';

import SegmentedControl from 'components/SegmentedControl';

interface Props {
    isLoading: boolean;
}

const AppSettingsSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const isSwUpdateAvailable = usePwaStore(s => s.isSwUpdateAvailable);
    const { setUserSettings, theme } = useUsersStore(
        useShallow(state => ({
            setUserSettings: state.setUserSettings,
            theme: selectUserTheme(state),
        })),
    );

    const onChangeTheme = (value: string) => {
        const nextTheme = value as ThemeName;

        setUserSettings({ settings: { theme: nextTheme } });
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
                            fallback={<LucideSettings2 size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('app.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('app.description')}
                            </Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="4">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('app.themeTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('app.themeDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>

                    <Skeleton loading={isLoading}>
                        <SegmentedControl
                            value={theme}
                            onValueChange={onChangeTheme}
                            items={[
                                {
                                    value: 'dark',
                                    label: (
                                        <Flex align="center" gap="1">
                                            <LucideMoon size={14} />
                                            {t('app.themeOptions.dark')}
                                        </Flex>
                                    ),
                                },
                                {
                                    value: 'light',
                                    label: (
                                        <Flex align="center" gap="1">
                                            <LucideSun size={14} />
                                            {t('app.themeOptions.light')}
                                        </Flex>
                                    ),
                                },
                                {
                                    value: 'system',
                                    label: (
                                        <Flex align="center" gap="1">
                                            <LucideMonitor size={14} />
                                            {t('app.themeOptions.system')}
                                        </Flex>
                                    ),
                                },
                            ]}
                        />
                    </Skeleton>

                    <Separator size="4" />

                    <Flex justify="between" align="center">
                        <Flex direction="column">
                            <Text weight="medium">
                                <Skeleton loading={isLoading}>
                                    {t('app.versionTitle')}
                                </Skeleton>
                            </Text>
                            <Text size="2" color="gray">
                                <Skeleton loading={isLoading}>
                                    {t('app.versionDescription')}
                                </Skeleton>
                            </Text>
                            <Flex align="center" gap="3" mt="2">
                                <Skeleton loading={isLoading}>
                                    <Code>{APP_VERSION}</Code>
                                </Skeleton>
                            </Flex>
                        </Flex>
                        {isSwUpdateAvailable && (
                            <Button
                                variant="soft"
                                color="jade"
                                size="2"
                                onClick={applySwUpdate}
                            >
                                <LucideRefreshCw size={12} />
                                {t('app.updateButton')}
                            </Button>
                        )}
                    </Flex>
                </Flex>
            </Flex>
        </Card>
    );
};

export default AppSettingsSection;
