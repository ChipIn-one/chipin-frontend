import { Amount, OwedStatusText, RelativeTime } from 'basics';
import { LucideBanknoteArrowDown, LucideBanknoteArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { ExpenseCreatedAction } from 'constants/activity';
import { useUsersStore } from 'store/usersStore';

interface Props {
    event: Extract<AppEvent, { action: ExpenseCreatedAction }>;
}

const EventExpenseCreated = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const user = useUsersStore(state => state.user);
    const { amount } = event.metadata;
    const isCurrentUserPayer = event.metadata.payerId === user?.id;
    const iconColor = user ? (isCurrentUserPayer ? 'red' : 'green') : 'gray';

    const userShareAmount = event.metadata.shares.find(
        share => share.userId === user?.id,
    )?.shareAmount ?? 0;

    const userExpenseDebt = isCurrentUserPayer
        ? event.metadata.amount - userShareAmount
        : userShareAmount * -1;

    return (
        <Card size="1" mb="2" data-activity-event-card>
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="3"
                        variant="soft"
                        color={iconColor}
                        fallback={
                            isCurrentUserPayer ? (
                                <LucideBanknoteArrowUp size={20} />
                            ) : (
                                <LucideBanknoteArrowDown size={20} />
                            )
                        }
                    />
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text size="3" weight="medium" as="p">
                            {event.metadata.description}
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t('event.expenseCreatedDescription', {
                                payer: event.metadata.payerDisplayName,
                                group: event.metadata.groupName,
                            })}
                        </Text>
                    </Flex>
                </Flex>

                <Flex direction="column" align="end">
                    {amount ? (
                        <Text size="3" weight="bold" as="p">
                            <Amount value={amount} tokenCode={event.metadata.currency} />
                        </Text>
                    ) : null}
                    {userExpenseDebt ? (
                        <OwedStatusText
                            value={userExpenseDebt}
                            currencyCode={event.metadata.currency}
                            size="2"
                        />
                    ) : null}
                    <RelativeTime createdAt={event.createdAt} />
                </Flex>
            </Flex>
        </Card>
    );
};

export default EventExpenseCreated;
