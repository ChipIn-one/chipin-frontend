import { useState } from 'react';
import {
    LucideMonitor,
    LucideMoon,
    LucideRefreshCw,
    LucideSettings2,
    LucideSun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Box,
    Button,
    Card,
    Code,
    Flex,
    Separator,
    Skeleton,
    Switch,
    Text,
} from '@radix-ui/themes';

import { APP_VERSION } from 'constants/version';
import { applySwUpdate } from 'helpers/swUpdates';
import { usePwaStore } from 'store/pwaStore';

import SegmentedControl from 'components/SegmentedControl';

interface Props {
    isLoading: boolean;
}

const AppSettingsSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const { theme, setTheme } = useTheme();
    const isSwUpdateAvailable = usePwaStore(s => s.isSwUpdateAvailable);

    const [isSimplifyDebtsEnabled, setIsSimplifyDebtsEnabled] = useState(true);
    const [isAutoSplitEnabled, setIsAutoSplitEnabled] = useState(false);
    const [isShowCentsEnabled, setIsShowCentsEnabled] = useState(true);

    const selectedTheme = (theme as 'light' | 'dark' | 'system' | undefined) || 'system';

    const handleThemeChange = (value: string) => {
        if (value === 'light' || value === 'dark' || value === 'system') {
            setTheme(value);
        }
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
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('app.title')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('app.description')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="4">
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('app.themeTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('app.themeDescription')}
                            </Text>
                        </Skeleton>
                    </Box>

                    <Skeleton loading={isLoading}>
                        <SegmentedControl
                            value={selectedTheme}
                            onValueChange={handleThemeChange}
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

                    <Flex justify="between" align="center" gap="3">
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Text weight="medium">{t('app.simplifyDebtsTitle')}</Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray" as="p">
                                    {t('app.simplifyDebtsDescription')}
                                </Text>
                            </Skeleton>
                        </Box>
                        <Skeleton loading={isLoading}>
                            <Switch
                                checked={isSimplifyDebtsEnabled}
                                onCheckedChange={setIsSimplifyDebtsEnabled}
                                aria-label={t('app.simplifyDebtsTitle')}
                            />
                        </Skeleton>
                    </Flex>

                    <Separator size="4" />

                    <Flex justify="between" align="center" gap="3">
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Text weight="medium">{t('app.autoSplitTitle')}</Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray" as="p">
                                    {t('app.autoSplitDescription')}
                                </Text>
                            </Skeleton>
                        </Box>
                        <Skeleton loading={isLoading}>
                            <Switch
                                checked={isAutoSplitEnabled}
                                onCheckedChange={setIsAutoSplitEnabled}
                                aria-label={t('app.autoSplitTitle')}
                            />
                        </Skeleton>
                    </Flex>

                    <Separator size="4" />

                    <Flex justify="between" align="center" gap="3">
                        <Box>
                            <Skeleton loading={isLoading}>
                                <Text weight="medium">{t('app.showCentsTitle')}</Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" color="gray" as="p">
                                    {t('app.showCentsDescription')}
                                </Text>
                            </Skeleton>
                        </Box>
                        <Skeleton loading={isLoading}>
                            <Switch
                                checked={isShowCentsEnabled}
                                onCheckedChange={setIsShowCentsEnabled}
                                aria-label={t('app.showCentsTitle')}
                            />
                        </Skeleton>
                    </Flex>

                    <Separator size="4" />

                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('app.versionTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('app.versionDescription')}
                            </Text>
                        </Skeleton>
                        <Flex align="center" gap="3" mt="2">
                            <Skeleton loading={isLoading}>
                                <Code>{APP_VERSION}</Code>
                            </Skeleton>
                            {isSwUpdateAvailable && (
                                <Button
                                    variant="soft"
                                    color="jade"
                                    size="1"
                                    onClick={applySwUpdate}
                                >
                                    <LucideRefreshCw size={12} />
                                    {t('app.updateButton')}
                                </Button>
                            )}
                        </Flex>
                    </Box>
                </Flex>
            </Flex>
        </Card>
    );
};

export default AppSettingsSection;
