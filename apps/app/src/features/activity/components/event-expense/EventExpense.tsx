import { Card, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { ACTIVITY_ACTIONS } from 'constants/activity';
import type { ExpenseActivityEvent } from 'entities/activity';
import { legacyAmountFromMoney } from 'entities/balance';
import { useSelfUser } from 'hooks/useSelfUser';
import { abs, fromUnits, isZero, negate, sign, sub } from 'shared/money';

import { Amount, LedgerScopeBadge } from 'basics';

import { EventIcon } from '../activity-event/EventIcon';

import { ExpenseIcon } from './components';

import styles from './EventExpense.module.css';

interface Props {
    event: ExpenseActivityEvent;
}

const EventExpense = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const user = useSelfUser();
    const { amount } = event.metadata;
    const isReversed = event.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED;
    const isCurrentUserPayer = event.metadata.payerId === user?.id;

    const userShareAmount =
        event.metadata.shares?.find(share => share.userId === user?.id)?.shareAmount ??
        fromUnits(0n, amount);

    // Shares are in the expense currency (checked when mapped).
    const userExpenseDebt = isCurrentUserPayer
        ? sub(amount, userShareAmount)
        : negate(userShareAmount);
    const isUserLender = sign(userExpenseDebt) > 0;
    const debtColor = isUserLender ? 'green' : 'red';
    const description = event.metadata.description;
    const reversedClassName = isReversed ? styles.reversed : undefined;

    return (
        <Card size="1" mb="2" data-interactive-card>
            <Flex justify="between" align="center" gap="3">
                <Flex direction="column" gap="1" minWidth="0" flexGrow="1">
                    <Flex gap="3" align="center" minWidth="0">
                        <EventIcon event={event} isActorInText={isReversed}>
                            <ExpenseIcon
                                action={event.action}
                                category={event.metadata.category}
                                subcategory={event.metadata.subcategory}
                                hasCurrentUser={Boolean(user)}
                                isCurrentUserPayer={isCurrentUserPayer}
                            />
                        </EventIcon>
                        <Flex direction="column" align="start" gap="1">
                            {description ? (
                                <Text size="3" weight="medium" className={reversedClassName}>
                                    {description}
                                </Text>
                            ) : null}

                            <Text size="2" color="gray" className={reversedClassName}>
                                {t('event.paidAmount', {
                                    payer: isCurrentUserPayer
                                        ? t('event.you')
                                        : event.metadata.payerDisplayName,
                                })}{' '}
                                <Amount
                                    className={reversedClassName}
                                    value={legacyAmountFromMoney(amount)}
                                    tokenCode={amount.currency}
                                    type="summary"
                                />
                            </Text>
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

                <Flex direction="column" gap="1" align="end" flexShrink="0" maxWidth="50%">
                    {isZero(userExpenseDebt) ? null : (
                        <>
                            <Text className={reversedClassName} color={debtColor} size="1">
                                {t(isUserLender ? 'event.youLent' : 'event.youBorrowed')}
                            </Text>
                            <Text className={reversedClassName} color={debtColor} size="2">
                                <Amount
                                    className={reversedClassName}
                                    value={legacyAmountFromMoney(abs(userExpenseDebt))}
                                    tokenCode={amount.currency}
                                    precision={2}
                                    type="summary"
                                />
                            </Text>
                        </>
                    )}
                    <LedgerScopeBadge
                        groupId={event.metadata.groupId ?? null}
                        groupName={event.metadata.groupName ?? null}
                    />
                </Flex>
            </Flex>
        </Card>
    );
};

export { EventExpense };
