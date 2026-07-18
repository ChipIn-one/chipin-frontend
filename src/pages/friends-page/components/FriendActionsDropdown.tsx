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

import Dropdown from 'components/Dropdown';
import AddExpenseModal from 'components/modals/AddExpenseModal';

interface Props {
    friendId: string;
}

const FriendActionsDropdown = ({ friendId }: Props) => {
    const { t } = useTranslation(['common', 'friends']);
    const [isExpenseModalOpened, setIsExpenseModalOpened] = useState(false);

    const actions = useMemo(
        () => [
            {
                value: 'addExpense',
                label: t('common:buttons.addExpense'),
                icon: <LucidePlusCircle size={16} />,
                onSelect: () => {
                    setIsExpenseModalOpened(true);
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
                isDisabled: true,
                onSelect: () => {
                    /* todo */
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
        [t],
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
            <AddExpenseModal
                context="friends"
                friendId={friendId}
                isOpened={isExpenseModalOpened}
                setIsOpened={setIsExpenseModalOpened}
            />
        </>
    );
};

export default FriendActionsDropdown;
