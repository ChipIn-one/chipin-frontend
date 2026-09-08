import { LucideBell, LucideInfo } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Callout,
    Card,
    Flex,
    Separator,
    Skeleton,
    Switch,
    Text,
} from '@radix-ui/themes';

interface Props {
    isLoading: boolean;
}

const NotificationsSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="mint"
                            fallback={<LucideBell size={20} />}
                        />
                    </Skeleton>
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('notifications.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('notifications.description')}
                            </Skeleton>
                        </Text>
                    </Flex>
                </Flex>

                <Callout.Root color="blue" size="2">
                    <Callout.Icon>
                        <LucideInfo size={16} />
                    </Callout.Icon>
                    <Callout.Text>{t('notifications.workInProgress')}</Callout.Text>
                </Callout.Root>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('notifications.pushTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('notifications.pushDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch
                            disabled
                            defaultChecked
                            aria-label={t('notifications.pushTitle')}
                        />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('notifications.emailTitle')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('notifications.emailDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch disabled aria-label={t('notifications.emailTitle')} />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>
                                {t('notifications.expenseRemindersTitle')}
                            </Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('notifications.expenseRemindersDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch
                            disabled
                            defaultChecked
                            aria-label={t('notifications.expenseRemindersTitle')}
                        />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Flex direction="column">
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>
                                {t('notifications.weeklySummaryTitle')}
                            </Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('notifications.weeklySummaryDescription')}
                            </Skeleton>
                        </Text>
                    </Flex>
                    <Skeleton loading={isLoading}>
                        <Switch disabled aria-label={t('notifications.weeklySummaryTitle')} />
                    </Skeleton>
                </Flex>
            </Flex>
        </Card>
    );
};

export default NotificationsSection;
