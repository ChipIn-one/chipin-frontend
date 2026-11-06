import { useMemo, useState } from 'react';
import { IconButton } from '@radix-ui/themes';
import {
    ArrowLeftRightIcon,
    BellIcon,
    MoreVerticalIcon,
    PlusCircleIcon,
    UserXIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { FriendBalance } from 'api/chipin.types';
import { type Balance, legacyAmountFromMoney } from 'entities/balance';
import { hasOutstandingDebt, type KnownUser } from 'entities/users';
import { useActivityStore } from 'store/activity-store';
import { useExpenseModalStore } from 'store/expenseModalStore';

import Dropdown from 'components/Dropdown';
import { RemoveFriendAlertDialog } from 'components/modals/remove-friend-alert-dialog';
import { SettleUpModal } from 'components/modals/settle-up-modal';

// LEGACY until 03-21: the settle-up modal still reads number amounts.
const toSettleUpBalance = ({ net }: Balance): FriendBalance => ({
    currency: net.currency,
    netAmount: legacyAmountFromMoney(net),
});

interface Props {
    friend: KnownUser;
    balance?: Balance;
}

const FriendActionsDropdown = ({ friend, balance }: Props) => {
    const { t } = useTranslation(['common', 'friends']);
    const [isSettleUpOpened, setIsSettleUpOpened] = useState(false);
    const [isRemoveFriendOpened, setIsRemoveFriendOpened] = useState(false);
    const openAddExpenseModal = useExpenseModalStore(state => state.open);
    const isRemoveDisabled = hasOutstandingDebt(friend);

    const actions = useMemo(
        () => [
            {
                value: 'addExpense',
                label: t('common:buttons.addExpense'),
                icon: <PlusCircleIcon size={16} />,
                onSelect: () => {
                    openAddExpenseModal({
                        context: 'friends',
                        friendId: friend.user.id,
                    });
                },
            },
            {
                value: 'remind',
                label: t('friends:actions.remind'),
                icon: <BellIcon size={16} />,
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
                          icon: <ArrowLeftRightIcon size={16} />,
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
                icon: <UserXIcon size={16} />,
                color: 'red' as const,
                isDisabled: isRemoveDisabled,
                onSelect: () => {
                    setIsRemoveFriendOpened(true);
                },
            },
        ],
        [balance, friend.user.id, isRemoveDisabled, openAddExpenseModal, t],
    );

    return (
        <>
            <Dropdown
                items={actions}
                trigger={
                    <IconButton variant="ghost" size="2" color="gray">
                        <MoreVerticalIcon size={16} />
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
                    balances={friend.balances.map(toSettleUpBalance)}
                    initialCurrency={balance.net.currency}
                    onSubmit={params => useActivityStore.getState().createSettlement(params)}
                />
            )}
            {isRemoveFriendOpened && (
                <RemoveFriendAlertDialog
                    isOpened={isRemoveFriendOpened}
                    setIsOpened={setIsRemoveFriendOpened}
                    friend={friend.user}
                />
            )}
        </>
    );
};

export default FriendActionsDropdown;
