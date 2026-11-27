import { Card, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';
import { ArrowRightIcon, ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import type {
    ActivityEvent,
    ExpenseActivityDetails,
    ExpenseActivityEvent,
    SettlementActivityEvent,
} from 'entities/activity';
import { legacyAmountFromMoney } from 'entities/balance';
import type { ActivitySubeventsView } from 'helpers/activityEvent';
import { formatActivityAbsoluteDate } from 'helpers/time';

import { Amount, LedgerScopeBadge } from 'basics';

import { ActivitySubeventsButtons } from '../activity-subevents-buttons';

import styles from './ActivitySubeventsDetails.module.css';

interface Props {
    view?: ActivitySubeventsView<ActivityEvent>;
    /** The chain's later events (the expense editor starts from the latest). */
    childEvents: readonly ActivityEvent[];
    /** The id the history query is keyed by (the route's). */
    parentActivityId: string | undefined;
    /** False when the shown state may be stale: Edit and Delete are disabled. */
    canChange: boolean;
    isLoading: boolean;
}

const isExpenseEvent = (event: ActivityEvent): event is ExpenseActivityEvent =>
    event.metadata?.type === 'expense';

const isSettlementEvent = (event: ActivityEvent): event is SettlementActivityEvent =>
    event.metadata?.type === 'settlement';

const getSharingModeLabel = (
    metadata: ExpenseActivityDetails,
): 'auto' | 'exact' | 'percentage' | 'shares' => {
    const sharingMode = metadata.sharingMode?.type ?? 'EXACT';

    switch (sharingMode) {
        case 'AUTO':
            return 'auto';
        case 'PERCENTAGE':
            return 'percentage';
        case 'SHARES':
            return 'shares';
        case 'EXACT':
            return 'exact';
    }
};

const ActivitySubeventsDetails = ({
    view,
    childEvents,
    parentActivityId,
    canChange,
    isLoading,
}: Props) => {
    const { t, i18n } = useTranslation(['activity', 'group']);
    const { groupId: routeGroupId } = useParams<{ groupId: string }>();

    if (isLoading) {
        return (
            <Card className={styles.detailsCard} size="3">
                <Flex direction="column" gap="3">
                    <Skeleton>
                        <Heading size="4">{t('subeventsCurrentStateTitle')}</Heading>
                    </Skeleton>
                    <Skeleton>
                        <Text size="2">{t('subeventsDetailsAction')}</Text>
                    </Skeleton>
                </Flex>
            </Card>
        );
    }

    if (!view) {
        return null;
    }

    const { originalEvent, currentEvent } = view;
    const expenseEvent = isExpenseEvent(currentEvent) ? currentEvent : undefined;
    const settlementEvent = isSettlementEvent(currentEvent) ? currentEvent : undefined;
    const locale = i18n?.language ?? 'en';
    const createdAt = formatActivityAbsoluteDate(originalEvent.createdAt, locale);
    const metadata = currentEvent.metadata;
    const groupId =
        metadata && 'groupId' in metadata
            ? (metadata.groupId ?? originalEvent.groupId ?? null)
            : (originalEvent.groupId ?? null);
    const groupName = metadata && 'groupName' in metadata ? (metadata.groupName ?? null) : null;

    const detailsContent = expenseEvent ? (
        <Flex direction="column" gap="3">
            <Heading size="4">{t('subeventsCurrentStateTitle')}</Heading>

            {expenseEvent.metadata.description ? (
                <Text size="3" weight="medium">
                    {expenseEvent.metadata.description}
                </Text>
            ) : null}

            <Text size="6" weight="bold">
                <Amount
                    value={legacyAmountFromMoney(expenseEvent.metadata.amount)}
                    tokenCode={expenseEvent.metadata.amount.currency}
                    type="summary"
                />
            </Text>

            <Flex direction="column" gap="2">
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsPayer')}
                    </Text>
                    <Text size="2">{expenseEvent.metadata.payerDisplayName}</Text>
                </Flex>
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsCreatedAt')}
                    </Text>
                    <Text size="2">{createdAt}</Text>
                </Flex>
                <Flex className={styles.detailRow} gap="3" pt="2" align="center">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsScope')}
                    </Text>
                    <LedgerScopeBadge
                        groupId={groupId}
                        groupName={groupName}
                        currentGroupId={routeGroupId}
                    />
                </Flex>
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsCategory')}
                    </Text>
                    <Text size="2">
                        {expenseEvent.metadata.category
                            ? t(`group:expenses.modal.categories.${expenseEvent.metadata.category}`)
                            : '—'}
                    </Text>
                </Flex>
                {expenseEvent.metadata.subcategory ? (
                    <Flex className={styles.detailRow} gap="3" pt="2">
                        <Text className={styles.detailLabel} size="1" color="gray">
                            {t('subeventsSubcategory')}
                        </Text>
                        <Text size="2">
                            {t(
                                `group:expenses.modal.subcategories.${expenseEvent.metadata.subcategory}`,
                            )}
                        </Text>
                    </Flex>
                ) : null}
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsSharingMode')}
                    </Text>
                    <Text size="2">
                        {t(`subeventsSharingModes.${getSharingModeLabel(expenseEvent.metadata)}`)}
                    </Text>
                </Flex>
            </Flex>

            <Flex direction="column" gap="1">
                <Text size="1" color="gray" weight="medium">
                    {t('subeventsParticipants')}
                </Text>
                {expenseEvent.metadata.shares?.map(share => (
                    <Flex
                        className={styles.participantRow}
                        key={share.userId}
                        justify="between"
                        gap="3"
                        py="2"
                    >
                        <Text size="2">{share.displayName}</Text>
                        <Amount
                            value={legacyAmountFromMoney(share.shareAmount)}
                            tokenCode={share.shareAmount.currency}
                            type="summary"
                        />
                    </Flex>
                ))}
            </Flex>

            <ActivitySubeventsButtons
                parentEvent={originalEvent}
                currentEvent={currentEvent}
                childEvents={childEvents}
                parentActivityId={parentActivityId}
                canChange={canChange}
            />
        </Flex>
    ) : settlementEvent ? (
        <Flex direction="column" gap="3">
            <Heading size="4">{t('subeventsCurrentStateTitle')}</Heading>
            <Text size="6" weight="bold">
                <Amount
                    value={legacyAmountFromMoney(settlementEvent.metadata.amount)}
                    tokenCode={settlementEvent.metadata.amount.currency}
                    type="summary"
                />
            </Text>
            <Flex direction="column" gap="2">
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsFrom')}
                    </Text>
                    <Text size="2">{settlementEvent.metadata.fromDisplayName}</Text>
                </Flex>
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsTo')}
                    </Text>
                    <Text size="2">{settlementEvent.metadata.toDisplayName}</Text>
                </Flex>
                <Flex className={styles.detailRow} gap="3" pt="2">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsCreatedAt')}
                    </Text>
                    <Text size="2">{createdAt}</Text>
                </Flex>
                <Flex className={styles.detailRow} gap="3" pt="2" align="center">
                    <Text className={styles.detailLabel} size="1" color="gray">
                        {t('subeventsScope')}
                    </Text>
                    <LedgerScopeBadge
                        groupId={groupId}
                        groupName={groupName}
                        currentGroupId={routeGroupId}
                    />
                </Flex>
            </Flex>

            <ActivitySubeventsButtons
                parentEvent={originalEvent}
                currentEvent={currentEvent}
                childEvents={childEvents}
                parentActivityId={parentActivityId}
                canChange={canChange}
            />
        </Flex>
    ) : null;

    if (!detailsContent) {
        return null;
    }

    const summary = expenseEvent ? (
        <Flex direction="column" gap="1">
            <Flex justify="between" align="center" gap="3">
                <Text size="2" weight="medium" truncate>
                    {expenseEvent.metadata.description || t('subeventsExpenseHistoryTitle')}
                </Text>
                <Text size="3" weight="bold">
                    <Amount
                        value={legacyAmountFromMoney(expenseEvent.metadata.amount)}
                        tokenCode={expenseEvent.metadata.amount.currency}
                        type="summary"
                    />
                </Text>
            </Flex>
            <Text size="1" color="gray">
                {expenseEvent.metadata.payerDisplayName}
            </Text>
            <Text size="1" color="gray">
                {t('subeventsParticipantCount', {
                    count: expenseEvent.metadata.shares?.length ?? 0,
                })}
            </Text>
        </Flex>
    ) : (
        <Flex direction="column" gap="1">
            <Flex justify="between" align="center" gap="3">
                <Text size="2" weight="medium">
                    {settlementEvent?.metadata.fromDisplayName}
                    <ArrowRightIcon size={14} aria-hidden="true" />
                    {settlementEvent?.metadata.toDisplayName}
                </Text>
                <Text size="3" weight="bold">
                    <Amount
                        value={
                            settlementEvent
                                ? legacyAmountFromMoney(settlementEvent.metadata.amount)
                                : 0
                        }
                        tokenCode={settlementEvent?.metadata.amount.currency ?? ''}
                        type="summary"
                    />
                </Text>
            </Flex>
            <Text size="1" color="gray">
                {createdAt}
            </Text>
        </Flex>
    );

    return (
        <>
            <Flex display={{ initial: 'none', sm: 'flex' }}>
                <Card className={styles.detailsCard} size="3">
                    {detailsContent}
                </Card>
            </Flex>

            <Flex display={{ initial: 'flex', sm: 'none' }}>
                <details className={styles.mobileDetails}>
                    <summary className={styles.mobileSummary}>
                        <Card className={styles.summarySurface} size="2">
                            <Flex justify="between" align="center" gap="3">
                                {summary}
                                <ChevronDownIcon
                                    className={styles.chevron}
                                    size={16}
                                    aria-hidden="true"
                                />
                            </Flex>
                        </Card>
                    </summary>
                    <Card size="2" mt="2">
                        {detailsContent}
                    </Card>
                </details>
            </Flex>
        </>
    );
};

export { ActivitySubeventsDetails };
