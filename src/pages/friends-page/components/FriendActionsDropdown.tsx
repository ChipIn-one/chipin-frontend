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

import Dropdown from 'components/Dropdown';
import { SettleUpModal } from 'components/modals';

interface Props {
    friend: KnownUser;
    balance?: FriendBalance;
}

const FriendActionsDropdown = ({ friend, balance }: Props) => {
    const { t } = useTranslation(['common', 'friends']);
    const [isSettleUpOpened, setIsSettleUpOpened] = useState(false);

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
                onSelect: () => {
                    /* todo */
                },
            },
            {
                value: 'settleUp',
                label: t('common:buttons.settleUp'),
                icon: <LucideArrowLeftRight size={16} />,
                color: 'green' as const,
                isDisabled: !balance,
                onSelect: () => {
                    setIsSettleUpOpened(true);
                },
            },
            {
                value: 'removeFriend',
                label: t('friends:actions.removeFriend'),
                icon: <LucideUserX size={16} />,
                color: 'red' as const,
                isDisabled: true,
                onSelect: () => {
                    /* todo */
                },
            },
        ],
        [balance, t],
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
                    isOpened={isSettleUpOpened}
                    setIsOpened={setIsSettleUpOpened}
                    friend={friend.user}
                    balances={friend.balances}
                    initialCurrency={balance.currency}
                />
            )}
        </>
    );
};

export default FriendActionsDropdown;
