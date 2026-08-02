import { LedgerScopeBadge, RelativeTime } from 'basics';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import {
    ACTIVITY_ACTIONS,
    type ExpenseCreatedAction,
    type ExpenseReversedAction,
    type ExpenseUpdatedAction,
} from 'constants/activity';
import { useUsersStore } from 'store/users-store';

import { ExpenseIcon } from './components';
import { ExpenseAmount, ExpenseDebt, ExpenseDescription, ExpensePayer } from './styled';

interface Props {
    event: Extract<
        AppEvent,
        { action: ExpenseCreatedAction | ExpenseUpdatedAction | ExpenseReversedAction }
    >;
}

const EventExpense = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const user = useUsersStore(state => state.user);
    const { amount } = event.metadata;
    const isReversed = event.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    const isCurrentUserPayer = event.metadata.payerId === user?.id;

    const userShareAmount =
        event.metadata.shares.find(share => share.userId === user?.id)?.shareAmount ?? 0;

    const userExpenseDebt = isCurrentUserPayer
        ? event.metadata.amount - userShareAmount
        : userShareAmount * -1;
    const description = event.metadata.description;

    return (
        <Card size="1" mb="2" data-interactive-card>
            <Flex justify="between" align="center" gap="3">
                <Flex direction="column" gap="1" minWidth="0">
                    {description ? (
                        <ExpenseDescription size="3" weight="medium" $isReversed={isReversed}>
                            {description}
                        </ExpenseDescription>
                    ) : null}

                    <Flex gap="3" align="center" minWidth="0">
                        <ExpenseIcon
                            isReversed={isReversed}
                            hasCurrentUser={Boolean(user)}
                            isCurrentUserPayer={isCurrentUserPayer}
                        />
                        <Flex direction="column" align="start" gap="1">
                            <ExpensePayer
                                size="3"
                                color="gray"
                                weight="medium"
                                as="span"
                                $isReversed={isReversed}
                            >
                                {t('event.expenseCreatedDescription', {
                                    payer: event.metadata.payerDisplayName,
                                })}
                            </ExpensePayer>

                            <LedgerScopeBadge
                                groupId={event.metadata.groupId}
                                groupName={event.metadata.groupName}
                                groupEmoji={event.metadata.groupEmoji}
                            />
                            {isReversed ? (
                                <Text size="2" color="gray">
                                    {t('event.expenseReversedDescription', {
                                        actor: event.actorSnapshot.displayName,
                                    })}
                                </Text>
                            ) : null}
                        </Flex>
                    </Flex>
                </Flex>

                <Flex direction="column" gap="1" align="end" flexShrink="0">
                    {amount ? (
                        <Text size="3" weight="bold" as="p" wrap="nowrap">
                            <ExpenseAmount
                                $isReversed={isReversed}
                                value={amount}
                                tokenCode={event.metadata.currency}
                            />
                        </Text>
                    ) : null}
                    {userExpenseDebt ? (
                        <ExpenseDebt
                            $isReversed={isReversed}
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

export { EventExpense };
