import { LucideArrowRight, LucideChartBar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, Box, Button, Card, Flex, Skeleton, Text } from '@radix-ui/themes';

import { AppEvent } from 'api/activity.types';
import { ROUTES } from 'constants/routes';
import { formatRelativeTime } from 'helpers/time';
import { useActivityStore } from 'store/activityStore';
import { selectDashboardLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { Amount } from 'basics/numbers';

import UserAvatar from './UserAvatar';

interface ActivityListItem {
    id: string;
    title: string;
    description: string;
    createdAt: number;
    amount?: number;
    currency?: string;
    avatarSrc?: string;
    avatarFallback: string;
}

const getActivityItem = (
    event: AppEvent,
    t: (key: string, options?: Record<string, string>) => string,
): ActivityListItem => {
    const avatarFallback = event.actorSnapshot.displayName.charAt(0) || '?';

    switch (event.action) {
        case 'EXPENSE_CREATED': {
            const amount = Number(event.metadata.amount);

            return {
                id: event.id,
                title: event.metadata.description,
                description: t('event.expenseCreatedDescription', {
                    payer: event.metadata.payerDisplayName,
                    group: event.metadata.groupName,
                }),
                createdAt: event.createdAt,
                amount: Number.isFinite(amount) ? amount : undefined,
                currency: event.metadata.currency,
                avatarSrc: event.actorSnapshot.picture,
                avatarFallback,
            };
        }
        case 'GROUP_CREATED':
            return {
                id: event.id,
                title: event.metadata.groupName,
                description: t('event.groupCreatedDescription', {
                    actor: event.actorSnapshot.displayName,
                }),
                createdAt: event.createdAt,
                avatarSrc: event.actorSnapshot.picture,
                avatarFallback,
            };
        case 'GROUP_UPDATED':
            return {
                id: event.id,
                title: event.metadata.groupName,
                description: t('event.groupUpdatedDescription', {
                    actor: event.actorSnapshot.displayName,
                }),
                createdAt: event.createdAt,
                avatarSrc: event.actorSnapshot.picture,
                avatarFallback,
            };
        case 'GROUP_DELETED':
            return {
                id: event.id,
                title: event.metadata.groupName,
                description: t('event.groupDeletedDescription', {
                    actor: event.actorSnapshot.displayName,
                }),
                createdAt: event.createdAt,
                avatarSrc: event.actorSnapshot.picture,
                avatarFallback,
            };
    }
};

const ActivityTemplate = () => {
    const { t } = useTranslation('activity');
    const activity = useActivityStore(state => state.items);
    const isLoading = useLoadingStore(selectDashboardLoading);
    console.log(activity);

    const activityItems = activity.map(event => getActivityItem(event, t));

    return (
        <>
            <Box mb="6">
                <Flex justify="between" align="center">
                    <Flex align="center" gap="4">
                        <Skeleton loading={isLoading}>
                            <Avatar size="5" color="cyan" fallback={<LucideChartBar size={32} />} />
                        </Skeleton>
                        <Flex direction="column">
                            <Skeleton loading={isLoading}>
                                <Text size="4" weight="medium" as="p" mb="2">
                                    {t('title')}
                                </Text>
                            </Skeleton>
                            <Skeleton loading={isLoading}>
                                <Text size="2" as="p">
                                    {t('subtitle')}
                                </Text>
                            </Skeleton>
                        </Flex>
                    </Flex>

                    <Skeleton loading={isLoading}>
                        <Link to={ROUTES.ACTIVITY}>
                            <Button variant="ghost" size="4">
                                {t('viewAll')}
                                <LucideArrowRight />
                            </Button>
                        </Link>
                    </Skeleton>
                </Flex>
            </Box>

            {!isLoading && activityItems.length === 0 ? (
                <Card size="2">
                    <Flex direction="column" gap="1">
                        <Text size="4" weight="medium" as="p">
                            {t('emptyTitle')}
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t('emptyDescription')}
                        </Text>
                    </Flex>
                </Card>
            ) : (
                activityItems.map(item => (
                    <Card key={item.id} size="2" mb="4">
                        <Flex justify="between" align="center" gap="3">
                            <Flex gap="4" align="center">
                                <Skeleton loading={isLoading}>
                                    <UserAvatar
                                        size="3"
                                        src={item.avatarSrc}
                                        fallback={item.avatarFallback}
                                    />
                                </Skeleton>
                                <Box>
                                    <Flex direction="column" gap="1">
                                        <Skeleton loading={isLoading}>
                                            <Text size="4" weight="medium" as="p">
                                                {item.title}
                                            </Text>
                                        </Skeleton>
                                        <Skeleton loading={isLoading}>
                                            <Text size="2" color="gray" as="p">
                                                {item.description}
                                            </Text>
                                        </Skeleton>
                                    </Flex>
                                </Box>
                            </Flex>
                            <Flex direction="column" align="end" gap="1">
                                {item.amount !== undefined ? (
                                    <Skeleton loading={isLoading}>
                                        <Text size="4" weight="bold" as="p">
                                            <Amount value={item.amount} tokenCode={item.currency} />
                                        </Text>
                                    </Skeleton>
                                ) : null}
                                <Skeleton loading={isLoading}>
                                    <Text size="2" color="gray" as="p">
                                        {/* TODO FORMATTER FOR SECONDS */}
                                        {formatRelativeTime(new Date(item.createdAt * 1000))}
                                    </Text>
                                </Skeleton>
                            </Flex>
                        </Flex>
                    </Card>
                ))
            )}
        </>
    );
};

export default ActivityTemplate;
