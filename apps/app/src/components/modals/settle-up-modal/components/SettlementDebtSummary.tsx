import { Card, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import type { FriendUser } from 'api/chipin.types';
import { legacyAmountFromMoney } from 'entities/balance';
import type { Money } from 'shared/money';

import { Amount, UserAvatar } from 'basics';

import type { SettlementUser } from '../types';

import styles from './SettlementDebtSummary.module.css';

interface Props {
    friend: FriendUser;
    summaryUser: SettlementUser;
    isFriendPayer: boolean;
    /** The exact debt; below one minor unit it shows as "< 0.01". */
    amount: Money;
    color: 'green' | 'red';
}

const SettlementDebtSummary = ({ friend, summaryUser, isFriendPayer, amount, color }: Props) => {
    const { t } = useTranslation('friends');

    return (
        <Card size="1">
            <Flex align="center" justify="between" gap="3">
                <Flex align="center" gap="3" minWidth="0">
                    <UserAvatar size="3" user={summaryUser} />
                    <Text className={styles.participantName} size="3" weight="bold" color={color}>
                        {t(
                            isFriendPayer
                                ? 'friends:settleUp.owedToYou'
                                : 'friends:settleUp.youOwe',
                            { name: friend.displayName },
                        )}
                    </Text>
                </Flex>
                <Text className={styles.debtAmount} size="3" weight="bold" color={color}>
                    <Amount
                        value={legacyAmountFromMoney(amount)}
                        tokenCode={amount.currency}
                        precision={2}
                        type="summary"
                    />
                </Text>
            </Flex>
        </Card>
    );
};

export { SettlementDebtSummary };
