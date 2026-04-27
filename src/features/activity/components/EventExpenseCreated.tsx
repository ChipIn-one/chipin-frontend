import { Amount, OwedStatusText, RelativeTime } from 'basics';
import { LucideBanknoteArrowDown, LucideBanknoteArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import { AppEvent } from 'api/activity.types';
import { tryToBig } from 'helpers/numbers';
import { useUsersStore } from 'store/usersStore';

interface Props {
    event: Extract<AppEvent, { action: 'EXPENSE_CREATED' }>;
}

const EventExpenseCreated = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const user = useUsersStore(state => state.user);
    const amountBig = tryToBig(event.metadata.amount);
    const isCurrentUserPayer = event.metadata.payerDisplayName === user?.displayName;

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="3"
                        variant="soft"
                        color={isCurrentUserPayer ? 'green' : 'red'}
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
                    {amountBig ? (
                        <Text size="3" weight="bold" as="p">
                            <Amount value={amountBig} tokenCode={event.metadata.currency} />
                        </Text>
                    ) : null}
                    {amountBig ? (
                        <OwedStatusText
                            amount={amountBig.toNumber()}
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
