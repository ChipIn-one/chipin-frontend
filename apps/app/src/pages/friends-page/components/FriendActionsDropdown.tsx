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

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import type { Balance } from 'entities/balance';
import { hasOutstandingDebt, type KnownUser } from 'entities/users';
import { useCreateSettlement } from 'hooks/useLedgerMutations';
import { useRequiresOnline } from 'hooks/useRequiresOnline';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { Dropdown } from 'basics/Dropdown';
import { RemoveFriendAlertDialog } from 'components/modals/remove-friend-alert-dialog';
import { SettleUpModal } from 'components/modals/settle-up-modal';

interface Props {
    friend: KnownUser;
    balance?: Balance;
}

const FriendActionsDropdown = ({ friend, balance }: Props) => {
    const { t } = useTranslation(['common', 'friends']);
    const [isSettleUpOpened, setIsSettleUpOpened] = useState(false);
    const [isRemoveFriendOpened, setIsRemoveFriendOpened] = useState(false);
    const openAddExpenseModal = useExpenseModalStore(state => state.open);
    const { createSettlement } = useCreateSettlement();
    // §2.9: menu items, so the flags are read here instead of an `<OnlineOnly>` wrapper.
    const isSettleUpBlocked = useRequiresOnline(ONLINE_ONLY_ACTIONS.settleUp);
    const isRemoveBlocked = useRequiresOnline(ONLINE_ONLY_ACTIONS.friendDelete);
    const isRemoveDisabled = hasOutstandingDebt(friend) || isRemoveBlocked;
    // KB NET-006: a blocked item says why.
    const onlineRequired = t('common:outbox.onlineRequired');

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
                          isDisabled: isSettleUpBlocked,
                          hint: isSettleUpBlocked ? onlineRequired : undefined,
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
                hint: isRemoveBlocked ? onlineRequired : undefined,
                onSelect: () => {
                    setIsRemoveFriendOpened(true);
                },
            },
        ],
        [
            balance,
            friend.user.id,
            isRemoveBlocked,
            isRemoveDisabled,
            isSettleUpBlocked,
            onlineRequired,
            openAddExpenseModal,
            t,
        ],
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
                    balances={friend.balances}
                    initialCurrency={balance.net.currency}
                    onSubmit={settlement => createSettlement({ settlement })}
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

export { FriendActionsDropdown };
