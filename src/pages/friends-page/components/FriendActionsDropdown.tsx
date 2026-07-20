import { useMemo, useState } from 'react';
import {
    LucideArrowLeftRight,
    LucideBell,
    LucideMoreVertical,
    LucidePlusCircle,
    LucideUserX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@radix-ui/themes';

import type { FriendBalance, KnownUser } from 'api/chipin.types';
import { useActivityStore } from 'store/activityStore';

import Dropdown from 'components/Dropdown';
import { RemoveFriendModal, SettleUpModal } from 'components/modals';

interface Props {
    friend: KnownUser;
    balance?: FriendBalance;
}

const FriendActionsDropdown = ({ friend, balance }: Props) => {
    const { t } = useTranslation(['common', 'friends']);
    const [isSettleUpOpened, setIsSettleUpOpened] = useState(false);
    const [isRemoveFriendOpened, setIsRemoveFriendOpened] = useState(false);
    const createSettlement = useActivityStore(state => state.createSettlement);
    const hasOutstandingDebt = friend.balances.some(friendBalance => friendBalance.netAmount !== 0);

    const actions = useMemo(
        () => [
            {
                value: 'addExpense',
                label: t('common:buttons.addExpense'),
                icon: <LucidePlusCircle size={16} />,
                onSelect: () => {
                    /* todo */
                },
            },
            {
                value: 'remind',
                label: t('friends:actions.remind'),
                icon: <LucideBell size={16} />,
                isDisabled: true,
                onSelect: () => {
                    /* todo */
                },
            },
            ...(balance
                ? [
                      {
                          value: 'settleUp',
                          label: t('common:buttons.settleUp'),
                          icon: <LucideArrowLeftRight size={16} />,
                          color: 'green' as const,
                          onSelect: () => {
                              setIsSettleUpOpened(true);
                          },
                      },
                  ]
                : []),
            {
                value: 'removeFriend',
                label: t('friends:actions.removeFriend'),
                icon: <LucideUserX size={16} />,
                color: 'red' as const,
                isDisabled: hasOutstandingDebt,
                onSelect: () => {
                    setIsRemoveFriendOpened(true);
                },
            },
        ],
        [balance, hasOutstandingDebt, t],
    );

    return (
        <>
            <Dropdown
                items={actions}
                trigger={
                    <IconButton variant="ghost" size="2" color="gray">
                        <LucideMoreVertical size={16} />
                    </IconButton>
                }
                align="end"
            />
            {balance && isSettleUpOpened && (
                <SettleUpModal
                    source="friend"
                    isOpened={isSettleUpOpened}
                    onOpenChange={setIsSettleUpOpened}
                    friend={friend.user}
                    balances={friend.balances}
                    initialCurrency={balance.currency}
                    onSubmit={createSettlement}
                />
            )}
            {isRemoveFriendOpened && (
                <RemoveFriendModal
                    isOpened={isRemoveFriendOpened}
                    setIsOpened={setIsRemoveFriendOpened}
                    friend={friend.user}
                />
            )}
        </>
    );
};

export default FriendActionsDropdown;
