import { Amount, UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';

import { Card, Flex } from '@radix-ui/themes';

import type { FriendUser } from 'api/chipin.types';

import { DebtAmount, DebtAmountAction, ParticipantName } from '../styled';
import type { SettlementUser } from '../types';

interface Props {
    friend: FriendUser;
    summaryUser: SettlementUser;
    isFriendPayer: boolean;
    amount: number;
    currency: string;
    color: 'green' | 'red';
    onUseFullAmount: () => void;
}

const SettlementDebtSummary = ({
    friend,
    summaryUser,
    isFriendPayer,
    amount,
    currency,
    color,
    onUseFullAmount,
}: Props) => {
    const { t } = useTranslation('friends');

    return (
        <Card size="1">
            <Flex align="center" justify="between" gap="3">
                <Flex align="center" gap="3" minWidth="0">
                    <UserAvatar size="3" user={summaryUser} />
                    <ParticipantName size="3" weight="bold" color={color}>
                        {t(
                            isFriendPayer
                                ? 'friends:settleUp.owedToYou'
                                : 'friends:settleUp.youOwe',
                            { name: friend.displayName },
                        )}
                    </ParticipantName>
                </Flex>
                <DebtAmount size="3" weight="bold" color={color}>
                    <DebtAmountAction
                        type="button"
                        onClick={onUseFullAmount}
                        aria-label={t('friends:settleUp.useFullAmount')}
                    >
                        <Amount
                            value={amount}
                            tokenCode={currency}
                            precision={2}
                            type="summary"
                        />
                    </DebtAmountAction>
                </DebtAmount>
            </Flex>
        </Card>
    );
};

export default SettlementDebtSummary;
