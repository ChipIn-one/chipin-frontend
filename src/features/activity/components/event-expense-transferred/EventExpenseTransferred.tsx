import { RelativeTime } from 'basics';
import { LucideRedo2, LucideUndo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import {
    ACTIVITY_ACTIONS,
    type ExpenseTransferredFromAction,
    type ExpenseTransferredToAction,
} from 'constants/activity';

interface Props {
    event: Extract<
        AppEvent,
        { action: ExpenseTransferredFromAction | ExpenseTransferredToAction }
    >;
}

const getDescriptionKey = (reason: string): string => {
    switch (reason) {
        case 'KICK':
            return 'event.expenseTransferKickDescription';
        case 'LEAVE':
            return 'event.expenseTransferLeaveDescription';
        case 'GROUP_DELETED':
            return 'event.expenseTransferGroupDeletedDescription';
        default:
            return 'event.expenseTransferDefaultDescription';
    }
};

const EventExpenseTransferred = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const isTransferredFrom = event.action === ACTIVITY_ACTIONS.EXPENSE_TRANSFERRED_FROM;
    const titleKey = isTransferredFrom
        ? 'event.expenseTransferredFromTitle'
        : 'event.expenseTransferredToTitle';

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center" minWidth="0">
                    <Avatar
                        size="4"
                        variant="soft"
                        color={isTransferredFrom ? 'orange' : 'blue'}
                        fallback={
                            isTransferredFrom ? (
                                <LucideUndo2 size={28} />
                            ) : (
                                <LucideRedo2 size={28} />
                            )
                        }
                    />
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text size="3" weight="medium" as="p">
                            {t(titleKey, { group: event.metadata.groupName })}
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t(getDescriptionKey(event.metadata.reason))}
                        </Text>
                    </Flex>
                </Flex>

                <Flex direction="column" align="end" flexShrink="0">
                    <Text size="2" weight="medium" color="gray" as="p">
                        {t('event.expenseTransferCount', {
                            count: event.metadata.transfers.length,
                        })}
                    </Text>
                    <RelativeTime createdAt={event.createdAt} />
                </Flex>
            </Flex>
        </Card>
    );
};

export { EventExpenseTransferred };
