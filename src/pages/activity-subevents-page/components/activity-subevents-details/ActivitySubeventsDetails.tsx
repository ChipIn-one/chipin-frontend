import { Card, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

import {
    DetailLabel,
    DetailRow,
    DetailsCard,
    DisclosureChevron,
    MobileDetails,
    MobileSummary,
    ParticipantRow,
    SummarySurface,
} from './styled';

interface Props {
    view?: ActivitySubeventsView<ActivityEvent>;
    /** The chain's later events (the expense editor starts from the latest). */
    childEvents: readonly ActivityEvent[];
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

const ActivitySubeventsDetails = ({ view, childEvents, isLoading }: Props) => {
    const { t, i18n } = useTranslation(['activity', 'group']);

    if (isLoading) {
        return (
            <DetailsCard size="3">
                <Flex direction="column" gap="3">
                    <Skeleton>
                        <Heading size="4">{t('subeventsCurrentStateTitle')}</Heading>
                    </Skeleton>
                    <Skeleton>
                        <Text size="2">{t('subeventsDetailsAction')}</Text>
                    </Skeleton>
                </Flex>
            </DetailsCard>
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
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsPayer')}
                    </DetailLabel>
                    <Text size="2">{expenseEvent.metadata.payerDisplayName}</Text>
                </DetailRow>
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsCreatedAt')}
                    </DetailLabel>
                    <Text size="2">{createdAt}</Text>
                </DetailRow>
                <DetailRow gap="3" pt="2" align="center">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsScope')}
                    </DetailLabel>
                    <LedgerScopeBadge groupId={groupId} groupName={groupName} />
                </DetailRow>
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsCategory')}
                    </DetailLabel>
                    <Text size="2">
                        {expenseEvent.metadata.category
                            ? t(`group:expenses.modal.categories.${expenseEvent.metadata.category}`)
                            : '—'}
                    </Text>
                </DetailRow>
                {expenseEvent.metadata.subcategory ? (
                    <DetailRow gap="3" pt="2">
                        <DetailLabel size="1" color="gray">
                            {t('subeventsSubcategory')}
                        </DetailLabel>
                        <Text size="2">
                            {t(
                                `group:expenses.modal.subcategories.${expenseEvent.metadata.subcategory}`,
                            )}
                        </Text>
                    </DetailRow>
                ) : null}
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsSharingMode')}
                    </DetailLabel>
                    <Text size="2">
                        {t(`subeventsSharingModes.${getSharingModeLabel(expenseEvent.metadata)}`)}
                    </Text>
                </DetailRow>
            </Flex>

            <Flex direction="column" gap="1">
                <Text size="1" color="gray" weight="medium">
                    {t('subeventsParticipants')}
                </Text>
                {expenseEvent.metadata.shares?.map(share => (
                    <ParticipantRow key={share.userId} justify="between" gap="3" py="2">
                        <Text size="2">{share.displayName}</Text>
                        <Amount
                            value={legacyAmountFromMoney(share.shareAmount)}
                            tokenCode={share.shareAmount.currency}
                            type="summary"
                        />
                    </ParticipantRow>
                ))}
            </Flex>

            <ActivitySubeventsButtons
                parentEvent={originalEvent}
                currentEvent={currentEvent}
                childEvents={childEvents}
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
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsFrom')}
                    </DetailLabel>
                    <Text size="2">{settlementEvent.metadata.fromDisplayName}</Text>
                </DetailRow>
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsTo')}
                    </DetailLabel>
                    <Text size="2">{settlementEvent.metadata.toDisplayName}</Text>
                </DetailRow>
                <DetailRow gap="3" pt="2">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsCreatedAt')}
                    </DetailLabel>
                    <Text size="2">{createdAt}</Text>
                </DetailRow>
                <DetailRow gap="3" pt="2" align="center">
                    <DetailLabel size="1" color="gray">
                        {t('subeventsScope')}
                    </DetailLabel>
                    <LedgerScopeBadge groupId={groupId} groupName={groupName} />
                </DetailRow>
            </Flex>

            <ActivitySubeventsButtons
                parentEvent={originalEvent}
                currentEvent={currentEvent}
                childEvents={childEvents}
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
                <DetailsCard size="3">{detailsContent}</DetailsCard>
            </Flex>

            <Flex display={{ initial: 'flex', sm: 'none' }}>
                <MobileDetails>
                    <MobileSummary>
                        <SummarySurface size="2">
                            <Flex justify="between" align="center" gap="3">
                                {summary}
                                <DisclosureChevron size={16} aria-hidden="true" />
                            </Flex>
                        </SummarySurface>
                    </MobileSummary>
                    <Card size="2" mt="2">
                        {detailsContent}
                    </Card>
                </MobileDetails>
            </Flex>
        </>
    );
};

export { ActivitySubeventsDetails };
