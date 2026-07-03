import { Amount, RelativeTime } from 'basics';
import { LucideUndo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { ExpenseReversedAction } from 'constants/activity';

interface Props {
    event: Extract<AppEvent, { action: ExpenseReversedAction }>;
}

const EventExpenseReversed = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const { amount, currency, description, groupName } = event.metadata;

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="3"
                        variant="soft"
                        color="red"
                        fallback={<LucideUndo2 size={20} />}
                    />
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text size="3" weight="medium" as="p">
                            {description}
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t('event.expenseReversedDescription', {
                                actor: event.actorSnapshot.displayName,
                                group: groupName,
                            })}
                        </Text>
                    </Flex>
                </Flex>

                <Flex direction="column" align="end">
                    <Text size="3" weight="bold" color="gray" as="p">
                        <Amount value={amount} tokenCode={currency} />
                    </Text>
                    <RelativeTime createdAt={event.createdAt} />
                </Flex>
            </Flex>
        </Card>
    );
};

export default EventExpenseReversed;
