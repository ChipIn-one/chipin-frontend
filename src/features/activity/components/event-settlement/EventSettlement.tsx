import { Amount, LedgerScopeBadge, RelativeTime } from 'basics';
import { LucideArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import {
    ACTIVITY_ACTIONS,
    type SettlementCreatedAction,
    type SettlementReversedAction,
} from 'constants/activity';
import { useUsersStore } from 'store/users-store';

import { SettlementParticipants } from './components';
import { AmountText } from './styled';

interface Props {
    event: Extract<AppEvent, { action: SettlementCreatedAction | SettlementReversedAction }>;
}

const EventSettlement = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const user = useUsersStore(state => state.user);
    const {
        amount,
        currency,
        fromDisplayName,
        groupEmoji,
        groupId,
        groupName,
        payerId,
        toDisplayName,
    } = event.metadata;
    const isReversed = event.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED;
    const isCurrentUserPayer = user?.id === payerId;

    return (
        <Card size="1" mb="2" data-interactive-card>
            <Flex justify="between" align="center" gap="3">
                <Flex align="center" gap="3" minWidth="0">
                    <Avatar
                        size="4"
                        variant="soft"
                        color="green"
                        fallback={<LucideArrowLeftRight size={28} />}
                    />
                    <Flex direction="column" align="start" gap="1" minWidth="0">
                        <SettlementParticipants
                            fromDisplayName={fromDisplayName}
                            toDisplayName={toDisplayName}
                            isReversed={isReversed}
                        />
                        <LedgerScopeBadge
                            groupId={groupId}
                            groupName={groupName}
                            groupEmoji={groupEmoji}
                        />
                        {isReversed ? (
                            <Text size="2" color="gray">
                                {t('event.settlementReversedDescription', {
                                    actor: event.actorSnapshot.displayName,
                                })}
                            </Text>
                        ) : null}
                    </Flex>
                </Flex>

                <Flex direction="column" align="end" gap="1" flexShrink="0">
                    <AmountText
                        size="3"
                        weight="bold"
                        $isNegative={isCurrentUserPayer}
                        $isReversed={isReversed}
                    >
                        <Amount value={amount} tokenCode={currency} />
                    </AmountText>

                    <RelativeTime createdAt={event.createdAt} />
                </Flex>
            </Flex>
        </Card>
    );
};

export { EventSettlement };
