import { UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
    selectPayerId,
    selectPayerUsers,
} from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { SearchSelect } from 'components/search-select';

import { ExpenseSearchSelectContent } from '../../../expense-search-select-content';

const ExpensePayerSearchSelect = () => {
    const { t } = useTranslation('group');
    const members = useExpenseModalStore(useShallow(selectPayerUsers));

    const { value, currentUserId, setPaidById } = useExpenseModalStore(
        useShallow(state => ({
            value: selectPayerId(state),
            currentUserId: state.source.currentUser?.id,
            setPaidById: state.setPaidById,
        })),
    );

    const items = members.map(member => {
        const label =
            member.id === currentUserId ? t('expenses.modal.currentUser') : member.displayName;

        return {
            value: member.id,
            label,
            icon: <UserAvatar size="1" user={member} />,
            searchFields: [label, member.displayName],
        };
    });

    const selectedMember = members.find(member => member.id === value);
    const selectedLabel =
        selectedMember?.id === currentUserId
            ? t('expenses.modal.currentUser')
            : (selectedMember?.displayName ?? t('expenses.modal.currentUser'));

    return (
        <SearchSelect
            items={items}
            value={value}
            searchPlaceholder={t('expenses.modal.payerSearchPlaceholder')}
            emptyText={t('expenses.modal.noMembers')}
            triggerElement={
                <ExpenseSearchSelectContent
                    icon={selectedMember ? <UserAvatar size="2" user={selectedMember} /> : null}
                    title={t('common:fields.paidBy')}
                    value={selectedLabel}
                />
            }
            onChange={setPaidById}
        />
    );
};

export default ExpensePayerSearchSelect;
