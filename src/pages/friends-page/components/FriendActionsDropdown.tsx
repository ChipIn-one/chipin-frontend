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

import type { User } from 'api/chipin.types';

import Dropdown from 'components/Dropdown';
import { SettleUpModal } from 'components/modals';

interface Props {
    friend: User;
    initialCurrency?: string;
    currencyBalances?: { currency: string; amount: number }[];
}

const FriendActionsDropdown = ({ friend, initialCurrency, currencyBalances = [] }: Props) => {
    const { t } = useTranslation(['common', 'friends']);
    const [isSettleUpOpened, setIsSettleUpOpened] = useState(false);
    const resolvedInitialCurrency = initialCurrency ?? currencyBalances[0]?.currency;
    const isSettleUpAvailable = Boolean(resolvedInitialCurrency && currencyBalances.length > 0);

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
                isDisabled: !isSettleUpAvailable,
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
        [isSettleUpAvailable, t],
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
            {isSettleUpAvailable && isSettleUpOpened && (
                <SettleUpModal
                    isOpened={isSettleUpOpened}
                    setIsOpened={setIsSettleUpOpened}
                    friend={friend}
                    balances={currencyBalances}
                    initialCurrency={resolvedInitialCurrency ?? ''}
                />
            )}
        </>
    );
};

export default FriendActionsDropdown;
