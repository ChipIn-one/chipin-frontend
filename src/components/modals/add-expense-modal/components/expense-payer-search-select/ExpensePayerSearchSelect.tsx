import { UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { selectPayerUsers } from 'store/expenseModalSelectors';
import type { ExpenseParticipant } from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { SearchSelect, type SearchSelectItem } from 'components/search-select';

import { ExpenseSearchSelectContent } from '../expense-search-select-content';

const ExpensePayerSearchSelect = () => {
    const { t } = useTranslation('group');
    const members = useExpenseModalStore(useShallow(selectPayerUsers));

    const { paidById, targetMode, currentUserId, setPaidById } = useExpenseModalStore(
        useShallow(state => ({
            paidById: state.paidById,
            targetMode: state.targetMode,
            currentUserId: state.source.currentUser?.id,
            setPaidById: state.setPaidById,
        })),
    );

    const items: SearchSelectItem[] = [];
    let selectedMember: ExpenseParticipant | undefined;
    let currentMember: ExpenseParticipant | undefined;

    for (const member of members) {
        const label =
            member.id === currentUserId ? t('expenses.modal.currentUser') : member.displayName;

        items.push({
            value: member.id,
            label,
            icon: <UserAvatar size="1" user={member} />,
            searchFields: [label, member.displayName],
        });

        if (member.id === paidById) {
            selectedMember = member;
        }

        if (member.id === currentUserId) {
            currentMember = member;
        }
    }

    const fallbackMember =
        targetMode === 'friends' && currentUserId ? currentMember : members[0];
    const resolvedMember = selectedMember ?? fallbackMember;
    const selectedPayer =
        resolvedMember?.id ?? (targetMode === 'friends' ? (currentUserId ?? '') : '');

    const selectedLabel =
        resolvedMember?.id === currentUserId
            ? t('expenses.modal.currentUser')
            : (resolvedMember?.displayName ?? t('expenses.modal.currentUser'));

    return (
        <SearchSelect
            items={items}
            value={selectedPayer}
            searchPlaceholder={t('expenses.modal.payerSearchPlaceholder')}
            emptyText={t('expenses.modal.noMembers')}
            triggerElement={
                <ExpenseSearchSelectContent
                    icon={resolvedMember ? <UserAvatar size="2" user={resolvedMember} /> : null}
                    title={t('common:fields.paidBy')}
                    value={selectedLabel}
                />
            }
            onChange={setPaidById}
        />
    );
};

export default ExpensePayerSearchSelect;
