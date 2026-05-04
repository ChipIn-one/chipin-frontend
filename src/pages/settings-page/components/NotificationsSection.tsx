import { LucideBell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Card, Flex, Separator, Skeleton, Switch, Text } from '@radix-ui/themes';

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
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('notifications.title')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('notifications.description')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('notifications.pushTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('notifications.pushDescription')}
                            </Text>
                        </Skeleton>
                    </Box>
                    <Skeleton loading={isLoading}>
                        <Switch defaultChecked aria-label={t('notifications.pushTitle')} />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('notifications.emailTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('notifications.emailDescription')}
                            </Text>
                        </Skeleton>
                    </Box>
                    <Skeleton loading={isLoading}>
                        <Switch aria-label={t('notifications.emailTitle')} />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('notifications.expenseRemindersTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('notifications.expenseRemindersDescription')}
                            </Text>
                        </Skeleton>
                    </Box>
                    <Skeleton loading={isLoading}>
                        <Switch
                            defaultChecked
                            aria-label={t('notifications.expenseRemindersTitle')}
                        />
                    </Skeleton>
                </Flex>

                <Separator size="4" />

                <Flex justify="between" align="center" gap="3">
                    <Box>
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('notifications.weeklySummaryTitle')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('notifications.weeklySummaryDescription')}
                            </Text>
                        </Skeleton>
                    </Box>
                    <Skeleton loading={isLoading}>
                        <Switch aria-label={t('notifications.weeklySummaryTitle')} />
                    </Skeleton>
                </Flex>
            </Flex>
        </Card>
    );
};

export default NotificationsSection;
