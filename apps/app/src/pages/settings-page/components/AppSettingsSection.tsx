import { PROP_COLOR } from '@chipin/tokens/theme';
import { Avatar, Button, Card, Code, Flex, Separator, Skeleton, Text } from '@radix-ui/themes';
import {
    type LucideIcon,
    MonitorIcon,
    MoonIcon,
    RefreshCwIcon,
    Settings2Icon,
    SunIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { APP_VERSION } from 'constants/version';
import { userTheme } from 'entities/users';
import { updateServiceWorker } from 'helpers/appUpdate';
import type { ThemeName } from 'helpers/theme';
import { useUserSetting } from 'hooks/useSelfUser';
import { useUpdateSelf } from 'hooks/useUserMutations';
import { usePwaStore } from 'store/pwaStore';

import { SegmentedControl } from 'basics/SegmentedControl';
import { OnlineOnlyGroup } from 'components/online-only';

import styles from './AppSettingsSection.module.css';

interface Props {
    isLoading: boolean;
}

/** #316: the icon hides on narrow controls (see the CSS module); the text never wraps. */
const ThemeOptionLabel = ({ icon: Icon, text }: { icon: LucideIcon; text: string }) => (
    <Flex align="center" justify="center" gap="1" minWidth="0">
        <Icon size={14} className={styles.themeIcon} aria-hidden />
        <span className={styles.themeLabelText}>{text}</span>
    </Flex>
);

const AppSettingsSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const isSwUpdateAvailable = usePwaStore(s => s.isSwUpdateAvailable);
    const { updateSelf } = useUpdateSelf();
    const theme = useUserSetting(userTheme);

    const onChangeTheme = (value: string) => {
        const nextTheme = value as ThemeName;

        void updateSelf({ settings: { theme: nextTheme } });
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color={PROP_COLOR.neutral}
                            fallback={<Settings2Icon size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('app.title')}</Skeleton>
                        </Text>
                        <Text size="2" color={PROP_COLOR.neutral}>
                            <Skeleton loading={isLoading}>{t('app.description')}</Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Flex direction="column" gap="4">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('app.themeTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color={PROP_COLOR.neutral}>
                            <Skeleton loading={isLoading}>{t('app.themeDescription')}</Skeleton>
                        </Text>
                    </Flex>

                    <OnlineOnlyGroup action={ONLINE_ONLY_ACTIONS.userSettings}>
                        <Skeleton loading={isLoading}>
                            <SegmentedControl
                                fill
                                className={styles.themeControl}
                                value={theme}
                                onValueChange={onChangeTheme}
                                items={[
                                    {
                                        value: 'dark',
                                        label: (
                                            <ThemeOptionLabel
                                                icon={MoonIcon}
                                                text={t('app.themeOptions.dark')}
                                            />
                                        ),
                                    },
                                    {
                                        value: 'light',
                                        label: (
                                            <ThemeOptionLabel
                                                icon={SunIcon}
                                                text={t('app.themeOptions.light')}
                                            />
                                        ),
                                    },
                                    {
                                        value: 'system',
                                        label: (
                                            <ThemeOptionLabel
                                                icon={MonitorIcon}
                                                text={t('app.themeOptions.system')}
                                            />
                                        ),
                                    },
                                ]}
                            />
                        </Skeleton>
                    </OnlineOnlyGroup>

                    <Separator size="4" />

                    <Flex justify="between" align="center">
                        <Flex direction="column">
                            <Text weight="medium">
                                <Skeleton loading={isLoading}>{t('app.versionTitle')}</Skeleton>
                            </Text>
                            <Text size="2" color={PROP_COLOR.neutral}>
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
                                color={PROP_COLOR.accent}
                                size="2"
                                onClick={() => void updateServiceWorker(true)}
                            >
                                <RefreshCwIcon size={12} />
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
