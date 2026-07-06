import { Amount, RelativeTime, UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Badge, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { SettlementCreatedAction } from 'constants/activity';
import { themeColor } from 'helpers/colors';
import { useUsersStore } from 'store/usersStore';

interface Props {
    event: Extract<AppEvent, { action: SettlementCreatedAction }>;
}

const isFriendExpenseGroupName = (groupName?: string | null) =>
    !groupName || groupName.toLowerCase() === 'p2p';

const UserLabel = styled(Flex)`
    min-width: 0;
    max-width: 180px;
`;

const AmountText = styled(Text)<{ $isNegative: boolean }>`
    color: ${({ $isNegative }) => themeColor($isNegative ? 'red11' : 'green11')};
    white-space: nowrap;
`;

const EventSettlementCreated = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const user = useUsersStore(state => state.user);
    const { amount, currency, fromDisplayName, groupName, payerId, toDisplayName } =
        event.metadata;
    const isCurrentUserPayer = user?.id === payerId;
    const contextLabel = isFriendExpenseGroupName(groupName)
        ? t('event.friendExpense')
        : groupName ?? t('event.friendExpense');

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex align="center" gap="3" minWidth="0">
                    <UserLabel align="center" gap="2">
                        <UserAvatar size="1" user={{ displayName: fromDisplayName, picture: null }} />
                        <Text size="3" weight="medium" truncate>
                            {fromDisplayName}
                        </Text>
                    </UserLabel>

                    <Text size="2" color="gray" truncate>
                        {t('event.paidTo')}
                    </Text>

                    <UserLabel align="center" gap="2">
                        <UserAvatar size="1" user={{ displayName: toDisplayName, picture: null }} />
                        <Text size="3" weight="medium" truncate>
                            {toDisplayName}
                        </Text>
                    </UserLabel>
                </Flex>

                <Flex direction="column" align="end" gap="1">
                    <AmountText size="3" weight="bold" $isNegative={isCurrentUserPayer}>
                        <Amount value={amount} tokenCode={currency} />
                    </AmountText>

                    <Badge size="1" variant="soft" color="gray">
                        {contextLabel}
                    </Badge>

                    <RelativeTime createdAt={event.createdAt} />
                </Flex>
            </Flex>
        </Card>
    );
};

export default EventSettlementCreated;
